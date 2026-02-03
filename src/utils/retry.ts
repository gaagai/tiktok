/**
 * Generic retry utility with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  exponentialBase?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  exponentialBase: 2,
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function call
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === opts.maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.exponentialBase, attempt),
        opts.maxDelayMs
      );

      // Call the onRetry callback
      opts.onRetry(lastError, attempt + 1);

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry specifically for network operations
 */
export async function retryNetwork<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelayMs: 2000,
    onRetry: (error, attempt) => {
      console.warn(
        `[Retry] ${operationName} failed (attempt ${attempt}/3): ${error.message}`
      );
    },
  });
}

/**
 * Retry specifically for database operations
 */
export async function retryDatabase<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  return withRetry(fn, {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    onRetry: (error, attempt) => {
      console.warn(
        `[DB Retry] ${operationName} failed (attempt ${attempt}/3): ${error.message}`
      );
    },
  });
}
