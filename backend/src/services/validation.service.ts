/**
 * URL and input validation service
 */

import { Platform } from '../types/platform.types.js';
import { DownloadRequest, ValidatedDownloadRequest } from '../types/download.types.js';
import { ErrorCode, ErrorType } from '../types/error.types.js';
import { AppError } from '../errors/base.error.js';
import { getProviderFromUrl, detectPlatform } from '../providers/index.js';

export interface UrlValidationResult {
  valid: boolean;
  platform?: Platform;
  videoId?: string | null;
  normalizedUrl?: string;
  error?: AppError;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate and parse URL
 */
export function validateUrl(url: string): UrlValidationResult {
  // Check URL format
  if (!url || typeof url !== 'string') {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_MISSING_PARAMETER,
        ErrorType.VALIDATION,
        'URL é obrigatória'
      ),
    };
  }

  const trimmedUrl = url.trim();

  if (!isValidUrl(trimmedUrl)) {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_INVALID_URL,
        ErrorType.VALIDATION,
        'URL inválida'
      ),
    };
  }

  // Detect platform
  const detection = detectPlatform(trimmedUrl);
  if (!detection) {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_UNSUPPORTED_PLATFORM,
        ErrorType.VALIDATION,
        'Plataforma não suportada. Use YouTube, TikTok ou Twitter/X.'
      ),
    };
  }

  // Get provider and validate
  const provider = getProviderFromUrl(trimmedUrl);
  if (!provider) {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_UNSUPPORTED_PLATFORM,
        ErrorType.VALIDATION,
        'Plataforma não suportada'
      ),
    };
  }

  const validation = provider.validateUrl(trimmedUrl);
  if (!validation.valid) {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_INVALID_URL,
        ErrorType.VALIDATION,
        validation.error || 'URL inválida'
      ),
    };
  }

  return {
    valid: true,
    platform: detection.platform,
    videoId: validation.videoId || detection.videoId,
    normalizedUrl: validation.normalizedUrl || trimmedUrl,
  };
}

/**
 * Validate download request
 */
export function validateDownloadRequest(request: DownloadRequest): {
  valid: boolean;
  validatedRequest?: ValidatedDownloadRequest;
  error?: AppError;
} {
  // Validate URL
  const urlValidation = validateUrl(request.url);
  if (!urlValidation.valid || !urlValidation.platform) {
    return {
      valid: false,
      error: urlValidation.error,
    };
  }

  // Validate type
  if (request.type && !['video', 'audio'].includes(request.type)) {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_MISSING_PARAMETER,
        ErrorType.VALIDATION,
        'Tipo inválido. Use "video" ou "audio".'
      ),
    };
  }

  // Validate audio extension
  if (request.type === 'audio' && request.ext && !['mp3', 'm4a'].includes(request.ext)) {
    return {
      valid: false,
      error: new AppError(
        ErrorCode.VALIDATION_MISSING_PARAMETER,
        ErrorType.VALIDATION,
        'Formato de áudio inválido. Use "mp3" ou "m4a".'
      ),
    };
  }

  const normalizedUrl = urlValidation.normalizedUrl!;

  return {
    valid: true,
    validatedRequest: {
      ...request,
      url: normalizedUrl,
      platform: urlValidation.platform,
      normalizedUrl,
      videoId: urlValidation.videoId ?? null,
    },
  };
}

export default {
  isValidUrl,
  validateUrl,
  validateDownloadRequest,
};
