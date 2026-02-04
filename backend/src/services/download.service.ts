/**
 * Download orchestration service
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Platform } from '../types/platform.types.js';
import {
  DownloadRequest,
  ValidatedDownloadRequest,
  DownloadProgress,
  DownloadResult,
  DownloadStatus,
  DownloadStartResponse,
  AttemptInfo,
} from '../types/download.types.js';
import { ErrorClassifier } from '../errors/error-classifier.js';
import { getProvider } from '../providers/index.js';
import { ytdlpEngine } from '../engines/ytdlp.engine.js';
import { TaskQueue } from '../infrastructure/queue.js';
import { circuitBreaker } from '../infrastructure/circuit-breaker.js';
import { metrics } from '../infrastructure/metrics.js';
import { appConfig } from '../config/app.config.js';
import { resilienceConfig, getQualityFallbackChain } from '../config/resilience.config.js';
import { logger, logEvents, LogContext } from '../logging/logger.js';
import { validateDownloadRequest } from './validation.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Download directory
const downloadsDir = path.resolve(__dirname, '../../downloads');

// Ensure downloads directory exists
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Initialize queue
const downloadQueue = new TaskQueue<DownloadResult>({
  maxConcurrent: appConfig.queue.maxConcurrentDownloads,
  timeout: resilienceConfig.timeout.downloadTotal,
  name: 'download-queue',
});

// Active downloads tracking
const activeDownloads = new Map<string, DownloadProgress>();

// Download counters
const countersFile = path.resolve(__dirname, '../../download-counters.json');

function loadCounters(): Record<string, number> {
  try {
    if (fs.existsSync(countersFile)) {
      return JSON.parse(fs.readFileSync(countersFile, 'utf8'));
    }
  } catch {
    // Ignore errors
  }
  return { youtube: 0, tiktok: 0, twitter: 0 };
}

function saveCounters(counters: Record<string, number>): void {
  try {
    fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
  } catch {
    // Ignore errors
  }
}

function getNextFilename(platform: Platform): string {
  const counters = loadCounters();
  counters[platform] = (counters[platform] || 0) + 1;
  saveCounters(counters);

  const platformNames: Record<Platform, string> = {
    [Platform.YOUTUBE]: 'youtube-video',
    [Platform.TIKTOK]: 'tiktok-video',
    [Platform.TWITTER]: 'twitter-video',
  };

  return `${platformNames[platform] || 'video'}${counters[platform]}`;
}

/**
 * Start a download
 */
export async function startDownload(request: DownloadRequest): Promise<DownloadStartResponse> {
  // Validate request
  const validation = validateDownloadRequest(request);
  if (!validation.valid || !validation.validatedRequest) {
    throw validation.error;
  }

  const validatedRequest = validation.validatedRequest;
  const downloadId = uuidv4();
  const platform = validatedRequest.platform;

  // Get queue position
  const queueStatus = downloadQueue.getStatus();
  const position = queueStatus.queued + 1;

  // Initialize progress
  const progress: DownloadProgress = {
    downloadId,
    progress: 0,
    status: DownloadStatus.QUEUED,
    position,
    startTime: Date.now(),
    attempts: [],
    platform,
    quality: validatedRequest.quality,
    type: validatedRequest.type,
  };

  activeDownloads.set(downloadId, progress);
  metrics.recordDownloadStart(platform);

  // Queue the download
  const context: LogContext = { downloadId, url: request.url, platform };

  downloadQueue.add(async () => {
    return executeDownload(downloadId, validatedRequest, context);
  }).then(result => {
    // Update final state
    const finalProgress = activeDownloads.get(downloadId);
    if (finalProgress) {
      if (result.success) {
        finalProgress.status = DownloadStatus.COMPLETED;
        finalProgress.progress = 100;
        finalProgress.filename = result.filename;
        finalProgress.downloadUrl = `/downloads/${result.filename}`;
      } else {
        finalProgress.status = DownloadStatus.ERROR;
        finalProgress.error = result.error;
      }
      metrics.recordDownloadComplete(result.success, platform);
    }
  }).catch(error => {
    const finalProgress = activeDownloads.get(downloadId);
    if (finalProgress) {
      finalProgress.status = DownloadStatus.ERROR;
      finalProgress.error = ErrorClassifier.classify(
        error instanceof Error ? error.message : String(error),
        { platform }
      );
      metrics.recordDownloadComplete(false, platform);
    }
  });

  return {
    downloadId,
    status: DownloadStatus.QUEUED,
    position,
    message: position > 1 ? `Você está na posição ${position} da fila` : 'Iniciando download...',
  };
}

/**
 * Execute the actual download
 */
async function executeDownload(
  downloadId: string,
  request: ValidatedDownloadRequest,
  context: LogContext
): Promise<DownloadResult> {
  const startTime = Date.now();
  const platform = request.platform;
  const provider = getProvider(platform);
  const filename = getNextFilename(platform);

  logEvents.downloadStarted(context, {
    format: request.type === 'video' ? 'mp4' : request.ext,
    quality: request.quality,
    type: request.type,
  });

  // Update progress
  const progress = activeDownloads.get(downloadId);
  if (progress) {
    progress.status = DownloadStatus.DOWNLOADING;
    progress.progress = 5;
  }

  // Check circuit breaker
  if (!circuitBreaker.canExecute(platform)) {
    const error = ErrorClassifier.classify('Circuit breaker open', { platform });
    return {
      success: false,
      downloadId,
      error,
      duration: Date.now() - startTime,
      attempts: 0,
    };
  }

  // Execute with quality fallback if enabled
  const qualityChain = request.quality
    ? getQualityFallbackChain(request.quality)
    : [request.quality || '720p'];

  let lastError: string | undefined;
  const attemptInfos: AttemptInfo[] = [];
  let currentQualityIndex = 0;

  for (let attempt = 1; attempt <= resilienceConfig.retry.maxAttempts; attempt++) {
    // Get current quality from fallback chain
    const currentQuality = qualityChain[currentQualityIndex] || qualityChain[qualityChain.length - 1];

    // Build args for current quality attempt
    const currentRequest = { ...request, quality: currentQuality };
    const { args: currentArgs, outputFilename: currentOutputFilename } = provider.buildDownloadArgs(
      currentRequest,
      downloadsDir,
      filename
    );

    const attemptInfo: AttemptInfo = {
      attemptNumber: attempt,
      startTime: Date.now(),
      quality: currentQuality,
    };
    attemptInfos.push(attemptInfo);

    if (progress) {
      progress.attempts = attemptInfos;
      progress.currentAttempt = attemptInfo;
      progress.quality = currentQuality;
    }

    try {
      const result = await new Promise<DownloadResult>((resolve, reject) => {
        const { abort, process: ytdlpProcess } = ytdlpEngine.executeDownload(currentArgs, {
          onProgress: (p) => {
            if (progress) {
              progress.progress = Math.min(95, p.percent);
              progress.elapsedMs = Date.now() - startTime;
            }
            logEvents.downloadProgress(context, {
              progress: p.percent,
              elapsedMs: Date.now() - startTime,
            });
          },
          onComplete: (success, error) => {
            attemptInfo.endTime = Date.now();

            if (success) {
              // Find the actual downloaded file
              const files = fs.readdirSync(downloadsDir);
              const downloadedFile = files.find(f => f.startsWith(filename));
              const finalFilename = downloadedFile || currentOutputFilename;

              circuitBreaker.recordSuccess(platform);

              logEvents.downloadCompleted(context, {
                filename: finalFilename,
                durationMs: Date.now() - startTime,
                attempts: attempt,
              });

              resolve({
                success: true,
                downloadId,
                filename: finalFilename,
                filePath: path.join(downloadsDir, finalFilename),
                downloadUrl: `/downloads/${finalFilename}`,
                duration: Date.now() - startTime,
                attempts: attempt,
              });
            } else {
              attemptInfo.error = error;
              lastError = error;

              // Check if yt-dlp needs update
              if (error && ytdlpEngine.needsUpdate(error)) {
                ytdlpEngine.update().catch(() => {});
              }

              reject(new Error(error || 'Download failed'));
            }
          },
          onStderr: (data) => {
            if (data.includes('ERROR')) {
              logger.debug({ ...context, stderr: data.substring(0, 200) }, 'yt-dlp stderr');
            }
          },
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
          abort();
          reject(new Error('Download timeout'));
        }, resilienceConfig.timeout.downloadTotal);

        ytdlpProcess.on('close', () => {
          clearTimeout(timeoutId);
        });
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = errorMessage;

      // Check if retryable
      const isRetryable = ErrorClassifier.isRetryable(errorMessage);

      // Check if this is a format-related error - try next quality in chain
      const isFormatError = /format.*not.*available|no.*format|requested format/i.test(errorMessage);
      if (isFormatError && currentQualityIndex < qualityChain.length - 1) {
        currentQualityIndex++;
        logger.info(
          { ...context, previousQuality: qualityChain[currentQualityIndex - 1], nextQuality: qualityChain[currentQualityIndex] },
          'Format not available, trying lower quality'
        );
      }

      if (!isRetryable || attempt >= resilienceConfig.retry.maxAttempts) {
        circuitBreaker.recordFailure(platform);
        break;
      }

      // Wait before retry
      const delay = resilienceConfig.retry.initialDelayMs * Math.pow(resilienceConfig.retry.backoffFactor, attempt - 1);
      logEvents.retryAttempt(context, {
        attempt,
        maxAttempts: resilienceConfig.retry.maxAttempts,
        delayMs: delay,
        reason: errorMessage,
      });

      await new Promise(r => setTimeout(r, delay));
    }
  }

  // All attempts failed
  const structuredError = ErrorClassifier.classify(lastError || 'Download failed', {
    platform,
    attempts: attemptInfos.length,
  });

  logEvents.downloadFailed(context, {
    error: structuredError,
    attempts: attemptInfos.length,
    formatsTried: qualityChain.slice(0, attemptInfos.length),
  });

  return {
    success: false,
    downloadId,
    error: structuredError,
    duration: Date.now() - startTime,
    attempts: attemptInfos.length,
  };
}

/**
 * Get download progress
 */
export function getProgress(downloadId: string): DownloadProgress | null {
  return activeDownloads.get(downloadId) || null;
}

/**
 * Get download file path
 */
export function getFilePath(downloadId: string): string | null {
  const progress = activeDownloads.get(downloadId);
  if (!progress || progress.status !== DownloadStatus.COMPLETED || !progress.filename) {
    return null;
  }
  return path.join(downloadsDir, progress.filename);
}

/**
 * Delete download and clean up
 */
export function deleteDownload(downloadId: string): boolean {
  const progress = activeDownloads.get(downloadId);
  if (!progress) return false;

  // Delete file if exists
  if (progress.filename) {
    const filePath = path.join(downloadsDir, progress.filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Ignore errors
    }
  }

  activeDownloads.delete(downloadId);
  return true;
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  return downloadQueue.getStatus();
}

/**
 * Get downloads directory
 */
export function getDownloadsDir(): string {
  return downloadsDir;
}

export default {
  startDownload,
  getProgress,
  getFilePath,
  deleteDownload,
  getQueueStatus,
  getDownloadsDir,
};
