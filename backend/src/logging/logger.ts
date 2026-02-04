/**
 * Structured logging with pino
 */

import pino from 'pino';
import { appConfig } from '../config/app.config.js';
import { Platform } from '../types/platform.types.js';
import { StructuredError } from '../types/error.types.js';

// Create base logger
const transport = appConfig.logging.pretty
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

export const logger = pino({
  level: appConfig.logging.level,
  transport,
  base: {
    service: 'downloader-backend',
  },
});

// Logger with request context
export interface LogContext {
  requestId?: string;
  downloadId?: string;
  url?: string;
  platform?: Platform;
}

export function createContextLogger(context: LogContext) {
  return logger.child(context);
}

// Typed log helpers
export const logEvents = {
  // Info fetch events
  infoFetchStarted: (context: LogContext) => {
    logger.info({ ...context, event: 'info_fetch_started' }, 'Fetching video info');
  },

  infoFetchCompleted: (
    context: LogContext,
    data: { durationMs: number; cached: boolean; title?: string }
  ) => {
    logger.info(
      { ...context, event: 'info_fetch_completed', ...data },
      `Info fetched${data.cached ? ' (cached)' : ''}: ${data.title || 'unknown'}`
    );
  },

  infoFetchFailed: (
    context: LogContext,
    data: { error: StructuredError; attempt: number; maxAttempts: number }
  ) => {
    logger.error(
      { ...context, event: 'info_fetch_failed', ...data },
      `Info fetch failed (attempt ${data.attempt}/${data.maxAttempts}): ${data.error.message}`
    );
  },

  // Download events
  downloadStarted: (
    context: LogContext,
    data: { format?: string; quality?: string; type: 'video' | 'audio' }
  ) => {
    logger.info(
      { ...context, event: 'download_started', ...data },
      `Download started: ${data.type} ${data.quality || 'best'}`
    );
  },

  downloadProgress: (context: LogContext, data: { progress: number; elapsedMs: number }) => {
    logger.debug(
      { ...context, event: 'download_progress', ...data },
      `Progress: ${Math.round(data.progress)}%`
    );
  },

  downloadCompleted: (
    context: LogContext,
    data: { filename: string; durationMs: number; sizeBytes?: number; attempts: number }
  ) => {
    logger.info(
      { ...context, event: 'download_completed', ...data },
      `Download completed: ${data.filename} (${data.attempts} attempt(s))`
    );
  },

  downloadFailed: (
    context: LogContext,
    data: { error: StructuredError; attempts: number; formatsTried: string[] }
  ) => {
    logger.error(
      { ...context, event: 'download_failed', ...data },
      `Download failed after ${data.attempts} attempts: ${data.error.message}`
    );
  },

  // Retry events
  retryAttempt: (
    context: LogContext,
    data: { attempt: number; maxAttempts: number; delayMs: number; reason: string }
  ) => {
    logger.warn(
      { ...context, event: 'retry_attempt', ...data },
      `Retrying (${data.attempt}/${data.maxAttempts}) in ${data.delayMs}ms: ${data.reason}`
    );
  },

  // Fallback events
  qualityFallback: (
    context: LogContext,
    data: { from: string; to: string; reason: string }
  ) => {
    logger.warn(
      { ...context, event: 'quality_fallback', ...data },
      `Quality fallback: ${data.from} -> ${data.to} (${data.reason})`
    );
  },

  // Circuit breaker events
  circuitBreakerOpened: (data: { platform: Platform; failures: number; threshold: number }) => {
    logger.warn(
      { event: 'circuit_breaker_opened', ...data },
      `Circuit breaker opened for ${data.platform} (${data.failures}/${data.threshold} failures)`
    );
  },

  circuitBreakerClosed: (data: { platform: Platform; recoveryTimeMs: number }) => {
    logger.info(
      { event: 'circuit_breaker_closed', ...data },
      `Circuit breaker closed for ${data.platform}`
    );
  },

  circuitBreakerHalfOpen: (data: { platform: Platform }) => {
    logger.info(
      { event: 'circuit_breaker_half_open', ...data },
      `Circuit breaker half-open for ${data.platform}`
    );
  },

  // yt-dlp events
  ytdlpUpdateStarted: () => {
    logger.info({ event: 'ytdlp_update_started' }, 'Updating yt-dlp');
  },

  ytdlpUpdateCompleted: (data: { method: 'direct' | 'pip'; version?: string }) => {
    logger.info(
      { event: 'ytdlp_update_completed', ...data },
      `yt-dlp updated via ${data.method}`
    );
  },

  ytdlpUpdateFailed: (data: { error: string }) => {
    logger.error({ event: 'ytdlp_update_failed', ...data }, `yt-dlp update failed: ${data.error}`);
  },

  ytdlpHealthCheck: (data: { healthy: boolean; version?: string; error?: string }) => {
    if (data.healthy) {
      logger.info({ event: 'ytdlp_health_check', ...data }, `yt-dlp healthy: v${data.version}`);
    } else {
      logger.error({ event: 'ytdlp_health_check', ...data }, `yt-dlp unhealthy: ${data.error}`);
    }
  },

  // Server events
  serverStarted: (data: { port: number; host: string }) => {
    logger.info({ event: 'server_started', ...data }, `Server started on ${data.host}:${data.port}`);
  },

  serverShutdown: () => {
    logger.info({ event: 'server_shutdown' }, 'Server shutting down');
  },

  // Queue events
  queueStatus: (data: {
    infoQueue: { running: number; queued: number };
    downloadQueue: { running: number; queued: number };
  }) => {
    logger.debug({ event: 'queue_status', ...data }, 'Queue status');
  },

  // Cleanup events
  fileCleanup: (data: { filesRemoved: number }) => {
    if (data.filesRemoved > 0) {
      logger.info({ event: 'file_cleanup', ...data }, `Cleaned up ${data.filesRemoved} files`);
    }
  },

  // Rate limit events
  rateLimited: (context: LogContext, data: { type: 'info' | 'download'; remaining: number }) => {
    logger.warn(
      { ...context, event: 'rate_limited', ...data },
      `Rate limited: ${data.type} requests`
    );
  },
};

export default logger;
