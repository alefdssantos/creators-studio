/**
 * Tests for LRU Cache
 *
 * Critical component for caching video info.
 * Must correctly handle TTL, LRU eviction, and key normalization.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LRUCache } from '../../src/infrastructure/cache.js'

describe('LRUCache', () => {
  let cache: LRUCache<string>

  beforeEach(() => {
    vi.useFakeTimers()
    cache = new LRUCache<string>({
      ttlMs: 60000, // 1 minute
      maxSize: 3,
      name: 'test-cache'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Operations', () => {
    it('should set and get values', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')
      expect(cache.get('https://youtube.com/watch?v=abc123def45')).toBe('value1')
    })

    it('should return null for non-existent keys', () => {
      expect(cache.get('https://youtube.com/watch?v=nonexistent')).toBeNull()
    })

    it('should check if key exists', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')
      expect(cache.has('https://youtube.com/watch?v=abc123def45')).toBe(true)
      expect(cache.has('https://youtube.com/watch?v=nonexistent')).toBe(false)
    })

    it('should delete keys', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')
      expect(cache.delete('https://youtube.com/watch?v=abc123def45')).toBe(true)
      expect(cache.get('https://youtube.com/watch?v=abc123def45')).toBeNull()
      expect(cache.delete('https://youtube.com/watch?v=nonexistent')).toBe(false)
    })

    it('should clear all entries', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')
      cache.clear()
      expect(cache.get('https://youtube.com/watch?v=video1aaaaaa')).toBeNull()
      expect(cache.get('https://youtube.com/watch?v=video2bbbbb')).toBeNull()
    })
  })

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')
      expect(cache.get('https://youtube.com/watch?v=abc123def45')).toBe('value1')

      // Advance time past TTL
      vi.advanceTimersByTime(61000)

      expect(cache.get('https://youtube.com/watch?v=abc123def45')).toBeNull()
    })

    it('should not expire entries before TTL', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')

      // Advance time but not past TTL
      vi.advanceTimersByTime(30000)

      expect(cache.get('https://youtube.com/watch?v=abc123def45')).toBe('value1')
    })

    it('should update TTL on set', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')
      vi.advanceTimersByTime(30000)

      // Update the value - this resets the timestamp
      cache.set('https://youtube.com/watch?v=abc123def45', 'value2')
      vi.advanceTimersByTime(40000) // Total 70s from first set, but only 40s from update

      expect(cache.get('https://youtube.com/watch?v=abc123def45')).toBe('value2')
    })
  })

  describe('LRU Eviction', () => {
    it('should evict least recently used when at max size', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')
      cache.set('https://youtube.com/watch?v=video3ccccc', 'value3')

      // Cache is now full (maxSize: 3)
      expect(cache.get('https://youtube.com/watch?v=video1aaaaaa')).toBe('value1')
      expect(cache.get('https://youtube.com/watch?v=video2bbbbb')).toBe('value2')
      expect(cache.get('https://youtube.com/watch?v=video3ccccc')).toBe('value3')

      // Add a new entry - should evict the least recently used
      cache.set('https://youtube.com/watch?v=video4ddddd', 'value4')

      // video1 was accessed first so it should be evicted (LRU)
      expect(cache.get('https://youtube.com/watch?v=video1aaaaaa')).toBeNull()
      expect(cache.get('https://youtube.com/watch?v=video2bbbbb')).toBe('value2')
      expect(cache.get('https://youtube.com/watch?v=video3ccccc')).toBe('value3')
      expect(cache.get('https://youtube.com/watch?v=video4ddddd')).toBe('value4')
    })

    it('should update LRU order on access', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')
      cache.set('https://youtube.com/watch?v=video3ccccc', 'value3')

      // Access video1 to make it recently used
      cache.get('https://youtube.com/watch?v=video1aaaaaa')

      // Add new entry - should evict video2 (now LRU)
      cache.set('https://youtube.com/watch?v=video4ddddd', 'value4')

      expect(cache.get('https://youtube.com/watch?v=video1aaaaaa')).toBe('value1')
      expect(cache.get('https://youtube.com/watch?v=video2bbbbb')).toBeNull()
      expect(cache.get('https://youtube.com/watch?v=video3ccccc')).toBe('value3')
      expect(cache.get('https://youtube.com/watch?v=video4ddddd')).toBe('value4')
    })

    it('should update LRU order on set of existing key', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')
      cache.set('https://youtube.com/watch?v=video3ccccc', 'value3')

      // Update video1
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'updated')

      // Add new entry - should evict video2 (now LRU)
      cache.set('https://youtube.com/watch?v=video4ddddd', 'value4')

      expect(cache.get('https://youtube.com/watch?v=video1aaaaaa')).toBe('updated')
      expect(cache.get('https://youtube.com/watch?v=video2bbbbb')).toBeNull()
    })
  })

  describe('Statistics', () => {
    it('should track hits and misses', () => {
      cache.set('https://youtube.com/watch?v=abc123def45', 'value1')

      // Hits
      cache.get('https://youtube.com/watch?v=abc123def45')
      cache.get('https://youtube.com/watch?v=abc123def45')

      // Misses
      cache.get('https://youtube.com/watch?v=nonexistent1')
      cache.get('https://youtube.com/watch?v=nonexistent2')

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(2)
      expect(stats.hitRate).toBe('50.0%')
    })

    it('should track size', () => {
      expect(cache.getStats().size).toBe(0)

      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      expect(cache.getStats().size).toBe(1)

      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')
      expect(cache.getStats().size).toBe(2)

      cache.delete('https://youtube.com/watch?v=video1aaaaaa')
      expect(cache.getStats().size).toBe(1)
    })

    it('should handle zero hits/misses for hitRate', () => {
      const stats = cache.getStats()
      expect(stats.hitRate).toBe('0%')
    })
  })

  describe('Key Normalization', () => {
    it('should normalize YouTube URLs to video ID', () => {
      // The cache automatically normalizes YouTube URLs based on video ID
      cache.set('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video1')
      cache.set('https://youtu.be/dQw4w9WgXcQ', 'video2')

      // Both URLs should map to the same key
      expect(cache.get('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('video2')
      expect(cache.get('https://youtu.be/dQw4w9WgXcQ')).toBe('video2')
    })

    it('should normalize TikTok URLs', () => {
      cache.set('https://www.tiktok.com/@user/video/1234567890', 'tiktok1')
      cache.set('https://tiktok.com/@other/video/1234567890', 'tiktok2')

      // Same video ID should map to same key
      expect(cache.get('https://www.tiktok.com/@user/video/1234567890')).toBe('tiktok2')
    })

    it('should normalize Twitter URLs', () => {
      cache.set('https://twitter.com/user/status/1234567890', 'twitter1')
      cache.set('https://x.com/other/status/1234567890', 'twitter2')

      // Same tweet ID should map to same key
      expect(cache.get('https://twitter.com/user/status/1234567890')).toBe('twitter2')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty string URLs', () => {
      // Empty string is not a valid URL, generateKey will return it as-is
      cache.set('', 'empty-key-value')
      expect(cache.get('')).toBe('empty-key-value')
    })

    it('should handle non-URL strings', () => {
      cache.set('some-key', 'value1')
      cache.set('another-key', 'value2')

      expect(cache.get('some-key')).toBe('value1')
      expect(cache.get('another-key')).toBe('value2')
    })

    it('should handle maxSize of 1', () => {
      const tinyCache = new LRUCache<string>({
        ttlMs: 60000,
        maxSize: 1,
        name: 'tiny-cache'
      })

      tinyCache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      expect(tinyCache.get('https://youtube.com/watch?v=video1aaaaaa')).toBe('value1')

      tinyCache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')
      expect(tinyCache.get('https://youtube.com/watch?v=video1aaaaaa')).toBeNull()
      expect(tinyCache.get('https://youtube.com/watch?v=video2bbbbb')).toBe('value2')
    })
  })

  describe('Cleanup', () => {
    it('should remove expired entries', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')

      vi.advanceTimersByTime(61000)

      const removed = cache.cleanup()
      expect(removed).toBe(2)
      expect(cache.getStats().size).toBe(0)
    })

    it('should only remove expired entries', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')

      vi.advanceTimersByTime(30000)

      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')

      vi.advanceTimersByTime(35000) // video1 expired, video2 still valid

      const removed = cache.cleanup()
      expect(removed).toBe(1)
      expect(cache.get('https://youtube.com/watch?v=video2bbbbb')).toBe('value2')
    })
  })

  describe('Keys', () => {
    it('should return all normalized keys', () => {
      cache.set('https://youtube.com/watch?v=video1aaaaaa', 'value1')
      cache.set('https://youtube.com/watch?v=video2bbbbb', 'value2')

      const keys = cache.keys()
      expect(keys.length).toBe(2)
      expect(keys).toContain('youtube:video1aaaaaa')
      expect(keys).toContain('youtube:video2bbbbb')
    })
  })
})
