/**
 * Report generation logic
 */

import { VideoDocument, ReportDocument } from '../types/index.js';
import { getConfig } from '../utils/config.js';
import { logInfo, logWarning } from '../alert/logger.js';
import {
  generateReportHeader,
  generateCategoryHeader,
  generateVideoEntry,
  generateReportFooter,
  generateWarningSection,
  generateEmptyReport,
  generateSummaryStats,
} from './templates.js';

/**
 * Group videos by category
 */
export function groupVideosByCategory(
  videos: VideoDocument[]
): Map<string, VideoDocument[]> {
  const grouped = new Map<string, VideoDocument[]>();

  for (const video of videos) {
    const category = video.category || 'Latest';
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(video);
  }

  // Sort videos within each category by date (newest first)
  for (const [_category, categoryVideos] of grouped) {
    categoryVideos.sort((a, b) => 
      new Date(b.createTimeISO).getTime() - new Date(a.createTimeISO).getTime()
    );
  }

  return grouped;
}

/**
 * Generate report text from videos
 */
export function generateReportText(
  videos: VideoDocument[],
  profileHandle: string,
  targetDate: string // YYYY-MM-DD format for yesterday
): string {
  const config = getConfig();
  const timezone = config.scraper.timezone;
  const date = new Date().toISOString();

  // Handle empty results
  if (videos.length === 0) {
    logWarning('No videos to include in report');
    return generateEmptyReport(
      profileHandle,
      date,
      targetDate,
      timezone,
      'לא נמצאו סרטונים מיום אתמול'
    );
  }

  // Build report parts
  const parts: string[] = [];
  const warnings: string[] = [];

  // Header
  parts.push(
    generateReportHeader(profileHandle, date, targetDate, videos.length, timezone)
  );

  // Group by category
  const groupedVideos = groupVideosByCategory(videos);

  // Generate sections for each category
  for (const [category, categoryVideos] of groupedVideos) {
    parts.push(generateCategoryHeader(category, categoryVideos.length));

    categoryVideos.forEach((video, index) => {
      parts.push(generateVideoEntry(video, index + 1, timezone));
    });
  }

  // Summary statistics
  parts.push(generateSummaryStats(videos));

  // Warnings section
  if (videos.length < 10) {
    warnings.push(`מספר סרטונים נמוך (${videos.length}) - ייתכן שיש בעיה`);
  }

  if (warnings.length > 0) {
    parts.push(generateWarningSection(warnings));
  }

  // Footer
  parts.push(generateReportFooter(warnings.length === 0));

  return parts.join('\n');
}

/**
 * Create report document
 */
export function createReportDocument(
  videos: VideoDocument[],
  profileHandle: string,
  targetDate: string, // YYYY-MM-DD for yesterday
  maxPosts: number
): ReportDocument {
  const reportText = generateReportText(videos, profileHandle, targetDate);
  const videoIds = videos.map(v => v.videoId);
  
  // Determine status
  let status: 'ok' | 'warning' | 'error' = 'ok';
  let warningMessage: string | undefined;

  if (videos.length === 0) {
    status = 'error';
    warningMessage = `No videos found for ${targetDate}`;
  } else if (videos.length < 5) {
    status = 'warning';
    warningMessage = `Low video count: ${videos.length} for ${targetDate}`;
  }

  const reportDoc: ReportDocument = {
    reportDate: targetDate, // Use yesterday's date, not today
    profileHandle,
    windowHours: 24, // Always 24 hours (yesterday)
    maxPosts,
    generatedAt: new Date(),
    text: reportText,
    videoIds,
    status,
    warningMessage,
  };

  logInfo(`Report generated: ${status} - ${videos.length} videos from ${targetDate}`);

  return reportDoc;
}

/**
 * Filter videos by time window
 */
export function filterVideosByWindow(
  videos: VideoDocument[],
  windowHours: number
): VideoDocument[] {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - windowHours);

  const filtered = videos.filter(video => {
    const videoTime = new Date(video.createTimeISO);
    return videoTime >= cutoffTime;
  });

  logInfo(`Filtered videos: ${videos.length} → ${filtered.length} (window: ${windowHours}h)`);

  return filtered;
}

/**
 * Sort videos by date (newest first)
 */
export function sortVideosByDate(videos: VideoDocument[]): VideoDocument[] {
  return [...videos].sort((a, b) => 
    new Date(b.createTimeISO).getTime() - new Date(a.createTimeISO).getTime()
  );
}

/**
 * Get top videos by engagement
 */
export function getTopVideosByEngagement(
  videos: VideoDocument[],
  limit: number = 10
): VideoDocument[] {
  return [...videos]
    .sort((a, b) => {
      const engagementA = a.metrics.diggCount + a.metrics.commentCount + a.metrics.shareCount;
      const engagementB = b.metrics.diggCount + b.metrics.commentCount + b.metrics.shareCount;
      return engagementB - engagementA;
    })
    .slice(0, limit);
}

/**
 * Calculate report statistics
 */
export interface ReportStats {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgViews: number;
  avgLikes: number;
  categoryCounts: Record<string, number>;
}

export function calculateReportStats(videos: VideoDocument[]): ReportStats {
  const stats: ReportStats = {
    totalVideos: videos.length,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    avgViews: 0,
    avgLikes: 0,
    categoryCounts: {},
  };

  if (videos.length === 0) {
    return stats;
  }

  for (const video of videos) {
    stats.totalViews += video.metrics.playCount;
    stats.totalLikes += video.metrics.diggCount;
    stats.totalComments += video.metrics.commentCount;
    stats.totalShares += video.metrics.shareCount;

    const category = video.category || 'Latest';
    stats.categoryCounts[category] = (stats.categoryCounts[category] || 0) + 1;
  }

  stats.avgViews = Math.round(stats.totalViews / videos.length);
  stats.avgLikes = Math.round(stats.totalLikes / videos.length);

  return stats;
}
