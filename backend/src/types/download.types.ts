/**
 * Download request and progress types
 */

import { Platform } from './platform.types.js';
import { StructuredError } from './error.types.js';

export type DownloadType = 'video' | 'audio';
export type AudioExtension = 'mp3' | 'm4a';
export type VideoExtension = 'mp4' | 'webm';

export interface DownloadRequest {
  url: string;
  type: DownloadType;
  quality?: string;
  ext?: string;
}

export interface ValidatedDownloadRequest extends DownloadRequest {
  platform: Platform;
  normalizedUrl: string;
  videoId: string | null;
}

export enum DownloadStatus {
  QUEUED = 'queued',
  VALIDATING = 'validating',
  FETCHING_INFO = 'fetching_info',
  SELECTING_FORMAT = 'selecting_format',
  DOWNLOADING = 'downloading',
  MERGING = 'merging',
  COMPLETED = 'completed',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  ABORTED = 'aborted',
}

export interface AttemptInfo {
  attemptNumber: number;
  startTime: number;
  endTime?: number;
  format?: string;
  quality?: string;
  error?: string;
  userAgent?: string;
}

export interface DownloadProgress {
  downloadId: string;
  progress: number;
  status: DownloadStatus;
  filename?: string;
  downloadUrl?: string;
  error?: StructuredError;
  position?: number;
  startTime: number;
  elapsedMs?: number;
  estimatedRemainingMs?: number;
  attempts: AttemptInfo[];
  currentAttempt?: AttemptInfo;
  platform?: Platform;
  quality?: string;
  type?: DownloadType;
}

export interface DownloadResult {
  success: boolean;
  downloadId: string;
  filename?: string;
  filePath?: string;
  downloadUrl?: string;
  error?: StructuredError;
  duration: number;
  attempts: number;
  finalFormat?: string;
}

export interface DownloadStartResponse {
  downloadId: string;
  status: DownloadStatus;
  position: number;
  message: string;
}

export interface DownloadQueueItem {
  downloadId: string;
  request: ValidatedDownloadRequest;
  progress: DownloadProgress;
  abortController?: AbortController;
  timeoutId?: NodeJS.Timeout;
  resolve: (result: DownloadResult) => void;
  reject: (error: Error) => void;
}
