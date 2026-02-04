/**
 * Tests for Error Classifier
 *
 * Critical component that classifies yt-dlp errors into structured errors.
 * Must correctly identify error types and retryability.
 */

import { describe, it, expect } from 'vitest'
import { ErrorClassifier } from '../../src/errors/error-classifier.js'
import { ErrorCode, ErrorType } from '../../src/types/error.types.js'
import { Platform } from '../../src/types/platform.types.js'

describe('ErrorClassifier', () => {
  describe('classify', () => {
    describe('Network Errors', () => {
      it('should classify timeout errors as NETWORK_TIMEOUT', () => {
        const messages = [
          'ETIMEDOUT',
          'Connection timeout',
          'Request timed out',
          'Operation timed out'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.NETWORK_TIMEOUT)
          expect(result.type).toBe(ErrorType.NETWORK)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify DNS errors as NETWORK_DNS_FAILURE', () => {
        const messages = [
          'ENOTFOUND',
          'DNS resolution failed',
          'getaddrinfo ENOTFOUND'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.NETWORK_DNS_FAILURE)
          expect(result.type).toBe(ErrorType.NETWORK)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify connection reset as NETWORK_CONNECTION_RESET', () => {
        const messages = [
          'ECONNRESET',
          'Connection reset by peer',
          'connection reset'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.NETWORK_CONNECTION_RESET)
          expect(result.type).toBe(ErrorType.NETWORK)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify unreachable as NETWORK_UNREACHABLE', () => {
        const messages = [
          'ECONNREFUSED',
          'ENETUNREACH'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.NETWORK_UNREACHABLE)
          expect(result.type).toBe(ErrorType.NETWORK)
          expect(result.retryable).toBe(true)
        })
      })
    })

    describe('Platform Errors', () => {
      it('should classify video unavailable as PLATFORM_VIDEO_UNAVAILABLE', () => {
        const messages = [
          'Video unavailable',
          'This video unavailable',
          'video unavailable in your country'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_VIDEO_UNAVAILABLE)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(false)
        })
      })

      it('should classify private video as PLATFORM_VIDEO_PRIVATE', () => {
        const messages = [
          'This video is private',
          'private video',
          'Video is private'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_VIDEO_PRIVATE)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(false)
        })
      })

      it('should classify removed video as PLATFORM_VIDEO_REMOVED', () => {
        const messages = [
          'This video has been removed',
          'Video deleted',
          'Content no longer available'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_VIDEO_REMOVED)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(false)
        })
      })

      it('should classify age restricted as PLATFORM_VIDEO_AGE_RESTRICTED', () => {
        const messages = [
          'Age-restricted content',
          'Sign in to confirm your age',
          'age restricted video'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_VIDEO_AGE_RESTRICTED)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(false)
        })
      })

      it('should classify rate limited as PLATFORM_RATE_LIMITED (retryable)', () => {
        const messages = [
          'HTTP Error 429',
          'Too many requests',
          'Rate limit exceeded'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_RATE_LIMITED)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify blocked as PLATFORM_BLOCKED (retryable)', () => {
        const messages = [
          'HTTP Error 403',
          'Access forbidden',
          'Request blocked'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_BLOCKED)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify geo restricted as PLATFORM_GEO_RESTRICTED', () => {
        const messages = [
          'Geo-restricted content',
          'Not available in your country'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.PLATFORM_GEO_RESTRICTED)
          expect(result.type).toBe(ErrorType.PLATFORM)
          expect(result.retryable).toBe(false)
        })
      })
    })

    describe('Format Errors', () => {
      it('should classify format not available as FORMAT_NOT_AVAILABLE', () => {
        const messages = [
          'Requested format is not available',
          'No format found',
          'format not available'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.FORMAT_NOT_AVAILABLE)
          expect(result.type).toBe(ErrorType.FORMAT)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify extraction failed as FORMAT_EXTRACTION_FAILED', () => {
        const messages = [
          'Unable to extract video data',
          'Extraction failed'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.FORMAT_EXTRACTION_FAILED)
          expect(result.type).toBe(ErrorType.FORMAT)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify merge failed as FORMAT_MERGE_FAILED', () => {
        const messages = [
          'ffmpeg error',
          'Merge failed',
          'mux error'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.FORMAT_MERGE_FAILED)
          expect(result.type).toBe(ErrorType.FORMAT)
          expect(result.retryable).toBe(true)
        })
      })
    })

    describe('Internal Errors', () => {
      it('should classify yt-dlp update needed', () => {
        const messages = [
          'Please report this issue',
          'Unsupported URL',
          'Unable to download webpage'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.INTERNAL_YTDLP_UPDATE_NEEDED)
          expect(result.type).toBe(ErrorType.INTERNAL)
          expect(result.retryable).toBe(true)
        })
      })

      it('should classify yt-dlp not found', () => {
        const messages = [
          'yt-dlp not found',
          'command not found: yt-dlp'
        ]

        messages.forEach(msg => {
          const result = ErrorClassifier.classify(msg)
          expect(result.code).toBe(ErrorCode.INTERNAL_YTDLP_NOT_FOUND)
          expect(result.type).toBe(ErrorType.INTERNAL)
          expect(result.retryable).toBe(false)
        })
      })
    })

    describe('Unknown Errors', () => {
      it('should classify unknown errors as INTERNAL_UNKNOWN', () => {
        const result = ErrorClassifier.classify('Some random error that does not match any pattern')
        expect(result.code).toBe(ErrorCode.INTERNAL_UNKNOWN)
        expect(result.type).toBe(ErrorType.INTERNAL)
        expect(result.retryable).toBe(false)
      })
    })

    describe('Context', () => {
      it('should include platform in error', () => {
        const result = ErrorClassifier.classify('Video unavailable', { platform: Platform.YOUTUBE })
        expect(result.platform).toBe(Platform.YOUTUBE)
      })

      it('should include requestId in error', () => {
        const result = ErrorClassifier.classify('Error', { requestId: 'test-123' })
        expect(result.requestId).toBe('test-123')
      })

      it('should include attempts in error', () => {
        const result = ErrorClassifier.classify('Error', { attempts: 3 })
        expect(result.attempts).toBe(3)
      })

      it('should include cause in error', () => {
        const result = ErrorClassifier.classify('Video unavailable')
        expect(result.cause).toBe('Video unavailable')
      })

      it('should include timestamp', () => {
        const before = new Date().toISOString()
        const result = ErrorClassifier.classify('Error')
        const after = new Date().toISOString()

        expect(result.timestamp).toBeDefined()
        expect(result.timestamp >= before).toBe(true)
        expect(result.timestamp <= after).toBe(true)
      })
    })
  })

  describe('isRetryable', () => {
    it('should return true for retryable errors', () => {
      expect(ErrorClassifier.isRetryable('ETIMEDOUT')).toBe(true)
      expect(ErrorClassifier.isRetryable('HTTP Error 429')).toBe(true)
      expect(ErrorClassifier.isRetryable('format not available')).toBe(true)
    })

    it('should return false for non-retryable errors', () => {
      expect(ErrorClassifier.isRetryable('Video is private')).toBe(false)
      expect(ErrorClassifier.isRetryable('Video removed')).toBe(false)
      expect(ErrorClassifier.isRetryable('Age restricted')).toBe(false)
    })
  })

  describe('needsYtDlpUpdate', () => {
    it('should detect when yt-dlp update is needed', () => {
      expect(ErrorClassifier.needsYtDlpUpdate('Unable to extract')).toBe(true)
      expect(ErrorClassifier.needsYtDlpUpdate('Please report this issue')).toBe(true)
      expect(ErrorClassifier.needsYtDlpUpdate('HTTP Error 403')).toBe(true)
      expect(ErrorClassifier.needsYtDlpUpdate('Sign in to confirm')).toBe(true)
    })

    it('should return false for errors that do not need update', () => {
      expect(ErrorClassifier.needsYtDlpUpdate('Video is private')).toBe(false)
      expect(ErrorClassifier.needsYtDlpUpdate('Connection timeout')).toBe(false)
    })
  })

  describe('humanizeMessage', () => {
    it('should return user-friendly messages', () => {
      const networkError = ErrorClassifier.classify('ETIMEDOUT')
      expect(ErrorClassifier.humanizeMessage('ETIMEDOUT')).toBe('Conexão expirou. Tente novamente.')

      const privateError = ErrorClassifier.classify('Video is private')
      expect(ErrorClassifier.humanizeMessage('Video is private')).toBe('Este vídeo é privado.')
    })
  })
})
