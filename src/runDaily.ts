/**
 * Main daily scraping pipeline
 */

import { getConfig } from './utils/config.js';
import { getApifyClient } from './apify/client.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { createIndexes } from './db/models.js';
import {
  batchUpsertVideos,
  saveRun,
  saveReport,
  convertTikTokVideoToDocument,
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
} from './alert/logger.js';
import { PipelineResult, TikTokVideo, RunDocument } from './types/index.js';

/**
 * Execute the daily scraping pipeline
 */
export async function runDailyPipeline(): Promise<PipelineResult> {
  const startTime = Date.now();
  const config = getConfig();
  const { profileHandle, maxPosts, timezone } = config.scraper;

  let runId: string | undefined;
  let itemsFetched = 0;
  let itemsInserted = 0;
  let itemsUpdated = 0;
  let reportGenerated = false;

  try {
    logPipelineStart(profileHandle);

    // Step 1: Connect to MongoDB
    logInfo('Step 1: Connecting to MongoDB...');
    await connectDatabase();
    await createIndexes();
    logSuccess('Database ready');

    // Step 2: Initialize Apify client
    logInfo('Step 2: Initializing Apify client...');
    const apifyClient = getApifyClient();
    logSuccess('Apify client ready');

    // Step 3: Start Apify scraping run
    logInfo(`Step 3: Starting Apify run for @${profileHandle}...`);
    const scrapeResult = await apifyClient.executeScrapeRun(
      profileHandle,
      maxPosts
    );

    runId = scrapeResult.runId;
    const { status, datasetId, items } = scrapeResult;

    logInfo(`Apify run completed: ${status}`, {
      runId,
      datasetId,
      itemsCount: items.length,
    });

    // Step 4: Validate results
    logInfo('Step 4: Validating results...');
    
    if (status !== 'SUCCEEDED') {
      alertApifyFailed(runId, status);
      throw new Error(`Apify run failed with status: ${status}`);
    }

    itemsFetched = items.length;

    if (itemsFetched === 0) {
      alertNoResults(runId, profileHandle);
      logInfo('No items fetched, but continuing to save run record');
    } else if (itemsFetched < 10) {
      alertLowResults(runId, profileHandle, itemsFetched, 10);
    }

    logSuccess(`Validated: ${itemsFetched} items fetched`);

    // Step 5: Save raw backup
    logInfo('Step 5: Saving raw data backup...');
    await saveBackup(items);
    logSuccess('Backup saved');

    // Step 6: Transform, filter by yesterday's date, and upsert to MongoDB
    if (itemsFetched > 0) {
      logInfo('Step 6: Filtering videos from yesterday and upserting to MongoDB...');
      
      const videoDocuments = items.map((item) =>
        convertTikTokVideoToDocument(item as TikTokVideo, profileHandle, runId!, 'Latest')
      );

      // Filter only videos from yesterday (00:00 - 23:59)
      const { start, end, dateString } = getYesterdayRange(timezone);
      
      const yesterdayVideos = videoDocuments.filter(video => {
        if (!video.createTimeISO) return false;
        const videoDate = new Date(video.createTimeISO);
        return videoDate >= start && videoDate <= end;
      });

      logInfo(
        `Filtered by date ${dateString}: ${videoDocuments.length} → ${yesterdayVideos.length} videos from yesterday`
      );

      if (yesterdayVideos.length > 0) {
        const upsertResult = await batchUpsertVideos(yesterdayVideos);
        itemsInserted = upsertResult.inserted;
        itemsUpdated = upsertResult.updated;

        logSuccess(
          `Upserted: ${itemsInserted} new, ${itemsUpdated} updated (from ${dateString})`
        );
      } else {
        logInfo('No videos from yesterday to upsert');
      }
    } else {
      logInfo('Step 6: Skipping upsert (no items)');
    }

    // Step 7: Generate report (only from yesterday's videos)
    logInfo('Step 7: Generating daily report...');
    
    if (itemsFetched > 0) {
      const videoDocuments = items.map((item) =>
        convertTikTokVideoToDocument(item as TikTokVideo, profileHandle, runId!, 'Latest')
      );

      // Filter only videos from yesterday (same filter as Step 6)
      const { start, end, dateString } = getYesterdayRange(timezone);
      
      const yesterdayVideos = videoDocuments.filter(video => {
        if (!video.createTimeISO) return false;
        const videoDate = new Date(video.createTimeISO);
        return videoDate >= start && videoDate <= end;
      });

      const reportDoc = createReportDocument(
        yesterdayVideos as any,
        profileHandle,
        dateString,
        maxPosts
      );

      // Save report to DB
      await saveReport(reportDoc);

      // Save report to file
      await saveReportFile(reportDoc.text, dateString);

      reportGenerated = true;
      logSuccess(`Report generated and saved for ${dateString}`);
    } else {
      logInfo('Step 7: Skipping report generation (no items)');
    }

    // Step 8: Save run record
    logInfo('Step 8: Saving run record...');
    const runRecord: RunDocument = {
      runId: runId!,
      actorId: config.apify.actorId,
      profileHandle,
      startedAt: new Date(Date.now() - (Date.now() - startTime)),
      finishedAt: new Date(),
      status: itemsFetched === 0 ? 'PARTIAL' : 'SUCCEEDED',
      itemsFetched,
      itemsInserted,
      itemsUpdated,
      datasetId,
    };

    await saveRun(runRecord);
    logSuccess('Run record saved');

    // Step 9: Cleanup old backups
    logInfo('Step 9: Cleaning up old backups...');
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
      itemsFetched,
      itemsInserted,
      itemsUpdated,
      reportGenerated,
    });

    return {
      success: true,
      runId,
      itemsFetched,
      itemsInserted,
      itemsUpdated,
      reportGenerated,
    };

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const duration = Date.now() - startTime;

    logError('Pipeline failed', err, {
      runId,
      itemsFetched,
      itemsInserted,
      itemsUpdated,
      duration: formatDuration(duration),
    });

    alertPipelineCrashed(err);

    logPipelineEnd(false, duration, {
      runId,
      itemsFetched,
      itemsInserted,
      itemsUpdated,
      error: err.message,
    });

    // Try to save failed run record
    if (runId) {
      try {
        const runRecord: RunDocument = {
          runId,
          actorId: config.apify.actorId,
          profileHandle,
          startedAt: new Date(Date.now() - duration),
          finishedAt: new Date(),
          status: 'FAILED',
          itemsFetched,
          itemsInserted,
          itemsUpdated,
          error: err.message,
          datasetId: 'unknown',
        };
        await saveRun(runRecord);
      } catch (saveError) {
        logError('Failed to save error run record', saveError as Error);
      }
    }

    return {
      success: false,
      runId,
      itemsFetched,
      itemsInserted,
      itemsUpdated,
      reportGenerated,
      error: err.message,
    };

  } finally {
    // Always disconnect from database
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
