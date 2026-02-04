/**
 * Primary/Fallback Actor orchestration logic
 * 
 * Manages:
 * - Running primary actor
 * - Running fallback actor
 * - Deciding when to trigger fallback
 * - Circuit breaker for cost control
 */

import { getConfig } from './utils/config.js';
import { ApifyClient } from './apify/client.js';
import { Run } from './db/models.js';
import { ActorRunResult, FallbackReason } from './types/index.js';
import { logInfo, logWarning } from './alert/logger.js';

/**
 * Run Primary Actor
 */
export async function runPrimary(
  profileHandle: string,
  maxPosts: number,
  reportDate: string
): Promise<ActorRunResult> {
  const config = getConfig();
  const actorId = config.apify.primaryActorId;

  logInfo(`Running PRIMARY actor: ${actorId}`, { profileHandle, maxPosts, reportDate });

  const client = new ApifyClient(config.apify.token, actorId);
  
  try {
    const result = await client.executeScrapeRun(profileHandle, maxPosts);
    
    return {
      runId: result.runId,
      status: result.status,
      datasetId: result.datasetId,
      items: result.items,
      actorId,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logWarning('Primary actor failed', { error: err.message, actorId });
    
    return {
      runId: 'unknown',
      status: 'FAILED',
      datasetId: 'unknown',
      items: [],
      actorId,
    };
  }
}

/**
 * Run Fallback Actor
 */
export async function runFallback(
  profileHandle: string,
  maxPosts: number,
  reportDate: string
): Promise<ActorRunResult> {
  const config = getConfig();
  const actorId = config.apify.fallbackActorId;

  logInfo(`Running FALLBACK actor: ${actorId}`, { profileHandle, maxPosts, reportDate });

  const client = new ApifyClient(config.apify.token, actorId);
  
  try {
    const result = await client.executeScrapeRun(profileHandle, maxPosts);
    
    return {
      runId: result.runId,
      status: result.status,
      datasetId: result.datasetId,
      items: result.items,
      actorId,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logWarning('Fallback actor failed', { error: err.message, actorId });
    
    return {
      runId: 'unknown',
      status: 'FAILED',
      datasetId: 'unknown',
      items: [],
      actorId,
    };
  }
}

/**
 * Determine if fallback should be triggered
 * 
 * Updated logic (v2.1.0):
 * - Distinguishes between "quiet days" (holidays/Shabbat) and technical failures
 * - Includes Data Quality checks to avoid misclassifying broken data as quiet days
 * 
 * Triggers:
 * 1. Primary run status is FAILED/TIMED-OUT/ABORTED
 * 2. itemsFetchedRaw == 0 (technical issue - API failure/blocking)
 * 3. itemsInRange > 0 but < LOW_RESULTS_THRESHOLD (suspiciously low)
 * 4. itemsInRange == 0 but data quality is poor (broken data, not quiet day)
 * 
 * NOT triggered:
 * - itemsInRange == 0 but itemsFetchedRaw > 0 and status SUCCEEDED and data quality is good
 *   (This is a legitimate "quiet day" - holidays, Shabbat, etc.)
 */
export function shouldFallback(
  status: string,
  itemsFetchedRaw: number,
  itemsInRange: number,
  threshold: number,
  hasDataQualityIssue: boolean = false
): { should: boolean; reason: FallbackReason } {
  // Trigger 1: Run failed (technical failure)
  if (status === 'FAILED' || status === 'TIMED-OUT' || status === 'ABORTED') {
    return { should: true, reason: 'FAILED' };
  }

  // Trigger 2: Zero raw results (API issue/blocking/technical failure)
  if (itemsFetchedRaw === 0) {
    return { should: true, reason: 'ZERO_RESULTS' };
  }

  // Trigger 4: Empty day with data quality issue (v2.1.0)
  // This distinguishes between legitimate quiet days and broken data
  if (itemsInRange === 0 && hasDataQualityIssue) {
    return { should: true, reason: 'ZERO_RESULTS' };
  }

  // NOT a trigger: Quiet day scenario (only if data quality is good)
  // If we fetched data but nothing in date range, it's likely a quiet day (Shabbat, holiday)
  // This is a valid business state, not a technical failure
  if (status === 'SUCCEEDED' && itemsFetchedRaw > 0 && itemsInRange === 0 && !hasDataQualityIssue) {
    return { should: false, reason: null };
  }

  // Trigger 3: Low results (suspicious - primary may have missed content)
  if (itemsInRange > 0 && itemsInRange < threshold) {
    return { should: true, reason: 'LOW_RESULTS' };
  }

  return { should: false, reason: null };
}

/**
 * Check if Circuit Breaker should block fallback
 * 
 * Circuit Breaker Rule:
 * - Count how many times fallback was used in the last 48 hours
 * - If count >= FALLBACK_MAX_PER_48H, block
 * 
 * @param profileHandle - Profile to check
 * @param reportDate - Current report date (YYYY-MM-DD)
 * @returns true if circuit breaker should block fallback
 */
export async function isCircuitBreakerOpen(
  profileHandle: string,
  reportDate: string
): Promise<boolean> {
  const config = getConfig();
  const maxFallbackPer48Hours = config.circuitBreaker.fallbackMaxPer48Hours;

  try {
    // Calculate 48 hours ago from reportDate
    const reportDateObj = new Date(reportDate);
    const fortyEightHoursAgo = new Date(reportDateObj);
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    // Query runs where:
    // - profileHandle matches
    // - actorUsed == 'fallback'
    // - reportDate >= (current reportDate - 48h)
    const fallbackRuns = await Run.countDocuments({
      profileHandle,
      actorUsed: 'fallback',
      reportDate: {
        $gte: fortyEightHoursAgo.toISOString().split('T')[0], // YYYY-MM-DD format
        $lt: reportDate,
      },
    });

    const shouldBlock = fallbackRuns >= maxFallbackPer48Hours;

    if (shouldBlock) {
      logWarning('Circuit Breaker OPEN: Blocking fallback', {
        profileHandle,
        reportDate,
        fallbackRunsIn48h: fallbackRuns,
        maxAllowed: maxFallbackPer48Hours,
      });
    }

    return shouldBlock;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logWarning('Failed to check circuit breaker, allowing fallback', {
      error: err.message,
    });
    // On error, allow fallback (fail-open)
    return false;
  }
}

/**
 * Count fallback runs in the last 48 hours
 * (Helper for debugging)
 */
export async function countFallbackRunsIn48Hours(
  profileHandle: string,
  reportDate: string
): Promise<number> {
  try {
    const reportDateObj = new Date(reportDate);
    const fortyEightHoursAgo = new Date(reportDateObj);
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    return await Run.countDocuments({
      profileHandle,
      actorUsed: 'fallback',
      reportDate: {
        $gte: fortyEightHoursAgo.toISOString().split('T')[0],
        $lt: reportDate,
      },
    });
  } catch (error) {
    logWarning('Failed to count fallback runs', { error });
    return 0;
  }
}
