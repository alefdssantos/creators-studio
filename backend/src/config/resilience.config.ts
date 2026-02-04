/**
 * Resilience configuration - retry, timeout, circuit breaker
 */

import { ErrorCode } from '../types/error.types.js';

export const resilienceConfig = {
  retry: {
    maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    initialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY || '1000', 10),
    maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY || '30000', 10),
    backoffFactor: parseFloat(process.env.RETRY_BACKOFF_FACTOR || '2'),
    jitterFactor: parseFloat(process.env.RETRY_JITTER_FACTOR || '0.1'),

    // Errors that should trigger retry
    retryableErrors: [
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_UNREACHABLE,
      ErrorCode.NETWORK_DNS_FAILURE,
      ErrorCode.NETWORK_CONNECTION_RESET,
      ErrorCode.PLATFORM_RATE_LIMITED,
      ErrorCode.PLATFORM_BLOCKED,
      ErrorCode.FORMAT_NOT_AVAILABLE,
      ErrorCode.FORMAT_EXTRACTION_FAILED,
      ErrorCode.INTERNAL_YTDLP_UPDATE_NEEDED,
    ] as ErrorCode[],
  },

  timeout: {
    infoFetch: parseInt(process.env.TIMEOUT_INFO_FETCH || '30000', 10),
    downloadStart: parseInt(process.env.TIMEOUT_DOWNLOAD_START || '60000', 10),
    downloadTotal: parseInt(process.env.TIMEOUT_DOWNLOAD_TOTAL || '1800000', 10),
    updateYtdlp: parseInt(process.env.TIMEOUT_UPDATE_YTDLP || '120000', 10),
    queueWait: parseInt(process.env.TIMEOUT_QUEUE_WAIT || '300000', 10),
  },

  circuitBreaker: {
    enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
    recoveryTime: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIME || '60000', 10),
    halfOpenRequests: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_REQUESTS || '3', 10),
  },

  fallback: {
    enableQualityFallback: process.env.ENABLE_QUALITY_FALLBACK !== 'false',
    enableFormatFallback: process.env.ENABLE_FORMAT_FALLBACK !== 'false',
  },
} as const;

export type ResilienceConfig = typeof resilienceConfig;

// Quality fallback chains - from highest to lowest
export const QUALITY_FALLBACK_CHAINS: Record<string, string[]> = {
  '2160p': ['2160p', '1440p', '1080p', '720p', '480p', '360p'],
  '1440p': ['1440p', '1080p', '720p', '480p', '360p'],
  '1080p': ['1080p', '720p', '480p', '360p', '240p'],
  '720p': ['720p', '480p', '360p', '240p'],
  '480p': ['480p', '360p', '240p', '144p'],
  '360p': ['360p', '240p', '144p'],
  '240p': ['240p', '144p'],
  '144p': ['144p'],
};

export function getQualityFallbackChain(quality: string): string[] {
  return QUALITY_FALLBACK_CHAINS[quality] || [quality, '720p', '480p', '360p'];
}
