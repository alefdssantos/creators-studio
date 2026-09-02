/**
 * Tests for Validation Service
 *
 * Critical component for validating user input.
 * Must correctly validate URLs, platforms, and download requests.
 */

import { describe, it, expect } from 'vitest'
import {
  validateDownloadRequest,
  isValidUrl,
  validateUrl
} from '../../src/services/validation.service.js'
import { detectPlatform } from '../../src/providers/index.js'
import { Platform } from '../../src/types/platform.types.js'

describe('Validation Service', () => {
  describe('detectPlatform', () => {
    describe('YouTube', () => {
      const youtubeUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/shorts/abc123def45',
        'https://m.youtube.com/watch?v=test1234567',
        'http://youtube.com/embed/test1234567',
      ]

      youtubeUrls.forEach(url => {
        it(`should detect YouTube: ${url}`, () => {
          const result = detectPlatform(url)
          expect(result?.platform).toBe(Platform.YOUTUBE)
        })
      })
    })

    describe('TikTok', () => {
      const tiktokUrls = [
        'https://www.tiktok.com/@user/video/1234567890',
        'https://tiktok.com/@user/video/1234567890',
        'https://vm.tiktok.com/abc123/',
        'https://www.tiktok.com/t/abc123/',
        'https://m.tiktok.com/@user/video/123',
      ]

      tiktokUrls.forEach(url => {
        it(`should detect TikTok: ${url}`, () => {
          const result = detectPlatform(url)
          expect(result?.platform).toBe(Platform.TIKTOK)
        })
      })
    })

    describe('Twitter/X', () => {
      const twitterUrls = [
        'https://twitter.com/user/status/1234567890',
        'https://www.twitter.com/user/status/1234567890',
        'https://x.com/user/status/1234567890',
        'https://www.x.com/user/status/1234567890',
        'https://mobile.twitter.com/user/status/123',
      ]

      twitterUrls.forEach(url => {
        it(`should detect Twitter: ${url}`, () => {
          const result = detectPlatform(url)
          expect(result?.platform).toBe(Platform.TWITTER)
        })
      })
    })

    describe('Unknown/Invalid', () => {
      const invalidUrls = [
        'https://www.vimeo.com/123456',
        'https://www.facebook.com/video/123',
        'https://www.instagram.com/p/abc123/',
        'https://www.google.com',
        'not-a-url',
        '',
        'http://localhost:3000',
      ]

      invalidUrls.forEach(url => {
        it(`should return null for: ${url || '(empty)'}`, () => {
          const result = detectPlatform(url)
          expect(result).toBeNull()
        })
      })
    })
  })

  describe('isValidUrl', () => {
    describe('Valid URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=test',
        'http://example.com',
        'https://sub.domain.example.com/path?query=value',
        'http://localhost:3000',
        'https://192.168.1.1/api',
      ]

      validUrls.forEach(url => {
        it(`should accept: ${url}`, () => {
          expect(isValidUrl(url)).toBe(true)
        })
      })
    })

    describe('Invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://files.example.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '',
        'www.example.com', // Missing protocol
        '//example.com', // Protocol-relative
      ]

      invalidUrls.forEach(url => {
        it(`should reject: ${url || '(empty)'}`, () => {
          expect(isValidUrl(url)).toBe(false)
        })
      })
    })
  })

  describe('validateUrl', () => {
    it('should validate YouTube URL', () => {
      const result = validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

      expect(result.valid).toBe(true)
      expect(result.platform).toBe(Platform.YOUTUBE)
      expect(result.normalizedUrl).toBeDefined()
    })

    it('should reject empty URL', () => {
      const result = validateUrl('')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject invalid URL format', () => {
      const result = validateUrl('not-a-valid-url')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should reject unsupported platform', () => {
      const result = validateUrl('https://www.vimeo.com/123456')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('validateDownloadRequest', () => {
    describe('Valid Requests', () => {
      it('should accept valid YouTube video request', () => {
        const result = validateDownloadRequest({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          type: 'video',
          quality: '720p'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest).toBeDefined()
        expect(result.validatedRequest?.platform).toBe(Platform.YOUTUBE)
      })

      it('should accept valid audio request', () => {
        const result = validateDownloadRequest({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          type: 'audio',
          ext: 'mp3'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.type).toBe('audio')
        expect(result.validatedRequest?.ext).toBe('mp3')
      })

      it('should accept valid TikTok request', () => {
        const result = validateDownloadRequest({
          url: 'https://www.tiktok.com/@user/video/1234567890',
          type: 'video'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.platform).toBe(Platform.TIKTOK)
      })

      it('should accept valid Twitter request', () => {
        const result = validateDownloadRequest({
          url: 'https://twitter.com/user/status/1234567890',
          type: 'video'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.platform).toBe(Platform.TWITTER)
      })
    })

    describe('Invalid Requests', () => {
      it('should reject missing URL', () => {
        const result = validateDownloadRequest({
          url: '',
          type: 'video'
        })

        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('should reject invalid URL format', () => {
        const result = validateDownloadRequest({
          url: 'not-a-valid-url',
          type: 'video'
        })

        expect(result.valid).toBe(false)
      })

      it('should reject unsupported platform', () => {
        const result = validateDownloadRequest({
          url: 'https://www.vimeo.com/123456',
          type: 'video'
        })

        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
      })

      it('should reject invalid type', () => {
        const result = validateDownloadRequest({
          url: 'https://www.youtube.com/watch?v=test1234567',
          type: 'invalid' as any
        })

        expect(result.valid).toBe(false)
      })

      it('should reject invalid audio format', () => {
        const result = validateDownloadRequest({
          url: 'https://www.youtube.com/watch?v=test1234567',
          type: 'audio',
          ext: 'wav' // Not supported
        })

        expect(result.valid).toBe(false)
      })
    })

    describe('Request Properties', () => {
      it('should include normalized URL in validated request', () => {
        const result = validateDownloadRequest({
          url: 'http://youtu.be/dQw4w9WgXcQ',
          type: 'video'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.normalizedUrl).toBe(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        )
        expect(result.validatedRequest?.url).toBe(result.validatedRequest?.normalizedUrl)
      })

      it('should include platform in validated request', () => {
        const result = validateDownloadRequest({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          type: 'video'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.platform).toBe(Platform.YOUTUBE)
      })

      it('should preserve original request properties', () => {
        const result = validateDownloadRequest({
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          type: 'video',
          quality: '1080p'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.type).toBe('video')
        expect(result.validatedRequest?.quality).toBe('1080p')
      })
    })

    describe('Audio Format Validation', () => {
      const validFormats = ['mp3', 'm4a']

      validFormats.forEach(ext => {
        it(`should accept audio format: ${ext}`, () => {
          const result = validateDownloadRequest({
            url: 'https://www.youtube.com/watch?v=test1234567',
            type: 'audio',
            ext
          })

          expect(result.valid).toBe(true)
          expect(result.validatedRequest?.ext).toBe(ext)
        })
      })
    })

    describe('URL Trimming', () => {
      it('should trim whitespace from URL', () => {
        const result = validateDownloadRequest({
          url: '  https://www.youtube.com/watch?v=test1234567  ',
          type: 'video'
        })

        expect(result.valid).toBe(true)
        expect(result.validatedRequest?.normalizedUrl).not.toContain(' ')
      })
    })

    describe('Error Structure', () => {
      it('should return structured error for invalid request', () => {
        const result = validateDownloadRequest({
          url: '',
          type: 'video'
        })

        expect(result.valid).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error?.code).toBeDefined()
        expect(result.error?.type).toBeDefined()
        expect(result.error?.message).toBeDefined()
      })
    })
  })
})
