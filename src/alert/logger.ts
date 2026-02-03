/**
 * Winston-based logging and alert system
 */

import winston from 'winston';
import * as fs from 'fs/promises';
import * as path from 'path';

const LOG_DIR = 'logs';

// Ensure log directory exists
async function ensureLogDir(): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error);
  }
}

// Initialize log directory
await ensureLogDir();

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Write all logs to app.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// Add console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

/**
 * Alert conditions and levels
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AlertContext {
  runId?: string;
  profileHandle?: string;
  itemsFetched?: number;
  errorMessage?: string;
  [key: string]: any;
}

/**
 * Send alert with context
 */
export function sendAlert(
  level: AlertLevel,
  message: string,
  context?: AlertContext
): void {
  const logData = {
    alert: true,
    level,
    message,
    ...context,
  };

  switch (level) {
    case AlertLevel.CRITICAL:
    case AlertLevel.ERROR:
      logger.error(message, logData);
      break;
    case AlertLevel.WARNING:
      logger.warn(message, logData);
      break;
    default:
      logger.info(message, logData);
  }

  // Console output for immediate visibility
  const prefix = level === AlertLevel.ERROR || level === AlertLevel.CRITICAL ? '🚨' : '⚠️';
  console.log(`${prefix} [${level.toUpperCase()}] ${message}`);
  if (context) {
    console.log('Context:', JSON.stringify(context, null, 2));
  }
}

/**
 * Alert: No results fetched
 */
export function alertNoResults(runId: string, profileHandle: string): void {
  sendAlert(
    AlertLevel.ERROR,
    'Scraper returned ZERO results',
    {
      runId,
      profileHandle,
      itemsFetched: 0,
      reason: 'No videos found in the specified time window',
    }
  );
}

/**
 * Alert: Low results (suspicious)
 */
export function alertLowResults(
  runId: string,
  profileHandle: string,
  count: number,
  threshold: number = 10
): void {
  sendAlert(
    AlertLevel.WARNING,
    `Scraper returned suspiciously few results: ${count} (threshold: ${threshold})`,
    {
      runId,
      profileHandle,
      itemsFetched: count,
      threshold,
    }
  );
}

/**
 * Alert: Apify run failed
 */
export function alertApifyFailed(
  runId: string,
  status: string,
  error?: string
): void {
  sendAlert(
    AlertLevel.ERROR,
    `Apify run failed with status: ${status}`,
    {
      runId,
      status,
      errorMessage: error,
    }
  );
}

/**
 * Alert: Database connection failed
 */
export function alertDatabaseFailed(error: Error): void {
  sendAlert(
    AlertLevel.CRITICAL,
    'Database connection failed',
    {
      errorMessage: error.message,
      stack: error.stack,
    }
  );
}

/**
 * Alert: Database operation failed
 */
export function alertDatabaseOperationFailed(
  operation: string,
  error: Error
): void {
  sendAlert(
    AlertLevel.ERROR,
    `Database operation failed: ${operation}`,
    {
      operation,
      errorMessage: error.message,
      stack: error.stack,
    }
  );
}

/**
 * Alert: Pipeline crashed
 */
export function alertPipelineCrashed(error: Error, stage?: string): void {
  sendAlert(
    AlertLevel.CRITICAL,
    `Pipeline crashed${stage ? ` at stage: ${stage}` : ''}`,
    {
      stage,
      errorMessage: error.message,
      stack: error.stack,
    }
  );
}

/**
 * Log info message
 */
export function logInfo(message: string, meta?: any): void {
  logger.info(message, meta);
}

/**
 * Log warning message
 */
export function logWarning(message: string, meta?: any): void {
  logger.warn(message, meta);
}

/**
 * Log error message
 */
export function logError(message: string, error?: Error, meta?: any): void {
  logger.error(message, {
    ...meta,
    error: error?.message,
    stack: error?.stack,
  });
}

/**
 * Log success message
 */
export function logSuccess(message: string, meta?: any): void {
  logger.info(`✅ ${message}`, { success: true, ...meta });
  console.log(`✅ ${message}`);
}

/**
 * Log pipeline start
 */
export function logPipelineStart(profileHandle: string): void {
  const message = `Starting daily scraping pipeline for @${profileHandle}`;
  logger.info(message, { event: 'pipeline_start', profileHandle });
  console.log(`\n🚀 ${message}\n`);
}

/**
 * Log pipeline end
 */
export function logPipelineEnd(
  success: boolean,
  duration: number,
  summary: any
): void {
  const message = success
    ? `Pipeline completed successfully in ${(duration / 1000).toFixed(2)}s`
    : `Pipeline failed after ${(duration / 1000).toFixed(2)}s`;

  logger.info(message, {
    event: 'pipeline_end',
    success,
    duration,
    ...summary,
  });

  const emoji = success ? '✅' : '❌';
  console.log(`\n${emoji} ${message}\n`);
}

export default logger;
