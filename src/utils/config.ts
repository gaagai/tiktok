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
 * Load and validate configuration
 */
export function loadConfig(): Config {
  return {
    apify: {
      token: getEnv('APIFY_TOKEN'),
      actorId: getEnv('APIFY_ACTOR_ID', 'clockworks/tiktok-profile-scraper'),
    },
    mongodb: {
      uri: getEnv('MONGODB_URI'),
    },
  scraper: {
    profileHandle: getEnv('PROFILE_HANDLE', 'success_israel'),
    maxPosts: getEnvNumber('MAX_POSTS', 50),
    windowHours: 24, // Always 24 hours (yesterday), kept for backward compatibility
    timezone: getEnv('TIMEZONE', 'Asia/Jerusalem'),
  },
    system: {
      nodeEnv: getEnv('NODE_ENV', 'development'),
      logLevel: getEnv('LOG_LEVEL', 'info'),
      backupRetentionDays: getEnvNumber('BACKUP_RETENTION_DAYS', 14),
    },
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
