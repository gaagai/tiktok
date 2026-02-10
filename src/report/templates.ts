/**
 * Report text templates
 */

import { VideoDocument } from '../types/index.js';
import { formatDateIsrael } from '../utils/date.js';

/**
 * Format number with commas (e.g., 1,234,567)
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Generate report header
 */
export function generateReportHeader(
  profileHandle: string,
  reportDate: string,
  targetDate: string, // YYYY-MM-DD of videos (yesterday)
  totalVideos: number,
  timezone: string,
  actorUsed?: 'primary' | 'fallback'
): string {
  const reportDateFormatted = formatDateIsrael(reportDate || new Date().toISOString(), timezone);
  const targetDateFormatted = formatDateIsrael(targetDate || new Date().toISOString(), timezone);
  const actorLine = actorUsed ? `מקור נתונים: ${actorUsed === 'primary' ? 'Primary Actor' : 'Fallback Actor'}\n` : '';
  
  return `📊 דוח יומי - TikTok @${profileHandle}
תאריך הרצה: ${reportDateFormatted}
סרטונים מתאריך: ${targetDateFormatted} (אתמול)
${actorLine}סה"כ סרטונים: ${totalVideos}

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
  index: number
): string {
  const fullText = video.text;

  return `
${index}. ${fullText}
   לינק: ${video.webVideoUrl}`;
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
  reason?: string,
  actorUsed?: 'primary' | 'fallback'
): string {
  const reportDateFormatted = formatDateIsrael(reportDate || new Date().toISOString(), timezone);
  const targetDateFormatted = formatDateIsrael(targetDate || new Date().toISOString(), timezone);
  const reasonText = reason ? `\nסיבה: ${reason}` : '';
  const actorLine = actorUsed ? `מקור נתונים: ${actorUsed === 'primary' ? 'Primary Actor' : 'Fallback Actor'}\n` : '';
  
  return `📊 דוח יומי - TikTok @${profileHandle}
תאריך הרצה: ${reportDateFormatted}
סרטונים מתאריך: ${targetDateFormatted} (אתמול)
${actorLine}סה"כ סרטונים: 0

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
