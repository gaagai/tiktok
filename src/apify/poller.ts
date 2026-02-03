/**
 * Apify run polling utilities
 */

import { ApifyClient } from './client.js';
import { ApifyRunStatus } from './types.js';
import { logInfo, logWarning } from '../alert/logger.js';

export interface PollingOptions {
  maxAttempts?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onProgress?: (status: ApifyRunStatus, attempt: number) => void;
}

const defaultPollingOptions: Required<PollingOptions> = {
  maxAttempts: 120, // 10 minutes at 5s intervals
  pollIntervalMs: 5000,
  timeoutMs: 600000, // 10 minutes
  onProgress: () => {},
};

/**
 * Poll for run completion with configurable options
 */
export async function pollRunCompletion(
  client: ApifyClient,
  runId: string,
  options: PollingOptions = {}
): Promise<ApifyRunStatus> {
  const opts = { ...defaultPollingOptions, ...options };
  const startTime = Date.now();
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    attempt++;

    // Check timeout
    if (Date.now() - startTime > opts.timeoutMs) {
      throw new Error(
        `Polling timed out after ${opts.timeoutMs}ms (${attempt} attempts)`
      );
    }

    try {
      // Get current status
      const statusResponse = await client.getRunStatus(runId);
      const status = statusResponse.data.status;

      // Log progress
      logInfo(`Poll attempt ${attempt}: Run ${runId} status = ${status}`);
      opts.onProgress(status, attempt);

      // Check for terminal states
      if (isTerminalStatus(status)) {
        if (status === 'SUCCEEDED') {
          logInfo(`✅ Run ${runId} completed successfully after ${attempt} polls`);
        } else {
          logWarning(`Run ${runId} ended with status: ${status}`);
        }
        return status;
      }

      // Wait before next poll
      if (attempt < opts.maxAttempts) {
        await sleep(opts.pollIntervalMs);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logWarning(`Polling error on attempt ${attempt}: ${err.message}`);

      // If we're close to the limit, throw
      if (attempt >= opts.maxAttempts - 1) {
        throw err;
      }

      // Otherwise, wait and retry
      await sleep(opts.pollIntervalMs);
    }
  }

  throw new Error(
    `Max polling attempts (${opts.maxAttempts}) reached without terminal status`
  );
}

/**
 * Check if status is terminal (run has finished)
 */
export function isTerminalStatus(status: ApifyRunStatus): boolean {
  return (
    status === 'SUCCEEDED' ||
    status === 'FAILED' ||
    status === 'TIMED-OUT' ||
    status === 'ABORTED'
  );
}

/**
 * Check if status is successful
 */
export function isSuccessStatus(status: ApifyRunStatus): boolean {
  return status === 'SUCCEEDED';
}

/**
 * Check if status is failure
 */
export function isFailureStatus(status: ApifyRunStatus): boolean {
  return (
    status === 'FAILED' ||
    status === 'TIMED-OUT' ||
    status === 'ABORTED'
  );
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Advanced polling with exponential backoff
 */
export async function pollWithBackoff(
  client: ApifyClient,
  runId: string,
  options: PollingOptions = {}
): Promise<ApifyRunStatus> {
  const opts = { ...defaultPollingOptions, ...options };
  const startTime = Date.now();
  let attempt = 0;
  let backoffMs = opts.pollIntervalMs;

  while (attempt < opts.maxAttempts) {
    attempt++;

    if (Date.now() - startTime > opts.timeoutMs) {
      throw new Error(`Polling timed out after ${opts.timeoutMs}ms`);
    }

    try {
      const statusResponse = await client.getRunStatus(runId);
      const status = statusResponse.data.status;

      opts.onProgress(status, attempt);

      if (isTerminalStatus(status)) {
        return status;
      }

      // Reset backoff on successful poll
      backoffMs = opts.pollIntervalMs;

      await sleep(backoffMs);
    } catch (error) {
      // Exponential backoff on error
      backoffMs = Math.min(backoffMs * 2, 30000); // Max 30s
      logWarning(`Polling error, backing off to ${backoffMs}ms: ${error}`);

      if (attempt >= opts.maxAttempts - 1) {
        throw error;
      }

      await sleep(backoffMs);
    }
  }

  throw new Error(`Max polling attempts reached: ${opts.maxAttempts}`);
}
