/**
 * Distributed Lock mechanism for preventing concurrent pipeline runs
 * 
 * Purpose:
 * - Prevent multiple cron jobs from running simultaneously
 * - Avoid race conditions and duplicate data
 * - Ensure only one run per profileHandle + reportDate at a time
 * 
 * Implementation:
 * - MongoDB-based lock with TTL
 * - Lock ID format: ${profileHandle}:${reportDate}
 * - Automatic expiry via TTL index
 */

import { Lock } from './models.js';
import { getConfig } from '../utils/config.js';
import { logInfo, logWarning } from '../alert/logger.js';

/**
 * Attempt to acquire a lock for a specific profile + reportDate
 * 
 * @param profileHandle - Profile to lock
 * @param reportDate - Report date (YYYY-MM-DD)
 * @returns true if lock acquired, false if already locked
 */
export async function acquireLock(
  profileHandle: string,
  reportDate: string
): Promise<boolean> {
  const config = getConfig();
  const lockId = `${profileHandle}:${reportDate}`;
  const ttlMinutes = config.system.lockTtlMinutes;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  try {
    // Try to insert lock document
    // If it already exists and hasn't expired, this will fail
    await Lock.create({
      _id: lockId,
      lockedAt: now,
      expiresAt,
    });

    logInfo('Lock acquired successfully', {
      lockId,
      expiresAt: expiresAt.toISOString(),
      ttlMinutes,
    });

    return true;
  } catch (error: any) {
    // Check if it's a duplicate key error (lock already exists)
    if (error.code === 11000) {
      // Lock exists - check if it's expired
      const existingLock = await Lock.findById(lockId);
      
      if (existingLock && existingLock.expiresAt > now) {
        // Lock is still active
        logWarning('Lock is already active - another run is in progress', {
          lockId,
          expiresAt: existingLock.expiresAt.toISOString(),
          lockedAt: existingLock.lockedAt.toISOString(),
        });
        return false;
      } else {
        // Lock expired but TTL hasn't cleaned it yet - remove it manually
        await Lock.findByIdAndDelete(lockId);
        
        // Retry acquisition
        try {
          await Lock.create({
            _id: lockId,
            lockedAt: now,
            expiresAt,
          });
          
          logInfo('Lock acquired after removing expired lock', {
            lockId,
            expiresAt: expiresAt.toISOString(),
          });
          
          return true;
        } catch (retryError) {
          logWarning('Failed to acquire lock on retry', {
            lockId,
            error: retryError instanceof Error ? retryError.message : String(retryError),
          });
          return false;
        }
      }
    }

    // Other error - log and allow run (fail-open)
    logWarning('Lock acquisition failed with unexpected error - allowing run', {
      lockId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true; // Fail-open: allow run on unexpected errors
  }
}

/**
 * Release a lock manually (before expiry)
 * 
 * @param profileHandle - Profile to unlock
 * @param reportDate - Report date (YYYY-MM-DD)
 */
export async function releaseLock(
  profileHandle: string,
  reportDate: string
): Promise<void> {
  const lockId = `${profileHandle}:${reportDate}`;

  try {
    const result = await Lock.findByIdAndDelete(lockId);
    
    if (result) {
      logInfo('Lock released successfully', { lockId });
    } else {
      logInfo('Lock not found (already expired or released)', { lockId });
    }
  } catch (error) {
    logWarning('Failed to release lock', {
      lockId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if a lock exists and is active
 * 
 * @param profileHandle - Profile to check
 * @param reportDate - Report date (YYYY-MM-DD)
 * @returns true if lock is active, false otherwise
 */
export async function isLocked(
  profileHandle: string,
  reportDate: string
): Promise<boolean> {
  const lockId = `${profileHandle}:${reportDate}`;
  const now = new Date();

  try {
    const lock = await Lock.findById(lockId);
    return lock !== null && lock.expiresAt > now;
  } catch (error) {
    logWarning('Failed to check lock status', {
      lockId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false; // Fail-open
  }
}

/**
 * Get all active locks (for debugging)
 */
export async function getActiveLocks(): Promise<Array<{
  lockId: string;
  lockedAt: Date;
  expiresAt: Date;
}>> {
  try {
    const now = new Date();
    const locks = await Lock.find({ expiresAt: { $gt: now } }).lean();
    
    return locks.map((lock) => ({
      lockId: lock._id,
      lockedAt: lock.lockedAt,
      expiresAt: lock.expiresAt,
    }));
  } catch (error) {
    logWarning('Failed to get active locks', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
