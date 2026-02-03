/**
 * TikTok Daily Scraper - Entry Point
 * 
 * Production-grade scraper for TikTok profiles with MongoDB storage and daily reports.
 * Runs as a scheduled service using node-cron.
 */

import cron from 'node-cron';
import { runDailyPipeline } from './runDaily.js';
import { logInfo, logError, logSuccess } from './alert/logger.js';
import { getConfig } from './utils/config.js';

/**
 * Execute a scheduled run
 */
async function executeScheduledRun(): Promise<void> {
  const startTime = new Date();
  console.log('\n⏰ Cron job triggered at:', startTime.toISOString());
  logInfo('Scheduled run triggered', { triggeredAt: startTime });

  try {
    const result = await runDailyPipeline();
    
    if (result.success) {
      logSuccess('Scheduled run completed successfully', result);
    } else {
      logError('Scheduled run failed', new Error(result.error || 'Unknown error'), result);
    }
  } catch (error) {
    logError('Scheduled run crashed', error as Error);
    console.error('💥 Scheduled run crashed:', error);
  }
}

/**
 * Main entry point - Scheduler
 */
async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   TikTok Daily Scraper v1.1.0');
  console.log('   Internal Scheduler (node-cron)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const config = getConfig();
  const timezone = config.scraper.timezone;

  logInfo('Scheduler starting', {
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development',
    timezone,
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    logError('Unhandled Rejection', reason as Error, { promise });
    console.error('💥 Unhandled Rejection:', reason);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logError('Uncaught Exception', error);
    console.error('💥 Uncaught Exception:', error);
  });

  // Handle termination signals
  process.on('SIGTERM', () => {
    logInfo('SIGTERM received, shutting down scheduler');
    console.log('\n⚠️  SIGTERM received, shutting down scheduler...\n');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logInfo('SIGINT received, shutting down scheduler');
    console.log('\n⚠️  SIGINT received, shutting down scheduler...\n');
    process.exit(0);
  });

  // Schedule: Run daily at 7:00 AM Israel time
  const cronExpression = '0 7 * * *'; // Every day at 7:00 AM
  
  console.log(`🕐 Scheduling daily scraper:`);
  console.log(`   Schedule: ${cronExpression} (7:00 AM daily)`);
  console.log(`   Timezone: ${timezone}`);
  console.log(`   Profile: ${config.scraper.profileHandle}`);
  console.log('');

  cron.schedule(
    cronExpression,
    executeScheduledRun,
    {
      scheduled: true,
      timezone: timezone,
    }
  );

  logSuccess('Scheduler initialized successfully', {
    schedule: cronExpression,
    timezone,
    nextRun: 'Every day at 7:00 AM',
  });

  console.log('✅ Scheduler is running. Waiting for next execution...');
  console.log('   Press Ctrl+C to stop.\n');

  // Optional: Run immediately on startup if env variable is set
  if (process.env.RUN_ON_STARTUP === 'true') {
    console.log('🚀 RUN_ON_STARTUP=true detected. Running immediately...\n');
    await executeScheduledRun();
  }

  // Keep the process alive
  // The cron task keeps the event loop active
}

// Execute
main().catch((error) => {
  console.error('💥 Fatal error in scheduler:', error);
  logError('Fatal error in scheduler', error);
  process.exit(1);
});
