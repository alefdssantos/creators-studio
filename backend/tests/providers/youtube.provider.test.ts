/**
 * Tests for YouTube Provider
 *
 * Critical component for YouTube-specific URL validation and format handling.
 * Must correctly validate URLs, extract video IDs, and build download args.
 */

import { describe, it, expect } from 'vitest'
import { YouTubeProvider } from '../../src/providers/youtube.provider.js'
import { Platform } from '../../src/types/platform.types.js'

describe('YouTubeProvider', () => {
  const provider = new YouTubeProvider()

  describe('Platform Identity', () => {
    it('should identify as YouTube platform', () => {
      expect(provider.platform).toBe(Platform.YOUTUBE)
    })
  })

  describe('URL Validation', () => {
    describe('Valid URLs', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'https://www.youtube.com/v/dQw4w9WgXcQ',
        'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120',
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      ]

      validUrls.forEach(url => {
        it(`should validate: ${url}`, () => {
          const result = provider.validateUrl(url)
          expect(result.valid).toBe(true)
          expect(result.videoId).toBe('dQw4w9WgXcQ')
        })
      })
    })

    describe('Invalid URLs', () => {
      const invalidUrls = [
        'https://www.youtube.com/',
        'https://www.youtube.com/watch',
        'https://www.youtube.com/watch?v=',
        'https://www.youtube.com/watch?v=short', // Too short
        'https://www.youtube.com/watch?v=toolongvideoid123', // Too long
        'https://www.youtube.com/channel/UCtest',
        'https://www.youtube.com/user/test',
        'https://vimeo.com/123456789',
        'https://www.tiktok.com/@user/video/123',
        'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
        'javascript:alert(1)',
        'not-a-url',
        '',
      ]

      invalidUrls.forEach(url => {
        it(`should invalidate: ${url || '(empty string)'}`, () => {
          const result = provider.validateUrl(url)
          expect(result.valid).toBe(false)
          expect(result.error).toBeDefined()
        })
      })
    })

    describe('Video ID Validation', () => {
      it('should accept valid 11-character alphanumeric IDs', () => {
        const validIds = [
          'dQw4w9WgXcQ',
          'AAAAAAAAAAA',
          'zzzzzzzzzzz',
          '0123456789a',
          '_-_-_-_-_-_',
          'abc123ABC_-',
        ]

        validIds.forEach(id => {
          const result = provider.validateUrl(`https://youtube.com/watch?v=${id}`)
          expect(result.valid).toBe(true)
          expect(result.videoId).toBe(id)
        })
      })

      it('should reject invalid video IDs', () => {
        const invalidIds = [
          'short',
          'toolongvideoidentifier',
          'has spaces!',
          'special@char',
        ]

        invalidIds.forEach(id => {
          const result = provider.validateUrl(`https://youtube.com/watch?v=${id}`)
          expect(result.valid).toBe(false)
        })
      })
    })
  })

  describe('Video ID Extraction', () => {
    it('should extract ID from standard watch URL', () => {
      expect(provider.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract ID from short URL', () => {
      expect(provider.extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract ID from embed URL', () => {
      expect(provider.extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should extract ID from shorts URL', () => {
      expect(provider.extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('should return null for invalid URLs', () => {
      expect(provider.extractVideoId('https://www.youtube.com/')).toBeNull()
      expect(provider.extractVideoId('not-a-url')).toBeNull()
    })
  })

  describe('URL Normalization', () => {
    it('should normalize various URL formats', () => {
      const urls = [
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest',
        'http://youtube.com/watch?v=dQw4w9WgXcQ',
      ]

      urls.forEach(url => {
        expect(provider.normalizeUrl(url)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      })
    })
  })

  describe('Download Args Building', () => {
    const testDir = '/tmp/downloads'
    const testFilename = 'test-video'

    describe('Video Downloads', () => {
      it('should build args for video download with quality', () => {
        const result = provider.buildDownloadArgs(
          { url: 'https://youtube.com/watch?v=test1234567', type: 'video', quality: '720p' },
          testDir,
          testFilename
        )

        expect(result.args).toContain('--no-warnings')
        expect(result.args).toContain('--no-check-certificates')
        expect(result.args).toContain('-f')
        expect(result.args).toContain('--merge-output-format')
        expect(result.args).toContain('mp4')
        expect(result.outputFilename).toBe('test-video.mp4')
      })

      it('should include height filter in format selector', () => {
        const result = provider.buildDownloadArgs(
          { url: 'https://youtube.com/watch?v=test1234567', type: 'video', quality: '1080p' },
          testDir,
          testFilename
        )

        const formatIndex = result.args.indexOf('-f')
        const formatSelector = result.args[formatIndex + 1]

        expect(formatSelector).toContain('height<=1080')
      })

      it('should default to 720p if no quality specified', () => {
        const result = provider.buildDownloadArgs(
          { url: 'https://youtube.com/watch?v=test1234567', type: 'video' },
          testDir,
          testFilename
        )

        const formatIndex = result.args.indexOf('-f')
        const formatSelector = result.args[formatIndex + 1]

        expect(formatSelector).toContain('height<=720')
      })
    })

    describe('Audio Downloads', () => {
      it('should build args for MP3 audio download', () => {
        const result = provider.buildDownloadArgs(
          { url: 'https://youtube.com/watch?v=test1234567', type: 'audio', ext: 'mp3' },
          testDir,
          testFilename
        )

        expect(result.args).toContain('-x')
        expect(result.args).toContain('--audio-format')
        expect(result.args).toContain('mp3')
        expect(result.args).toContain('--audio-quality')
        expect(result.args).toContain('0')
        expect(result.outputFilename).toBe('test-video.mp3')
      })

      it('should build args for M4A audio download', () => {
        const result = provider.buildDownloadArgs(
          { url: 'https://youtube.com/watch?v=test1234567', type: 'audio', ext: 'm4a' },
          testDir,
          testFilename
        )

        expect(result.args).toContain('--audio-format')
        expect(result.args).toContain('m4a')
        expect(result.outputFilename).toBe('test-video.m4a')
      })

      it('should default to MP3 if no ext specified', () => {
        const result = provider.buildDownloadArgs(
          { url: 'https://youtube.com/watch?v=test1234567', type: 'audio' },
          testDir,
          testFilename
        )

        expect(result.args).toContain('mp3')
      })
    })
  })

  describe('Video Info Parsing', () => {
    const sampleRawInfo = {
      title: 'Test Video Title',
      duration: 180,
      thumbnail: 'https://i.ytimg.com/vi/test/maxresdefault.jpg',
      thumbnails: [{ url: 'https://i.ytimg.com/vi/test/default.jpg' }],
      uploader: 'Test Channel',
      channel: 'Test Channel Alt',
      description: 'This is a test video description that is quite long and should be truncated...',
      upload_date: '20240101',
      view_count: 1000000,
      like_count: 50000,
    }

    it('should parse video info correctly', () => {
      const result = provider.parseVideoInfo(sampleRawInfo)

      expect(result.title).toBe('Test Video Title')
      expect(result.duration).toBe(180)
      expect(result.thumbnail).toBe('https://i.ytimg.com/vi/test/maxresdefault.jpg')
      expect(result.uploader).toBe('Test Channel')
      expect(result.viewCount).toBe(1000000)
      expect(result.likeCount).toBe(50000)
    })

    it('should handle missing fields gracefully', () => {
      const result = provider.parseVideoInfo({})

      expect(result.title).toBe('Sem título')
      expect(result.duration).toBe(0)
      expect(result.thumbnail).toBe('')
      expect(result.uploader).toBe('Desconhecido')
    })

    it('should use channel as fallback for uploader', () => {
      const result = provider.parseVideoInfo({ channel: 'Fallback Channel' })

      expect(result.uploader).toBe('Fallback Channel')
    })

    it('should use thumbnails array as fallback', () => {
      const result = provider.parseVideoInfo({
        thumbnails: [{ url: 'https://fallback.jpg' }]
      })

      expect(result.thumbnail).toBe('https://fallback.jpg')
    })
  })

  describe('Format Parsing', () => {
    const sampleFormats = {
      formats: [
        { format_id: '137', vcodec: 'avc1', acodec: 'none', height: 1080, width: 1920, ext: 'mp4' },
        { format_id: '136', vcodec: 'avc1', acodec: 'none', height: 720, width: 1280, ext: 'mp4' },
        { format_id: '135', vcodec: 'avc1', acodec: 'none', height: 480, width: 854, ext: 'mp4' },
        { format_id: '134', vcodec: 'avc1', acodec: 'none', height: 360, width: 640, ext: 'mp4' },
        { format_id: '140', vcodec: 'none', acodec: 'mp4a', height: null, ext: 'm4a' },
        { format_id: 'sb0', vcodec: 'images', height: 180, ext: 'mhtml' }, // Storyboard - should be filtered
      ]
    }

    it('should parse video formats', () => {
      const result = provider.parseVideoFormats(sampleFormats)

      expect(result.length).toBeGreaterThan(0)
      expect(result.every(f => f.hasVideo)).toBe(true)
      expect(result.some(f => f.quality === '1080p')).toBe(true)
      expect(result.some(f => f.quality === '720p')).toBe(true)
    })

    it('should filter out audio-only formats from video list', () => {
      const result = provider.parseVideoFormats(sampleFormats)

      expect(result.every(f => f.vcodec && f.vcodec !== 'none')).toBe(true)
    })

    it('should sort formats by height descending', () => {
      const result = provider.parseVideoFormats(sampleFormats)

      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].height).toBeGreaterThanOrEqual(result[i + 1].height)
      }
    })

    it('should deduplicate by height', () => {
      const duplicateFormats = {
        formats: [
          { format_id: '137a', vcodec: 'avc1', height: 1080, ext: 'mp4' },
          { format_id: '137b', vcodec: 'vp9', height: 1080, ext: 'webm' },
        ]
      }

      const result = provider.parseVideoFormats(duplicateFormats)

      const heights = result.map(f => f.height)
      const uniqueHeights = [...new Set(heights)]
      expect(heights.length).toBe(uniqueHeights.length)
    })

    it('should parse audio formats', () => {
      const result = provider.parseAudioFormats(sampleFormats)

      expect(result.length).toBeGreaterThan(0)
      expect(result.some(f => f.ext === 'mp3')).toBe(true)
      expect(result.some(f => f.ext === 'm4a')).toBe(true)
    })
  })

  describe('Quality Selection', () => {
    const formats = [
      { formatId: '137', quality: '1080p', height: 1080, ext: 'mp4', hasAudio: false, hasVideo: true },
      { formatId: '136', quality: '720p', height: 720, ext: 'mp4', hasAudio: false, hasVideo: true },
      { formatId: '135', quality: '480p', height: 480, ext: 'mp4', hasAudio: false, hasVideo: true },
      { formatId: '134', quality: '360p', height: 360, ext: 'mp4', hasAudio: false, hasVideo: true },
    ]

    it('should select exact quality match', () => {
      const result = provider.selectBestFormat(formats, '720p')
      expect(result?.quality).toBe('720p')
    })

    it('should select closest lower quality if exact not available', () => {
      const result = provider.selectBestFormat(formats, '900p')
      expect(result?.height).toBeLessThanOrEqual(900)
    })

    it('should return first format if no match found', () => {
      const result = provider.selectBestFormat(formats, '144p')
      expect(result).toBeDefined()
    })

    it('should return null for empty formats', () => {
      const result = provider.selectBestFormat([], '720p')
      expect(result).toBeNull()
    })
  })

  describe('Recommended Quality', () => {
    it('should recommend 720p when available', () => {
      const formats = [
        { formatId: '137', quality: '1080p', height: 1080, ext: 'mp4', hasAudio: false, hasVideo: true },
        { formatId: '136', quality: '720p', height: 720, ext: 'mp4', hasAudio: false, hasVideo: true },
      ]

      const result = provider.getRecommendedQuality(formats)
      expect(result).toBe('720p')
    })

    it('should recommend highest available if 720p not available', () => {
      const formats = [
        { formatId: '135', quality: '480p', height: 480, ext: 'mp4', hasAudio: false, hasVideo: true },
        { formatId: '134', quality: '360p', height: 360, ext: 'mp4', hasAudio: false, hasVideo: true },
      ]

      const result = provider.getRecommendedQuality(formats)
      expect(result).toBe('480p')
    })

    it('should recommend 1080p if 720p not available but 1080p is', () => {
      const formats = [
        { formatId: '137', quality: '1080p', height: 1080, ext: 'mp4', hasAudio: false, hasVideo: true },
        { formatId: '135', quality: '480p', height: 480, ext: 'mp4', hasAudio: false, hasVideo: true },
      ]

      const result = provider.getRecommendedQuality(formats)
      expect(result).toBe('1080p')
    })
  })

  describe('Fallback Qualities', () => {
    it('should return fallback chain from selected quality', () => {
      const fallbacks = provider.getFallbackQualities('1080p')

      expect(fallbacks.length).toBeGreaterThan(0)
      expect(fallbacks[0]).toBe('1080p')
    })

    it('should include lower qualities in fallback', () => {
      const fallbacks = provider.getFallbackQualities('720p')

      expect(fallbacks).toContain('720p')
      expect(fallbacks.indexOf('720p')).toBeLessThan(fallbacks.indexOf('480p'))
    })
  })
})
