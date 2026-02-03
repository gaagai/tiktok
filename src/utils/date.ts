/**
 * Date and timezone utilities
 */

import { format, subHours, parseISO } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

/**
 * Get current date in specified timezone
 */
export function getCurrentDate(timezone: string = 'Asia/Jerusalem'): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Format date for Israel timezone (DD/MM/YYYY)
 */
export function formatDateIsrael(date: Date | string, timezone: string = 'Asia/Jerusalem'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, 'dd/MM/yyyy');
}

/**
 * Format datetime for Israel timezone (DD/MM HH:mm)
 */
export function formatDateTimeIsrael(date: Date | string, timezone: string = 'Asia/Jerusalem'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return formatInTimeZone(dateObj, timezone, 'dd/MM HH:mm');
}

/**
 * Format date for file names (YYYY-MM-DD)
 */
export function formatDateForFile(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Get ISO string for X hours ago
 */
export function getHoursAgoISO(hours: number): string {
  return subHours(new Date(), hours).toISOString();
}

/**
 * Get date X hours ago
 */
export function getHoursAgo(hours: number): Date {
  return subHours(new Date(), hours);
}

/**
 * Check if date is within window (hours)
 */
export function isWithinWindow(date: Date | string, windowHours: number): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const cutoff = getHoursAgo(windowHours);
  return dateObj >= cutoff;
}

/**
 * Parse ISO string to Date
 */
export function parseISOString(isoString: string): Date {
  return parseISO(isoString);
}

/**
 * Get timestamp in milliseconds
 */
export function getTimestamp(): number {
  return Date.now();
}

/**
 * Get start and end of yesterday in specified timezone
 * Example: if today is 02/02/2026 07:00, returns 01/02/2026 00:00:00 - 23:59:59
 */
export function getYesterdayRange(timezone: string = 'Asia/Jerusalem'): {
  start: Date;
  end: Date;
  dateString: string;
} {
  const now = toZonedTime(new Date(), timezone);
  
  // Yesterday's date
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Start: 00:00:00
  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);
  
  // End: 23:59:59.999
  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);
  
  // Format as YYYY-MM-DD
  const dateString = format(yesterday, 'yyyy-MM-dd');
  
  return { start, end, dateString };
}

/**
 * Check if a date is within yesterday's range
 */
export function isFromYesterday(date: Date | string, timezone: string = 'Asia/Jerusalem'): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const { start, end } = getYesterdayRange(timezone);
  return dateObj >= start && dateObj <= end;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
