/**
 * MongoDB connection management
 */

import mongoose from 'mongoose';
import { getConfig } from '../utils/config.js';
import { alertDatabaseFailed, logInfo, logSuccess } from '../alert/logger.js';

let isConnected = false;

/**
 * Connect to MongoDB with retry logic
 */
export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    logInfo('Already connected to MongoDB');
    return;
  }

  const config = getConfig();
  const uri = config.mongodb.uri;

  try {
    logInfo('Connecting to MongoDB...');

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logSuccess('Connected to MongoDB successfully');

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
      alertDatabaseFailed(error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    isConnected = false;
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseFailed(err);
    throw err;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logInfo('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
}

/**
 * Check if connected to MongoDB
 */
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get MongoDB connection instance
 */
export function getConnection() {
  return mongoose.connection;
}
