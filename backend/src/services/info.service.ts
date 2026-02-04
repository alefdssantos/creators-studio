/**
 * Video info fetching service with caching and retry
 */

import { v4 as uuidv4 } from 'uuid';
import { Platform } from '../types/platform.types.js';
import { VideoInfoResponse } from '../types/video.types.js';
import { StructuredError } from '../types/error.types.js';
import { ErrorClassifier } from '../errors/error-classifier.js';
import { getProvider } from '../providers/index.js';
import { ytdlpEngine } from '../engines/ytdlp.engine.js';
import { LRUCache } from '../infrastructure/cache.js';
import { TaskQueue } from '../infrastructure/queue.js';
import { circuitBreaker } from '../infrastructure/circuit-breaker.js';
import { metrics } from '../infrastructure/metrics.js';
import { appConfig } from '../config/app.config.js';
import { resilienceConfig } from '../config/resilience.config.js';
import { retryWithBackoff } from '../resilience/retry-with-backoff.js';
import { withTimeout } from '../resilience/timeout-handler.js';
import { logger, logEvents, LogContext } from '../logging/logger.js';

// Initialize cache and queue
const infoCache = new LRUCache<VideoInfoResponse>({
  ttlMs: appConfig.cache.ttlMinutes * 60 * 1000,
  maxSize: appConfig.cache.maxSize,
  name: 'info-cache',
});

import { RetryResult } from '../resilience/retry-with-backoff.js';

const infoQueue = new TaskQueue<RetryResult<VideoInfoResponse>>({
  maxConcurrent: appConfig.queue.maxConcurrentInfo,
  timeout: resilienceConfig.timeout.queueWait,
  name: 'info-queue',
});

export interface InfoFetchOptions {
  skipCache?: boolean;
  timeout?: number;
  requestId?: string;
}

export interface InfoFetchResult {
  success: boolean;
  data?: VideoInfoResponse;
  error?: StructuredError;
  cached: boolean;
  durationMs: number;
}

/**
 * Fetch video info with caching, retry, and circuit breaker
 */
export async function fetchVideoInfo(
  url: string,
  platform: Platform,
  options?: InfoFetchOptions
): Promise<InfoFetchResult> {
  const startTime = Date.now();
  const requestId = options?.requestId || uuidv4();
  const context: LogContext = { requestId, url, platform };

  logEvents.infoFetchStarted(context);

  // Check cache first
  if (!options?.skipCache) {
    const cached = infoCache.get(url);
    if (cached) {
      metrics.recordInfoRequest(true, platform);
      logEvents.infoFetchCompleted(context, {
        durationMs: Date.now() - startTime,
        cached: true,
        title: cached.videoInfo.title,
      });
      return {
        success: true,
        data: cached,
        cached: true,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // Check circuit breaker
  if (!circuitBreaker.canExecute(platform)) {
    metrics.recordInfoFailed();
    const error = ErrorClassifier.classify('Circuit breaker open', {
      platform,
      requestId,
    });
    return {
      success: false,
      error,
      cached: false,
      durationMs: Date.now() - startTime,
    };
  }

  // Queue the request
  try {
    const result = await infoQueue.add(async () => {
      return retryWithBackoff(
        async () => {
          // Fetch from yt-dlp with timeout
          const infoResult = await withTimeout(
            () => ytdlpEngine.getInfo(url, platform),
            {
              timeoutMs: options?.timeout || resilienceConfig.timeout.infoFetch,
              errorMessage: 'Tempo limite excedido ao buscar informações do vídeo',
            }
          );

          if (!infoResult.success || !infoResult.data) {
            const errorMessage = infoResult.error || 'Failed to fetch video info';

            // Check if we need to update yt-dlp
            if (ytdlpEngine.needsUpdate(errorMessage)) {
              logger.info({ ...context }, 'Triggering yt-dlp update');
              await ytdlpEngine.update();
            }

            throw new Error(errorMessage);
          }

          // Parse using provider
          const provider = getProvider(platform);
          const videoInfo = provider.parseVideoInfo(infoResult.data);
          const videoFormats = provider.parseVideoFormats(infoResult.data);
          const audioFormats = provider.parseAudioFormats(infoResult.data);

          // Check if any formats available
          if (videoFormats.length === 0 && audioFormats.length === 0) {
            throw new Error('Nenhum formato disponível para este vídeo');
          }

          const response: VideoInfoResponse = {
            success: true,
            platform,
            videoInfo,
            formats: {
              video: videoFormats,
              audio: audioFormats,
            },
            availableQualities: videoFormats.map(f => f.quality),
            recommendedQuality: provider.getRecommendedQuality(videoFormats),
          };

          return response;
        },
        { ...context, operation: 'fetch_info' },
        {
          maxAttempts: resilienceConfig.retry.maxAttempts,
          onRetry: async (error, _attempt, _delay) => {
            // Try updating yt-dlp if error suggests it
            if (ytdlpEngine.needsUpdate(error.message)) {
              await ytdlpEngine.update();
            }
          },
        }
      );
    });

    if (result.success && result.result) {
      // Record success
      circuitBreaker.recordSuccess(platform);
      metrics.recordInfoRequest(false, platform);

      // Cache the result
      infoCache.set(url, result.result);

      logEvents.infoFetchCompleted(context, {
        durationMs: Date.now() - startTime,
        cached: false,
        title: result.result.videoInfo.title,
      });

      return {
        success: true,
        data: result.result,
        cached: false,
        durationMs: Date.now() - startTime,
      };
    } else {
      // Record failure
      circuitBreaker.recordFailure(platform);
      metrics.recordInfoFailed();

      logEvents.infoFetchFailed(context, {
        error: result.error!,
        attempt: result.attempts,
        maxAttempts: resilienceConfig.retry.maxAttempts,
      });

      return {
        success: false,
        error: result.error,
        cached: false,
        durationMs: Date.now() - startTime,
      };
    }
  } catch (error) {
    circuitBreaker.recordFailure(platform);
    metrics.recordInfoFailed();

    const structuredError = ErrorClassifier.classify(
      error instanceof Error ? error.message : String(error),
      { platform, requestId }
    );

    logEvents.infoFetchFailed(context, {
      error: structuredError,
      attempt: 1,
      maxAttempts: resilienceConfig.retry.maxAttempts,
    });

    return {
      success: false,
      error: structuredError,
      cached: false,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return infoCache.getStats();
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return infoQueue.getStatus();
}

/**
 * Clear cache
 */
export function clearCache() {
  infoCache.clear();
}

export default {
  fetchVideoInfo,
  getCacheStats,
  getQueueStatus,
  clearCache,
};
