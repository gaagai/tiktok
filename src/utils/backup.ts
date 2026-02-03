/**
 * Backup file management and cleanup utilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { formatDateForFile, getHoursAgo } from './date.js';

const BACKUP_DIR = 'backups';

/**
 * Ensure backup directory exists
 */
export async function ensureBackupDir(): Promise<void> {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create backup directory:', error);
    throw error;
  }
}

/**
 * Save data backup as JSON
 */
export async function saveBackup(data: any, filename?: string): Promise<string> {
  await ensureBackupDir();
  
  const backupFilename = filename || `${formatDateForFile()}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);
  
  try {
    await fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Backup saved: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('Failed to save backup:', error);
    throw error;
  }
}

/**
 * Save report text file
 * @param text - Report content
 * @param targetDate - YYYY-MM-DD format for the date of videos (yesterday)
 */
export async function saveReportFile(text: string, targetDate?: string): Promise<string> {
  await ensureBackupDir();
  
  const reportDate = targetDate || formatDateForFile();
  const reportFilename = `report-${reportDate}.txt`;
  const reportPath = path.join(BACKUP_DIR, reportFilename);
  
  try {
    await fs.writeFile(reportPath, text, 'utf-8');
    console.log(`✅ Report saved: ${reportPath}`);
    return reportPath;
  } catch (error) {
    console.error('Failed to save report:', error);
    throw error;
  }
}

/**
 * Clean up old backup files
 */
export async function cleanupOldBackups(retentionDays: number): Promise<number> {
  try {
    await ensureBackupDir();
    
    const files = await fs.readdir(BACKUP_DIR);
    const cutoffDate = getHoursAgo(retentionDays * 24);
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      
      try {
        const stats = await fs.stat(filePath);
        
        // Delete if older than retention period
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`🗑️  Deleted old backup: ${file}`);
        }
      } catch (error) {
        console.warn(`Warning: Could not process file ${file}:`, error);
      }
    }
    
    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old backup file(s)`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Failed to cleanup old backups:', error);
    return 0;
  }
}

/**
 * Get backup file path for a specific date
 */
export function getBackupPath(date?: string): string {
  const backupDate = date || formatDateForFile();
  return path.join(BACKUP_DIR, `${backupDate}.json`);
}

/**
 * Check if backup exists for a specific date
 */
export async function backupExists(date?: string): Promise<boolean> {
  const backupPath = getBackupPath(date);
  try {
    await fs.access(backupPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load backup data from file
 */
export async function loadBackup(date?: string): Promise<any> {
  const backupPath = getBackupPath(date);
  try {
    const data = await fs.readFile(backupPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load backup from ${backupPath}:`, error);
    throw error;
  }
}
