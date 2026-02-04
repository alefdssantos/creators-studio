/**
 * Timeout handling for operations
 */

import { ErrorCode, ErrorType } from '../types/error.types.js';
import { AppError } from '../errors/base.error.js';

export interface TimeoutOptions {
  timeoutMs: number;
  errorMessage?: string;
  onTimeout?: () => void;
}

/**
 * Execute operation with timeout
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, errorMessage, onTimeout } = options;

  return new Promise<T>((resolve, reject) => {
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      if (onTimeout) {
        onTimeout();
      }
      reject(
        new AppError(
          ErrorCode.DOWNLOAD_TIMEOUT,
          ErrorType.DOWNLOAD,
          errorMessage || `Operation timed out after ${timeoutMs}ms`,
          { retryable: true }
        )
      );
    }, timeoutMs);

    operation()
      .then((result) => {
        if (!timedOut) {
          clearTimeout(timeoutId);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!timedOut) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
  });
}

/**
 * Create a cancellable timeout promise
 */
export function createTimeout(timeoutMs: number, message?: string): {
  promise: Promise<never>;
  cancel: () => void;
} {
  let timeoutId: NodeJS.Timeout;

  const promise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new AppError(
          ErrorCode.DOWNLOAD_TIMEOUT,
          ErrorType.DOWNLOAD,
          message || `Timeout after ${timeoutMs}ms`,
          { retryable: true }
        )
      );
    }, timeoutMs);
  });

  return {
    promise,
    cancel: () => clearTimeout(timeoutId),
  };
}

/**
 * Race operation against timeout
 */
export async function raceWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  const timeout = createTimeout(timeoutMs, message);

  try {
    return await Promise.race([operation, timeout.promise]);
  } finally {
    timeout.cancel();
  }
}

/**
 * Create an AbortController that auto-aborts after timeout
 */
export function createAbortableTimeout(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}

export default withTimeout;
