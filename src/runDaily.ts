/**
 * Main daily scraping pipeline with Primary/Fallback architecture
 */

import { getConfig } from './utils/config.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { createIndexes } from './db/models.js';
import {
  batchUpsertVideos,
  saveRun,
  saveReport,
  convertNormalizedToDocument,
  getEmptyDayStreak,
  updateReportEmailStatus,
  getReportByDate,
} from './db/operations.js';
import { createReportDocument } from './report/generator.js';
import { saveBackup, saveReportFile, cleanupOldBackups } from './utils/backup.js';
import { formatDuration, getYesterdayRange } from './utils/date.js';
import {
  logPipelineStart,
  logPipelineEnd,
  logInfo,
  logSuccess,
  logError,
  alertNoResults,
  alertLowResults,
  alertApifyFailed,
  alertPipelineCrashed,
  alertEmptyDayStreak,
} from './alert/logger.js';
import { PipelineResult, RunDocument, ActorType, FallbackReason } from './types/index.js';
import { runPrimary, runFallback, shouldFallback, isCircuitBreakerOpen } from './actors.js';
import { normalizeItems } from './normalize.js';
import { acquireLock, releaseLock } from './db/lock.js';
import { calculateDataQuality, getDataQualityWarnings } from './utils/dataQuality.js';
import { sendReportEmail, isEmailConfigured } from './email/index.js';

/**
 * Execute the daily scraping pipeline with Primary/Fallback
 */
export async function runDailyPipeline(): Promise<PipelineResult> {
  const startTime = Date.now();
  const config = getConfig();
  const { profileHandle, maxPosts, timezone, lowResultsThreshold } = config.scraper;

  let runId: string | undefined;
  let actorUsed: ActorType = 'primary';
  let fallbackReason: FallbackReason = null;
  let circuitBreakerSuppressed = false;
  let itemsFetchedRaw = 0;
  let itemsInRange = 0;
  let itemsInserted = 0;
  let itemsUpdated = 0;
  let reportGenerated = false;
  let warningFlags: string[] = [];
  let reportDate: string | undefined; // For lock release in finally

  try {
    logPipelineStart(profileHandle);

    // Step 1: Calculate reportDate (yesterday in YYYY-MM-DD format)
    const dateRange = getYesterdayRange(timezone);
    const { start, end } = dateRange;
    reportDate = dateRange.dateString;
    logInfo(`Step 1: Report date calculated: ${reportDate}`, { start, end });

    // Step 2: Connect to MongoDB
    logInfo('Step 2: Connecting to MongoDB...');
    await connectDatabase();
    await createIndexes();
    logSuccess('Database ready');

    // Step 2.5: Acquire Lock (v2.1.0 - Concurrency Protection)
    logInfo('Step 2.5: Acquiring lock...');
    const lockAcquired = await acquireLock(profileHandle, reportDate);
    
    if (!lockAcquired) {
      logInfo('LOCK_ACTIVE: Another run is already in progress for this profile+date. Exiting.');
      return {
        success: true,
        runId: 'SKIPPED_LOCK_ACTIVE',
        actorUsed: 'primary',
        fallbackReason: null,
        circuitBreakerSuppressed: false,
        itemsFetchedRaw: 0,
        itemsInRange: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        reportGenerated: false,
        warningFlags: ['LOCK_ACTIVE'],
      };
    }
    
    logSuccess('Lock acquired');

    // Step 3: Run PRIMARY actor
    logInfo(`Step 3: Running PRIMARY actor for @${profileHandle}...`);
    let actorResult = await runPrimary(profileHandle, maxPosts, reportDate);
    runId = actorResult.runId;
    const primaryStatus = actorResult.status;
    const datasetId = actorResult.datasetId;
    let rawItems = actorResult.items;

    logInfo(`Primary actor completed: ${primaryStatus}`, {
      runId,
      datasetId,
      itemsCount: rawItems.length,
    });

    // Step 4: Normalize results
    logInfo('Step 4: Normalizing results...');
    let normalizedItems = normalizeItems(rawItems, actorResult.actorId);
    itemsFetchedRaw = normalizedItems.length;

    // Collect normalization warnings
    normalizedItems.forEach((item) => {
      if (item.warningFlags.length > 0) {
        warningFlags.push(...item.warningFlags);
      }
    });

    logSuccess(`Normalized ${itemsFetchedRaw} items`);

    // Step 4.5: Calculate Data Quality metrics (v2.1.0)
    logInfo('Step 4.5: Checking data quality...');
    let filteredItemsTemp = normalizedItems.filter((video) => {
      if (!video.createTimeISO) return false;
      const videoDate = new Date(video.createTimeISO);
      return videoDate >= start && videoDate <= end;
    });
    
    const dataQuality = calculateDataQuality(normalizedItems, filteredItemsTemp.length);
    const hasDataQualityIssue = dataQuality.hasIssue;
    
    if (hasDataQualityIssue) {
      const dqWarnings = getDataQualityWarnings(dataQuality);
      warningFlags.push(...dqWarnings);
      logInfo('Data Quality Issues detected', {
        missingCreateTimePct: (dataQuality.missingCreateTimePct * 100).toFixed(1) + '%',
        missingUrlPct: (dataQuality.missingUrlPct * 100).toFixed(1) + '%',
      });
    } else {
      logSuccess('Data quality is acceptable');
    }

    // Step 5: Filter by yesterday's date range
    logInfo('Step 5: Filtering videos from yesterday...');
    let filteredItems = filteredItemsTemp; // Use already filtered items
    itemsInRange = filteredItems.length;

    logInfo(
      `Filtered by date ${reportDate}: ${itemsFetchedRaw} → ${itemsInRange} videos from yesterday`
    );

    // Step 6: Check if fallback should be triggered
    logInfo('Step 6: Checking fallback conditions...');
    const fallbackDecision = shouldFallback(
      primaryStatus, 
      itemsFetchedRaw, 
      itemsInRange, 
      lowResultsThreshold,
      hasDataQualityIssue
    );

    if (fallbackDecision.should) {
      fallbackReason = fallbackDecision.reason;
      logInfo(`Fallback triggered: ${fallbackReason}`, {
        primaryStatus,
        itemsInRange,
        threshold: lowResultsThreshold,
      });

      // Check Circuit Breaker
      const circuitBreakerOpen = await isCircuitBreakerOpen(profileHandle, reportDate);

      if (circuitBreakerOpen) {
        // Circuit breaker blocks fallback
        circuitBreakerSuppressed = true;
        warningFlags.push('CIRCUIT_BREAKER_SUPPRESSED');
        logInfo('Circuit Breaker BLOCKED fallback - using primary results', {
          fallbackReason,
        });

        // Alert about circuit breaker
        alertLowResults(runId, profileHandle, itemsInRange, lowResultsThreshold);
      } else {
        // Run fallback actor
        logInfo(`Running FALLBACK actor for @${profileHandle}...`);
        actorResult = await runFallback(profileHandle, maxPosts, reportDate);
        const fallbackRunId = actorResult.runId;
        const fallbackStatus = actorResult.status;
        const fallbackDatasetId = actorResult.datasetId;
        rawItems = actorResult.items;

        logInfo(`Fallback actor completed: ${fallbackStatus}`, {
          fallbackRunId,
          fallbackDatasetId,
          itemsCount: rawItems.length,
        });

        // Update to use fallback results
        runId = fallbackRunId;
        actorUsed = 'fallback';

        // Normalize fallback results
        normalizedItems = normalizeItems(rawItems, actorResult.actorId);
        itemsFetchedRaw = normalizedItems.length;

        // Collect normalization warnings
        normalizedItems.forEach((item) => {
          if (item.warningFlags.length > 0) {
            warningFlags.push(...item.warningFlags);
          }
        });

        // Filter fallback results by yesterday
        filteredItems = normalizedItems.filter((video) => {
          if (!video.createTimeISO) return false;
          const videoDate = new Date(video.createTimeISO);
          return videoDate >= start && videoDate <= end;
        });
        itemsInRange = filteredItems.length;

        logInfo(
          `Fallback filtered by date ${reportDate}: ${itemsFetchedRaw} → ${itemsInRange} videos`
        );

        // Alert only if it's not a quiet day scenario
        const isQuietDay = itemsFetchedRaw > 0 && fallbackStatus === 'SUCCEEDED';
        
        if (itemsInRange === 0 && !isQuietDay) {
          // Real issue - fallback also returned nothing
          alertNoResults(runId, profileHandle);
        } else if (itemsInRange > 0 && itemsInRange < lowResultsThreshold) {
          alertLowResults(runId, profileHandle, itemsInRange, lowResultsThreshold);
        }
      }
    } else {
      logInfo('Fallback not needed - primary results sufficient', {
        primaryStatus,
        itemsInRange,
        threshold: lowResultsThreshold,
      });
    }

    // Step 7: Validate final results
    logInfo('Step 7: Validating final results...');
    
    if (primaryStatus !== 'SUCCEEDED' && actorUsed === 'primary') {
      alertApifyFailed(runId, primaryStatus);
      warningFlags.push('PRIMARY_FAILED');
    }

    // Check results
    if (itemsInRange === 0) {
      // Distinguish between "quiet day" and technical failure
      const isQuietDay = itemsFetchedRaw > 0 && primaryStatus === 'SUCCEEDED' && !fallbackReason;
      
      if (!isQuietDay) {
        // Technical failure - add warning
        warningFlags.push('ZERO_RESULTS');
      } else {
        // Quiet day (holiday/Shabbat) - this is normal, no warning needed
        logInfo('Zero results but quiet day detected (holiday/Shabbat)', {
          itemsFetchedRaw,
          itemsInRange,
          primaryStatus,
        });
      }
    } else if (itemsInRange < lowResultsThreshold) {
      warningFlags.push('LOW_RESULTS');
    }

    logSuccess(`Final validation: ${itemsInRange} items from ${actorUsed} actor`);

    // Step 8: Save raw backup
    logInfo('Step 8: Saving raw data backup...');
    await saveBackup(rawItems);
    logSuccess('Backup saved');

    // Step 9: Upsert filtered videos to MongoDB
    if (itemsInRange > 0) {
      logInfo('Step 9: Upserting filtered videos to MongoDB...');
      
      const videoDocuments = filteredItems.map((item) =>
        convertNormalizedToDocument(item, profileHandle, runId!)
      );

      const upsertResult = await batchUpsertVideos(videoDocuments);
      itemsInserted = upsertResult.inserted;
      itemsUpdated = upsertResult.updated;

      logSuccess(
        `Upserted: ${itemsInserted} new, ${itemsUpdated} updated (from ${reportDate})`
      );
    } else {
      logInfo('Step 9: Skipping upsert (no items in range)');
    }

    // Step 9.5: Calculate Empty Day Streak (v2.1.0)
    let emptyDay = false;
    let emptyDayStreak = 0;
    
    if (itemsInRange === 0 && primaryStatus === 'SUCCEEDED' && !hasDataQualityIssue) {
      emptyDay = true;
      logInfo('Step 9.5: Calculating empty day streak...');
      emptyDayStreak = await getEmptyDayStreak(profileHandle, reportDate);
      logInfo(`Empty day streak: ${emptyDayStreak}`, { emptyDay, emptyDayStreak });
      
      // Alert if streak is suspicious (>= 2 days)
      if (emptyDayStreak >= 2) {
        alertEmptyDayStreak(profileHandle, reportDate, emptyDayStreak);
        warningFlags.push('EMPTY_STREAK');
      }
    }

    // Step 10: Generate report (v2.1.0 - Enhanced with empty day support)
    logInfo('Step 10: Generating daily report...');
    
    // Generate report for all cases (including empty days)
    const reportDoc = createReportDocument(
      filteredItems as any,
      profileHandle,
      reportDate,
      maxPosts,
      actorUsed,
      warningFlags,
      emptyDay,
      emptyDayStreak
    );

    // Save report to DB
    await saveReport(reportDoc);

    // Save report to file
    await saveReportFile(reportDoc.text, reportDate);

    reportGenerated = true;
    logSuccess(`Report generated and saved for ${reportDate}`);

    // Step 10.5: Send report via email (v2.2.0)
    if (isEmailConfigured()) {
      logInfo('Step 10.5: Sending report via email...');
      
      try {
        // Mark as PENDING before sending
        await updateReportEmailStatus(profileHandle, reportDate, 'PENDING');

        // Get CLI flag for force resend
        const forceResend = process.argv.includes('--resend-email');

        // Fetch the latest report (with emailStatus field)
        const latestReport = await getReportByDate(profileHandle, reportDate);
        
        if (!latestReport) {
          throw new Error('Report not found after save');
        }

        // Send email
        const emailResult = await sendReportEmail(latestReport, forceResend);

        // Update email status based on result
        if (emailResult.success) {
          await updateReportEmailStatus(
            profileHandle,
            reportDate,
            'SENT',
            emailResult.messageId
          );
          logSuccess('Report email sent successfully', {
            messageId: emailResult.messageId,
          });
        } else {
          await updateReportEmailStatus(
            profileHandle,
            reportDate,
            'FAILED',
            undefined,
            emailResult.error
          );
          logError('Report email failed', new Error(emailResult.error || 'Unknown error'));
          // Don't throw - email failure should not crash pipeline
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logError('Email send process failed', err);
        
        // Try to mark as FAILED in DB
        try {
          await updateReportEmailStatus(
            profileHandle,
            reportDate,
            'FAILED',
            undefined,
            err.message
          );
        } catch (updateError) {
          logError('Failed to update email status', updateError as Error);
        }
        
        // Don't throw - email failure should not crash pipeline
      }
    } else {
      logInfo('Step 10.5: Email not configured - skipping email send');
    }

    // Step 11: Save run record (v2.1.0 - Enhanced with data quality & empty day tracking)
    logInfo('Step 11: Saving run record...');
    
    // Determine run status (v2.1.0 - improved logic)
    let runStatus: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
    if (itemsInRange === 0) {
      // Empty day - check if it's legitimate or a failure
      if (emptyDay && !hasDataQualityIssue) {
        // Legitimate quiet day
        runStatus = 'SUCCEEDED';
      } else {
        // Technical failure or data quality issue
        runStatus = 'PARTIAL';
      }
    } else if (circuitBreakerSuppressed) {
      runStatus = 'PARTIAL';
    } else {
      runStatus = 'SUCCEEDED';
    }

    const runRecord: RunDocument = {
      runId: runId!,
      actorId: actorUsed === 'primary' 
        ? config.apify.primaryActorId 
        : config.apify.fallbackActorId,
      profileHandle,
      reportDate,
      startedAt: new Date(startTime),
      finishedAt: new Date(),
      status: runStatus,
      actorUsed,
      fallbackReason,
      circuitBreakerSuppressed,
      itemsFetchedRaw,
      itemsInRange,
      itemsFetched: itemsInRange, // For backward compatibility
      itemsInserted,
      itemsUpdated,
      datasetId,
      warningFlags,
      // Data Quality metrics (v2.1.0)
      missingCreateTimePct: dataQuality.missingCreateTimePct,
      missingUrlPct: dataQuality.missingUrlPct,
      // Empty Day tracking (v2.1.0)
      emptyDay,
      emptyDayStreak,
    };

    await saveRun(runRecord);
    logSuccess('Run record saved');

    // Step 11.5: Release Lock (v2.1.0)
    logInfo('Step 11.5: Releasing lock...');
    await releaseLock(profileHandle, reportDate);
    logSuccess('Lock released');

    // Step 12: Cleanup old backups
    logInfo('Step 12: Cleaning up old backups...');
    const deletedCount = await cleanupOldBackups(
      config.system.backupRetentionDays
    );
    if (deletedCount > 0) {
      logSuccess(`Cleaned up ${deletedCount} old backup(s)`);
    } else {
      logInfo('No old backups to clean up');
    }

    // Pipeline completed successfully
    const duration = Date.now() - startTime;
    logPipelineEnd(true, duration, {
      runId,
      actorUsed,
      fallbackReason,
      circuitBreakerSuppressed,
      itemsFetchedRaw,
      itemsInRange,
      itemsInserted,
      itemsUpdated,
      reportGenerated,
      warningFlags,
    });

    return {
      success: true,
      runId,
      actorUsed,
      fallbackReason,
      circuitBreakerSuppressed,
      itemsFetchedRaw,
      itemsInRange,
      itemsInserted,
      itemsUpdated,
      reportGenerated,
      warningFlags,
    };

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const duration = Date.now() - startTime;

    logError('Pipeline failed', err, {
      runId,
      actorUsed,
      fallbackReason,
      circuitBreakerSuppressed,
      itemsFetchedRaw,
      itemsInRange,
      itemsInserted,
      itemsUpdated,
      duration: formatDuration(duration),
    });

    alertPipelineCrashed(err);

    logPipelineEnd(false, duration, {
      runId,
      actorUsed,
      fallbackReason,
      error: err.message,
    });

    // Try to save failed run record
    if (runId) {
      try {
        const { dateString: reportDate } = getYesterdayRange(timezone);
        const runRecord: RunDocument = {
          runId,
          actorId: actorUsed === 'primary' 
            ? config.apify.primaryActorId 
            : config.apify.fallbackActorId,
          profileHandle,
          reportDate,
          startedAt: new Date(startTime),
          finishedAt: new Date(),
          status: 'FAILED',
          actorUsed,
          fallbackReason,
          circuitBreakerSuppressed,
          itemsFetchedRaw,
          itemsInRange,
          itemsFetched: itemsInRange,
          itemsInserted,
          itemsUpdated,
          error: err.message,
          datasetId: 'unknown',
          warningFlags,
        };
        await saveRun(runRecord);
      } catch (saveError) {
        logError('Failed to save error run record', saveError as Error);
      }
    }

    return {
      success: false,
      runId,
      actorUsed,
      fallbackReason,
      circuitBreakerSuppressed,
      itemsFetchedRaw,
      itemsInRange,
      itemsInserted,
      itemsUpdated,
      reportGenerated,
      warningFlags,
      error: err.message,
    };

  } finally {
    // Always release lock and disconnect from database (v2.1.0)
    if (reportDate) {
      try {
        await releaseLock(profileHandle, reportDate);
        logInfo('Lock released (finally block)');
      } catch (error) {
        logError('Failed to release lock', error as Error);
      }
    }
    
    try {
      await disconnectDatabase();
      logInfo('Database disconnected');
    } catch (error) {
      logError('Failed to disconnect database', error as Error);
    }
  }
}

/**
 * Run pipeline with process exit handling
 */
export async function runWithExitHandling(): Promise<void> {
  try {
    const result = await runDailyPipeline();
    
    if (result.success) {
      console.log('\n✅ Pipeline completed successfully\n');
      process.exit(0);
    } else {
      console.error('\n❌ Pipeline failed\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Pipeline crashed:', error);
    process.exit(1);
  }
}
