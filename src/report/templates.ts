/**
 * Report text templates
 */

import { VideoDocument } from '../types/index.js';
import { formatDateIsrael, formatDateTimeIsrael } from '../utils/date.js';

/**
 * Format number with commas (e.g., 1,234,567)
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Truncate text to specified length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Generate report header
 */
export function generateReportHeader(
  profileHandle: string,
  reportDate: string,
  targetDate: string, // YYYY-MM-DD of videos (yesterday)
  totalVideos: number,
  timezone: string
): string {
  const reportDateFormatted = formatDateIsrael(reportDate || new Date().toISOString(), timezone);
  const targetDateFormatted = formatDateIsrael(targetDate || new Date().toISOString(), timezone);
  
  return `📊 דוח יומי - TikTok @${profileHandle}
תאריך הרצה: ${reportDateFormatted}
סרטונים מתאריך: ${targetDateFormatted} (אתמול)
סה"כ סרטונים: ${totalVideos}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Generate category section header
 */
export function generateCategoryHeader(categoryName: string, count: number): string {
  return `\n[קטגוריה: ${categoryName}] (${count} סרטונים)\n`;
}

/**
 * Generate single video entry
 */
export function generateVideoEntry(
  video: VideoDocument,
  index: number,
  timezone: string
): string {
  const shortText = truncateText(video.text, 50);
  const fullText = video.text;
  const dateTime = formatDateTimeIsrael(video.createTimeISO, timezone);
  
  const views = formatNumber(video.metrics.playCount);
  const likes = formatNumber(video.metrics.diggCount);
  const comments = formatNumber(video.metrics.commentCount);
  const shares = formatNumber(video.metrics.shareCount);

  return `
${index}. ${shortText}
   טקסט מלא: ${fullText}
   לינק: ${video.webVideoUrl}
   צפיות: ${views} | לייקים: ${likes} | תגובות: ${comments} | שיתופים: ${shares}
   תאריך: ${dateTime}`;
}

/**
 * Generate report footer
 */
export function generateReportFooter(success: boolean = true): string {
  const emoji = success ? '✅' : '⚠️';
  const message = success 
    ? 'הסרטונים נשמרו בהצלחה'
    : 'הדוח הושלם עם אזהרות';
  
  return `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${emoji} ${message}`;
}

/**
 * Generate warning section
 */
export function generateWarningSection(warnings: string[]): string {
  if (warnings.length === 0) return '';
  
  return `\n⚠️  אזהרות:
${warnings.map(w => `   - ${w}`).join('\n')}
`;
}

/**
 * Generate empty report
 */
export function generateEmptyReport(
  profileHandle: string,
  reportDate: string,
  targetDate: string, // YYYY-MM-DD or formatted date string
  timezone: string,
  reason?: string
): string {
  const reportDateFormatted = formatDateIsrael(reportDate || new Date().toISOString(), timezone);
  const targetDateFormatted = formatDateIsrael(targetDate || new Date().toISOString(), timezone);
  const reasonText = reason ? `\nסיבה: ${reason}` : '';
  
  return `📊 דוח יומי - TikTok @${profileHandle}
תאריך הרצה: ${reportDateFormatted}
סרטונים מתאריך: ${targetDateFormatted} (אתמול)
סה"כ סרטונים: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  לא נמצאו סרטונים מיום אתמול${reasonText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Generate summary statistics
 */
export function generateSummaryStats(videos: VideoDocument[]): string {
  if (videos.length === 0) return '';

  const totalViews = videos.reduce((sum, v) => sum + v.metrics.playCount, 0);
  const totalLikes = videos.reduce((sum, v) => sum + v.metrics.diggCount, 0);
  const totalComments = videos.reduce((sum, v) => sum + v.metrics.commentCount, 0);
  const totalShares = videos.reduce((sum, v) => sum + v.metrics.shareCount, 0);

  const avgViews = Math.round(totalViews / videos.length);
  const avgLikes = Math.round(totalLikes / videos.length);

  return `\n📈 סטטיסטיקות:
   סה"כ צפיות: ${formatNumber(totalViews)} (ממוצע: ${formatNumber(avgViews)})
   סה"כ לייקים: ${formatNumber(totalLikes)} (ממוצע: ${formatNumber(avgLikes)})
   סה"כ תגובות: ${formatNumber(totalComments)}
   סה"כ שיתופים: ${formatNumber(totalShares)}
`;
}
