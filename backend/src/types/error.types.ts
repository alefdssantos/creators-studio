/**
 * Structured error types for consistent error handling
 */

import { Platform } from './platform.types.js';

export enum ErrorCode {
  // Network errors (retryable)
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  NETWORK_DNS_FAILURE = 'NETWORK_DNS_FAILURE',
  NETWORK_CONNECTION_RESET = 'NETWORK_CONNECTION_RESET',

  // Platform errors (mostly not retryable)
  PLATFORM_VIDEO_UNAVAILABLE = 'PLATFORM_VIDEO_UNAVAILABLE',
  PLATFORM_VIDEO_PRIVATE = 'PLATFORM_VIDEO_PRIVATE',
  PLATFORM_VIDEO_REMOVED = 'PLATFORM_VIDEO_REMOVED',
  PLATFORM_VIDEO_AGE_RESTRICTED = 'PLATFORM_VIDEO_AGE_RESTRICTED',
  PLATFORM_RATE_LIMITED = 'PLATFORM_RATE_LIMITED',
  PLATFORM_BLOCKED = 'PLATFORM_BLOCKED',
  PLATFORM_AUTH_REQUIRED = 'PLATFORM_AUTH_REQUIRED',
  PLATFORM_GEO_RESTRICTED = 'PLATFORM_GEO_RESTRICTED',

  // Format errors (may be retryable with fallback)
  FORMAT_NOT_AVAILABLE = 'FORMAT_NOT_AVAILABLE',
  FORMAT_EXTRACTION_FAILED = 'FORMAT_EXTRACTION_FAILED',
  FORMAT_MERGE_FAILED = 'FORMAT_MERGE_FAILED',

  // Download errors
  DOWNLOAD_TIMEOUT = 'DOWNLOAD_TIMEOUT',
  DOWNLOAD_ABORTED = 'DOWNLOAD_ABORTED',
  DOWNLOAD_FILE_TOO_LARGE = 'DOWNLOAD_FILE_TOO_LARGE',
  DOWNLOAD_DURATION_EXCEEDED = 'DOWNLOAD_DURATION_EXCEEDED',
  DOWNLOAD_DISK_FULL = 'DOWNLOAD_DISK_FULL',

  // Validation errors (not retryable)
  VALIDATION_INVALID_URL = 'VALIDATION_INVALID_URL',
  VALIDATION_UNSUPPORTED_PLATFORM = 'VALIDATION_UNSUPPORTED_PLATFORM',
  VALIDATION_MISSING_PARAMETER = 'VALIDATION_MISSING_PARAMETER',

  // Internal errors (may need yt-dlp update)
  INTERNAL_YTDLP_ERROR = 'INTERNAL_YTDLP_ERROR',
  INTERNAL_YTDLP_UPDATE_NEEDED = 'INTERNAL_YTDLP_UPDATE_NEEDED',
  INTERNAL_YTDLP_NOT_FOUND = 'INTERNAL_YTDLP_NOT_FOUND',
  INTERNAL_PROCESS_ERROR = 'INTERNAL_PROCESS_ERROR',
  INTERNAL_UNKNOWN = 'INTERNAL_UNKNOWN',

  // Queue/Rate limit errors
  QUEUE_TIMEOUT = 'QUEUE_TIMEOUT',
  RATE_LIMITED = 'RATE_LIMITED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
}

export enum ErrorType {
  NETWORK = 'network',
  PLATFORM = 'platform',
  FORMAT = 'format',
  DOWNLOAD = 'download',
  VALIDATION = 'validation',
  INTERNAL = 'internal',
  QUEUE = 'queue',
}

export interface StructuredError {
  code: ErrorCode;
  type: ErrorType;
  platform: Platform | null;
  message: string;
  cause: string | null;
  retryable: boolean;
  suggestedAction?: string;
  timestamp: string;
  requestId?: string;
  attempts?: number;
}

export interface ErrorClassification {
  code: ErrorCode;
  type: ErrorType;
  retryable: boolean;
  suggestedAction?: string;
}

// Error patterns for classification
export const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  classification: ErrorClassification;
}> = [
  // Network errors
  {
    pattern: /ETIMEDOUT|timeout|timed out/i,
    classification: {
      code: ErrorCode.NETWORK_TIMEOUT,
      type: ErrorType.NETWORK,
      retryable: true,
      suggestedAction: 'Retry with longer timeout',
    },
  },
  {
    pattern: /ENOTFOUND|DNS|getaddrinfo/i,
    classification: {
      code: ErrorCode.NETWORK_DNS_FAILURE,
      type: ErrorType.NETWORK,
      retryable: true,
      suggestedAction: 'Check DNS or internet connection',
    },
  },
  {
    pattern: /ECONNRESET|connection reset/i,
    classification: {
      code: ErrorCode.NETWORK_CONNECTION_RESET,
      type: ErrorType.NETWORK,
      retryable: true,
      suggestedAction: 'Retry request',
    },
  },
  {
    pattern: /ECONNREFUSED|ENETUNREACH/i,
    classification: {
      code: ErrorCode.NETWORK_UNREACHABLE,
      type: ErrorType.NETWORK,
      retryable: true,
      suggestedAction: 'Check network connectivity',
    },
  },

  // Platform errors
  {
    pattern: /video unavailable|Video unavailable/i,
    classification: {
      code: ErrorCode.PLATFORM_VIDEO_UNAVAILABLE,
      type: ErrorType.PLATFORM,
      retryable: false,
      suggestedAction: 'Video may have been deleted',
    },
  },
  {
    pattern: /private video|is private/i,
    classification: {
      code: ErrorCode.PLATFORM_VIDEO_PRIVATE,
      type: ErrorType.PLATFORM,
      retryable: false,
      suggestedAction: 'Video is private',
    },
  },
  {
    pattern: /removed|deleted|no longer available/i,
    classification: {
      code: ErrorCode.PLATFORM_VIDEO_REMOVED,
      type: ErrorType.PLATFORM,
      retryable: false,
      suggestedAction: 'Video has been removed',
    },
  },
  {
    pattern: /age.?restrict|confirm.?age|sign.?in.?to.?confirm/i,
    classification: {
      code: ErrorCode.PLATFORM_VIDEO_AGE_RESTRICTED,
      type: ErrorType.PLATFORM,
      retryable: false,
      suggestedAction: 'Video requires age verification',
    },
  },
  {
    pattern: /HTTP Error 429|too many requests|rate.?limit/i,
    classification: {
      code: ErrorCode.PLATFORM_RATE_LIMITED,
      type: ErrorType.PLATFORM,
      retryable: true,
      suggestedAction: 'Wait and retry later',
    },
  },
  {
    pattern: /HTTP Error 403|forbidden|blocked/i,
    classification: {
      code: ErrorCode.PLATFORM_BLOCKED,
      type: ErrorType.PLATFORM,
      retryable: true,
      suggestedAction: 'Try different User-Agent or update yt-dlp',
    },
  },
  {
    pattern: /login|sign.?in|authentication/i,
    classification: {
      code: ErrorCode.PLATFORM_AUTH_REQUIRED,
      type: ErrorType.PLATFORM,
      retryable: false,
      suggestedAction: 'Video requires authentication',
    },
  },
  {
    pattern: /geo.?restrict|not available in your country/i,
    classification: {
      code: ErrorCode.PLATFORM_GEO_RESTRICTED,
      type: ErrorType.PLATFORM,
      retryable: false,
      suggestedAction: 'Video is geo-restricted',
    },
  },

  // Format errors
  {
    pattern: /no.?format|format.?not.?available|requested format is not available/i,
    classification: {
      code: ErrorCode.FORMAT_NOT_AVAILABLE,
      type: ErrorType.FORMAT,
      retryable: true,
      suggestedAction: 'Try different quality',
    },
  },
  {
    pattern: /unable to extract|extraction failed/i,
    classification: {
      code: ErrorCode.FORMAT_EXTRACTION_FAILED,
      type: ErrorType.FORMAT,
      retryable: true,
      suggestedAction: 'Update yt-dlp',
    },
  },
  {
    pattern: /merge|mux|ffmpeg/i,
    classification: {
      code: ErrorCode.FORMAT_MERGE_FAILED,
      type: ErrorType.FORMAT,
      retryable: true,
      suggestedAction: 'Check ffmpeg installation',
    },
  },

  // Internal errors - yt-dlp update needed
  {
    pattern: /please report this issue|unsupported URL|unable to download/i,
    classification: {
      code: ErrorCode.INTERNAL_YTDLP_UPDATE_NEEDED,
      type: ErrorType.INTERNAL,
      retryable: true,
      suggestedAction: 'Update yt-dlp and retry',
    },
  },
  {
    pattern: /yt-dlp.*not found|command not found.*yt-dlp/i,
    classification: {
      code: ErrorCode.INTERNAL_YTDLP_NOT_FOUND,
      type: ErrorType.INTERNAL,
      retryable: false,
      suggestedAction: 'Install yt-dlp',
    },
  },
];

export function createStructuredError(
  code: ErrorCode,
  type: ErrorType,
  message: string,
  options?: {
    platform?: Platform;
    cause?: string;
    retryable?: boolean;
    suggestedAction?: string;
    requestId?: string;
    attempts?: number;
  }
): StructuredError {
  return {
    code,
    type,
    platform: options?.platform ?? null,
    message,
    cause: options?.cause ?? null,
    retryable: options?.retryable ?? false,
    suggestedAction: options?.suggestedAction,
    timestamp: new Date().toISOString(),
    requestId: options?.requestId,
    attempts: options?.attempts,
  };
}
