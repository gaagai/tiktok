/**
 * Configuration loader and validator
 */

import { config as dotenvConfig } from 'dotenv';
import { Config } from '../types/index.js';

// Load .env file
dotenvConfig();

/**
 * Get environment variable with validation
 */
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get numeric environment variable
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return parsed;
}

/**
 * Load email configuration (optional)
 */
function loadEmailConfig(): Config['email'] | undefined {
  const provider = process.env.EMAIL_PROVIDER;
  
  // If EMAIL_PROVIDER is not set, email is disabled
  if (!provider || provider !== 'brevo') {
    return undefined;
  }

  // If provider is set, all email fields are required
  return {
    provider,
    brevoApiKey: getEnv('BREVO_API_KEY'),
    from: getEnv('EMAIL_FROM'),
    fromName: getEnv('EMAIL_FROM_NAME'),
    to: getEnv('EMAIL_TO'),
    cc: process.env.EMAIL_TO_CC,
    bcc: process.env.EMAIL_TO_BCC,
    subjectPrefix: getEnv('EMAIL_SUBJECT_PREFIX', '[דוח טיקטוק יומי]'),
  };
}

/**
 * Load and validate configuration
 */
export function loadConfig(): Config {
  return {
    apify: {
      token: getEnv('APIFY_TOKEN'),
      primaryActorId: getEnv('PRIMARY_ACTOR_ID', 'apidojo/tiktok-profile-scraper'),
      fallbackActorId: getEnv('FALLBACK_ACTOR_ID', 'clockworks/tiktok-profile-scraper'),
    },
    mongodb: {
      uri: getEnv('MONGODB_URI'),
    },
    scraper: {
      profileHandle: getEnv('PROFILE_HANDLE', 'success_israel'),
      maxPosts: getEnvNumber('MAX_POSTS', 40),
      windowHours: 24, // Always 24 hours (yesterday), kept for backward compatibility
      timezone: getEnv('TIMEZONE', 'Asia/Jerusalem'),
      lowResultsThreshold: getEnvNumber('LOW_RESULTS_THRESHOLD', 10),
    },
    system: {
      nodeEnv: getEnv('NODE_ENV', 'development'),
      logLevel: getEnv('LOG_LEVEL', 'info'),
      backupRetentionDays: getEnvNumber('BACKUP_RETENTION_DAYS', 14),
      runTimeoutMinutes: getEnvNumber('RUN_TIMEOUT_MINUTES', 12),
      pollIntervalSeconds: getEnvNumber('POLL_INTERVAL_SECONDS', 10),
      maxRetries: getEnvNumber('MAX_RETRIES', 3),
      lockTtlMinutes: getEnvNumber('LOCK_TTL_MINUTES', 45),
    },
    circuitBreaker: {
      fallbackMaxPer48Hours: getEnvNumber('FALLBACK_MAX_PER_48H', 1),
    },
    dataQuality: {
      maxMissingCreateTimePct: parseFloat(getEnv('MAX_MISSING_CREATETIME_PCT', '0.3')),
      maxMissingUrlPct: parseFloat(getEnv('MAX_MISSING_URL_PCT', '0.3')),
    },
    email: loadEmailConfig(),
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): void {
  // Validate Apify token format
  if (!config.apify.token.startsWith('apify_api_')) {
    throw new Error('Invalid APIFY_TOKEN format. Must start with "apify_api_"');
  }

  // Validate MongoDB URI format
  if (!config.mongodb.uri.startsWith('mongodb://') && 
      !config.mongodb.uri.startsWith('mongodb+srv://')) {
    throw new Error('Invalid MONGODB_URI format. Must start with "mongodb://" or "mongodb+srv://"');
  }

  // Validate numeric ranges
  if (config.scraper.maxPosts < 1 || config.scraper.maxPosts > 200) {
    throw new Error('MAX_POSTS must be between 1 and 200');
  }

  if (config.system.backupRetentionDays < 1 || config.system.backupRetentionDays > 365) {
    throw new Error('BACKUP_RETENTION_DAYS must be between 1 and 365');
  }

  if (config.scraper.lowResultsThreshold < 1) {
    throw new Error('LOW_RESULTS_THRESHOLD must be at least 1');
  }

  if (config.system.runTimeoutMinutes < 1 || config.system.runTimeoutMinutes > 60) {
    throw new Error('RUN_TIMEOUT_MINUTES must be between 1 and 60');
  }

  if (config.system.pollIntervalSeconds < 1 || config.system.pollIntervalSeconds > 60) {
    throw new Error('POLL_INTERVAL_SECONDS must be between 1 and 60');
  }

  if (config.system.maxRetries < 1 || config.system.maxRetries > 10) {
    throw new Error('MAX_RETRIES must be between 1 and 10');
  }

  if (config.circuitBreaker.fallbackMaxPer48Hours < 0 || config.circuitBreaker.fallbackMaxPer48Hours > 10) {
    throw new Error('FALLBACK_MAX_PER_48H must be between 0 and 10');
  }

  // Validate lock TTL
  if (config.system.lockTtlMinutes < 10 || config.system.lockTtlMinutes > 120) {
    throw new Error('LOCK_TTL_MINUTES must be between 10 and 120');
  }

  // Validate data quality thresholds
  if (config.dataQuality.maxMissingCreateTimePct < 0 || config.dataQuality.maxMissingCreateTimePct > 1) {
    throw new Error('MAX_MISSING_CREATETIME_PCT must be between 0 and 1');
  }

  if (config.dataQuality.maxMissingUrlPct < 0 || config.dataQuality.maxMissingUrlPct > 1) {
    throw new Error('MAX_MISSING_URL_PCT must be between 0 and 1');
  }

  // Validate email configuration (if enabled)
  if (config.email) {
    if (config.email.provider !== 'brevo') {
      throw new Error('Only EMAIL_PROVIDER=brevo is supported');
    }

    // Validate EMAIL_FROM domain (should match vai.co.il or verified domain)
    if (!config.email.from.includes('@')) {
      throw new Error('EMAIL_FROM must be a valid email address');
    }

    // Validate EMAIL_TO format
    if (!config.email.to.includes('@')) {
      throw new Error('EMAIL_TO must contain valid email address(es)');
    }

    // Validate BREVO_API_KEY is not empty
    if (config.email.brevoApiKey.length < 10) {
      throw new Error('BREVO_API_KEY appears to be invalid (too short)');
    }
  }
}

/**
 * Get singleton config instance
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
    validateConfig(configInstance);
  }
  return configInstance;
}
