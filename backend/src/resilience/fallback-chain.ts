/**
 * Fallback chain execution
 */

import { logger, LogContext, logEvents } from '../logging/logger.js';

export interface FallbackOption<T> {
  name: string;
  execute: () => Promise<T>;
  shouldTry?: (previousError?: Error) => boolean;
}

export interface FallbackResult<T> {
  success: boolean;
  result?: T;
  usedFallback: string;
  attemptedFallbacks: string[];
  errors: Array<{ fallback: string; error: string }>;
}

/**
 * Execute a chain of fallback operations
 * Tries each option in order until one succeeds
 */
export async function executeFallbackChain<T>(
  options: FallbackOption<T>[],
  context?: LogContext
): Promise<FallbackResult<T>> {
  const attemptedFallbacks: string[] = [];
  const errors: Array<{ fallback: string; error: string }> = [];
  let previousError: Error | undefined;

  for (const option of options) {
    // Check if this fallback should be tried
    if (option.shouldTry && !option.shouldTry(previousError)) {
      continue;
    }

    attemptedFallbacks.push(option.name);

    try {
      const result = await option.execute();
      return {
        success: true,
        result,
        usedFallback: option.name,
        attemptedFallbacks,
        errors,
      };
    } catch (error) {
      previousError = error instanceof Error ? error : new Error(String(error));
      errors.push({
        fallback: option.name,
        error: previousError.message,
      });

      if (context) {
        logger.debug(
          { ...context, fallback: option.name, error: previousError.message },
          `Fallback "${option.name}" failed, trying next...`
        );
      }
    }
  }

  return {
    success: false,
    usedFallback: '',
    attemptedFallbacks,
    errors,
  };
}

/**
 * Quality fallback chain for downloads
 */
export async function executeQualityFallback<T>(
  qualities: string[],
  executeWithQuality: (quality: string) => Promise<T>,
  context?: LogContext
): Promise<FallbackResult<T>> {
  const options: FallbackOption<T>[] = qualities.map((quality, index) => ({
    name: quality,
    execute: () => {
      if (index > 0 && context) {
        logEvents.qualityFallback(context, {
          from: qualities[index - 1],
          to: quality,
          reason: 'Previous quality failed',
        });
      }
      return executeWithQuality(quality);
    },
  }));

  return executeFallbackChain(options, context);
}

/**
 * Format fallback for downloads
 */
export interface FormatFallbackConfig {
  video: string[];
  audio: string[];
}

export const DEFAULT_FORMAT_FALLBACKS: FormatFallbackConfig = {
  video: ['mp4', 'webm', 'mkv'],
  audio: ['mp3', 'm4a', 'opus', 'ogg'],
};

export async function executeFormatFallback<T>(
  formats: string[],
  executeWithFormat: (format: string) => Promise<T>,
  context?: LogContext
): Promise<FallbackResult<T>> {
  const options: FallbackOption<T>[] = formats.map((format) => ({
    name: format,
    execute: () => executeWithFormat(format),
  }));

  return executeFallbackChain(options, context);
}

export default executeFallbackChain;
