/**
 * Exponential backoff retry with jitter
 */

import { resilienceConfig } from '../config/resilience.config.js';
import { ErrorCode, StructuredError } from '../types/error.types.js';
import { logEvents, LogContext } from '../logging/logger.js';
import { ErrorClassifier } from '../errors/error-classifier.js';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterFactor?: number;
  retryableErrors?: ErrorCode[];
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

export interface RetryContext extends LogContext {
  operation: string;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: StructuredError;
  attempts: number;
  totalTimeMs: number;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
  jitterFactor: number
): number {
  // Exponential backoff
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter (randomness to prevent thundering herd)
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Sleep for specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable based on configuration
 */
function isRetryable(error: Error, retryableErrors: ErrorCode[]): boolean {
  const message = error.message || '';
  const classification = ErrorClassifier.getClassification(message);
  return retryableErrors.includes(classification.code);
}

/**
 * Execute operation with retry and exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: RetryContext,
  options?: RetryOptions
): Promise<RetryResult<T>> {
  const config = {
    maxAttempts: options?.maxAttempts ?? resilienceConfig.retry.maxAttempts,
    initialDelayMs: options?.initialDelayMs ?? resilienceConfig.retry.initialDelayMs,
    maxDelayMs: options?.maxDelayMs ?? resilienceConfig.retry.maxDelayMs,
    backoffFactor: options?.backoffFactor ?? resilienceConfig.retry.backoffFactor,
    jitterFactor: options?.jitterFactor ?? resilienceConfig.retry.jitterFactor,
    retryableErrors: options?.retryableErrors ?? resilienceConfig.retry.retryableErrors,
  };

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await operation();
      return {
        success: true,
        result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry =
        attempt < config.maxAttempts &&
        (options?.shouldRetry
          ? options.shouldRetry(lastError, attempt)
          : isRetryable(lastError, config.retryableErrors));

      if (!shouldRetry) {
        break;
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffFactor,
        config.jitterFactor
      );

      // Log retry
      logEvents.retryAttempt(context, {
        attempt,
        maxAttempts: config.maxAttempts,
        delayMs: delay,
        reason: lastError.message,
      });

      // Call onRetry callback if provided
      if (options?.onRetry) {
        options.onRetry(lastError, attempt, delay);
      }

      // Wait before retry
      await sleep(delay);
    }
  }

  // All attempts failed
  const structuredError = ErrorClassifier.classify(lastError?.message || 'Unknown error', {
    platform: context.platform,
    requestId: context.requestId,
    attempts: config.maxAttempts,
  });

  return {
    success: false,
    error: structuredError,
    attempts: config.maxAttempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Simple retry without backoff (for quick operations)
 */
export async function retrySimple<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

export default retryWithBackoff;
