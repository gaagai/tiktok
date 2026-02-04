/**
 * Data Quality validation utilities (v2.1.0)
 * 
 * Purpose:
 * - Distinguish between "no content" and "broken data"
 * - Calculate metrics for missing critical fields
 * - Determine if data quality is acceptable
 * 
 * Metrics:
 * - missingCreateTimePct: percentage of items missing createTimeISO
 * - missingUrlPct: percentage of items missing webVideoUrl
 * 
 * Thresholds:
 * - Configurable via MAX_MISSING_CREATETIME_PCT and MAX_MISSING_URL_PCT
 * - Default: 0.3 (30% tolerance)
 * 
 * Impact:
 * - If thresholds exceeded: triggers DATA_QUALITY_ISSUE warning
 * - May trigger fallback even if itemsInRange == 0
 * - Helps avoid "quiet day" misclassification when data is actually broken
 */

import { NormalizedVideo, DataQualityResult } from '../types/index.js';
import { getConfig } from './config.js';
import { logWarning } from '../alert/logger.js';

/**
 * Calculate data quality metrics from normalized videos
 * 
 * @param normalizedItems - Array of normalized videos (before filtering by date)
 * @param itemsInRange - Number of items after date filtering
 * @returns Data quality result with metrics and issue flag
 */
export function calculateDataQuality(
  normalizedItems: NormalizedVideo[],
  itemsInRange: number
): DataQualityResult {
  const config = getConfig();
  const itemsFetchedRaw = normalizedItems.length;

  // If no items fetched, return zeros (will be handled as technical failure)
  if (itemsFetchedRaw === 0) {
    return {
      missingCreateTimeCount: 0,
      missingUrlCount: 0,
      itemsFetchedRaw: 0,
      itemsInRange: 0,
      missingCreateTimePct: 0,
      missingUrlPct: 0,
      hasIssue: false, // Technical failure, not data quality issue
    };
  }

  // Count missing fields
  let missingCreateTimeCount = 0;
  let missingUrlCount = 0;

  for (const item of normalizedItems) {
    // Check for missing createTimeISO
    if (!item.createTimeISO || item.warningFlags.includes('MISSING_CREATE_TIME')) {
      missingCreateTimeCount++;
    }

    // Check for missing or built URL
    if (!item.webVideoUrl || 
        item.warningFlags.includes('MISSING_VIDEO_URL') ||
        item.warningFlags.includes('URL_BUILT_FROM_ID')) {
      missingUrlCount++;
    }
  }

  // Calculate percentages
  const missingCreateTimePct = missingCreateTimeCount / itemsFetchedRaw;
  const missingUrlPct = missingUrlCount / itemsFetchedRaw;

  // Check if thresholds exceeded
  const maxMissingCreateTimePct = config.dataQuality.maxMissingCreateTimePct;
  const maxMissingUrlPct = config.dataQuality.maxMissingUrlPct;

  const hasIssue = 
    missingCreateTimePct > maxMissingCreateTimePct ||
    missingUrlPct > maxMissingUrlPct;

  // Log warning if issue detected
  if (hasIssue) {
    logWarning('Data Quality Issue detected', {
      itemsFetchedRaw,
      itemsInRange,
      missingCreateTimeCount,
      missingUrlCount,
      missingCreateTimePct: (missingCreateTimePct * 100).toFixed(1) + '%',
      missingUrlPct: (missingUrlPct * 100).toFixed(1) + '%',
      maxMissingCreateTimePct: (maxMissingCreateTimePct * 100).toFixed(1) + '%',
      maxMissingUrlPct: (maxMissingUrlPct * 100).toFixed(1) + '%',
    });
  }

  return {
    missingCreateTimeCount,
    missingUrlCount,
    itemsFetchedRaw,
    itemsInRange,
    missingCreateTimePct,
    missingUrlPct,
    hasIssue,
  };
}

/**
 * Determine if data quality is acceptable for "quiet day" classification
 * 
 * A day can only be classified as a legitimate "quiet day" if:
 * - itemsInRange == 0 (no content in date range)
 * - itemsFetchedRaw > 0 (actor successfully fetched data)
 * - Data quality is good (no excessive missing fields)
 * 
 * @param dataQuality - Data quality result
 * @returns true if data quality is acceptable, false otherwise
 */
export function isDataQualityAcceptable(dataQuality: DataQualityResult): boolean {
  return !dataQuality.hasIssue;
}

/**
 * Get data quality warning flags
 * 
 * @param dataQuality - Data quality result
 * @returns Array of warning flag strings
 */
export function getDataQualityWarnings(dataQuality: DataQualityResult): string[] {
  const warnings: string[] = [];

  if (!dataQuality.hasIssue) {
    return warnings;
  }

  const config = getConfig();

  if (dataQuality.missingCreateTimePct > config.dataQuality.maxMissingCreateTimePct) {
    warnings.push('HIGH_MISSING_CREATETIME');
  }

  if (dataQuality.missingUrlPct > config.dataQuality.maxMissingUrlPct) {
    warnings.push('HIGH_MISSING_URL');
  }

  // General flag
  warnings.push('DATA_QUALITY_ISSUE');

  return warnings;
}
