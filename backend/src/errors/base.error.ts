/**
 * Base error class for structured errors
 */

import { Platform } from '../types/platform.types.js';
import { ErrorCode, ErrorType, StructuredError } from '../types/error.types.js';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly type: ErrorType;
  public readonly platform: Platform | null;
  public readonly cause: string | null;
  public readonly retryable: boolean;
  public readonly suggestedAction?: string;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly attempts?: number;

  constructor(
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
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.type = type;
    this.platform = options?.platform ?? null;
    this.cause = options?.cause ?? null;
    this.retryable = options?.retryable ?? false;
    this.suggestedAction = options?.suggestedAction;
    this.timestamp = new Date().toISOString();
    this.requestId = options?.requestId;
    this.attempts = options?.attempts;

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);
  }

  toStructuredError(): StructuredError {
    return {
      code: this.code,
      type: this.type,
      platform: this.platform,
      message: this.message,
      cause: this.cause,
      retryable: this.retryable,
      suggestedAction: this.suggestedAction,
      timestamp: this.timestamp,
      requestId: this.requestId,
      attempts: this.attempts,
    };
  }

  toJSON() {
    return this.toStructuredError();
  }

  static fromStructuredError(error: StructuredError): AppError {
    return new AppError(error.code, error.type, error.message, {
      platform: error.platform ?? undefined,
      cause: error.cause ?? undefined,
      retryable: error.retryable,
      suggestedAction: error.suggestedAction,
      requestId: error.requestId,
      attempts: error.attempts,
    });
  }
}

// Convenience factory functions
export function createNetworkError(
  code: ErrorCode,
  message: string,
  options?: { platform?: Platform; cause?: string; requestId?: string }
): AppError {
  return new AppError(code, ErrorType.NETWORK, message, {
    ...options,
    retryable: true,
    suggestedAction: 'Check network connection and retry',
  });
}

export function createPlatformError(
  code: ErrorCode,
  message: string,
  platform: Platform,
  options?: { cause?: string; retryable?: boolean; requestId?: string }
): AppError {
  return new AppError(code, ErrorType.PLATFORM, message, {
    platform,
    retryable: options?.retryable ?? false,
    cause: options?.cause,
    requestId: options?.requestId,
  });
}

export function createFormatError(
  code: ErrorCode,
  message: string,
  options?: { platform?: Platform; cause?: string; requestId?: string }
): AppError {
  return new AppError(code, ErrorType.FORMAT, message, {
    ...options,
    retryable: true,
    suggestedAction: 'Try a different quality or format',
  });
}

export function createValidationError(
  code: ErrorCode,
  message: string,
  options?: { cause?: string; requestId?: string }
): AppError {
  return new AppError(code, ErrorType.VALIDATION, message, {
    ...options,
    retryable: false,
  });
}

export function createInternalError(
  code: ErrorCode,
  message: string,
  options?: { cause?: string; retryable?: boolean; requestId?: string }
): AppError {
  return new AppError(code, ErrorType.INTERNAL, message, {
    ...options,
    retryable: options?.retryable ?? false,
  });
}
