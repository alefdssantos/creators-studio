/**
 * Tests for Retry with Backoff
 *
 * Critical component for handling transient failures.
 * Must correctly implement exponential backoff with retry logic.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { retryWithBackoff, retrySimple } from '../../src/resilience/retry-with-backoff.js'

describe('Retry with Backoff', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await retryWithBackoff(fn, { operation: 'test' })

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue('success')

      const result = await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0,
        shouldRetry: () => true
      })

      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should fail after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'))

      const result = await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0,
        shouldRetry: () => true
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.attempts).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success')

      const onRetry = vi.fn()

      await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0,
        shouldRetry: () => true,
        onRetry
      })

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1,
        expect.any(Number)
      )
    })

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new Error('Video is private')
      const fn = vi.fn().mockRejectedValue(nonRetryableError)

      const result = await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0,
        shouldRetry: (error) => !error.message.includes('private')
      })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1) // Only one attempt
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should include error details in result', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Specific error message'))

      const result = await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 1,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error?.message).toBeDefined()
    })

    it('should track total time', async () => {
      vi.useFakeTimers()

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success')

      const resultPromise = retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 2,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffFactor: 2,
        jitterFactor: 0,
        shouldRetry: () => true
      })

      // Advance time for the delay
      await vi.advanceTimersByTimeAsync(150)

      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('retrySimple', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await retrySimple(fn, 3, 10)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success')

      const result = await retrySimple(fn, 3, 10)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'))

      await expect(retrySimple(fn, 3, 10)).rejects.toThrow('Always fails')
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('Edge Cases', () => {
    it('should handle synchronous errors', async () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error')
      })

      const result = await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 2,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0,
        shouldRetry: () => true
      })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(2)
    })

    it('should handle maxAttempts of 1', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Fail'))

      const result = await retryWithBackoff(fn, { operation: 'test' }, {
        maxAttempts: 1,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffFactor: 2,
        jitterFactor: 0
      })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should handle undefined return value', async () => {
      const fn = vi.fn().mockResolvedValue(undefined)

      const result = await retryWithBackoff(fn, { operation: 'test' })

      expect(result.success).toBe(true)
      expect(result.result).toBeUndefined()
    })

    it('should handle null return value', async () => {
      const fn = vi.fn().mockResolvedValue(null)

      const result = await retryWithBackoff(fn, { operation: 'test' })

      expect(result.success).toBe(true)
      expect(result.result).toBeNull()
    })

    it('should pass context to retry', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await retryWithBackoff(fn, {
        operation: 'download',
        requestId: '123',
        platform: 'youtube'
      })

      expect(result.success).toBe(true)
    })
  })
})
