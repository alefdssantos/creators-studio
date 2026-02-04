/**
 * Tests for Rate Limiter
 *
 * Critical component for protecting against abuse.
 * Must correctly track requests per IP with sliding window.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RateLimiter } from '../../src/infrastructure/rate-limiter.js'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    vi.useFakeTimers()
    limiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 5,
      name: 'test-limiter'
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', () => {
      const clientId = '192.168.1.1'

      for (let i = 0; i < 5; i++) {
        const result = limiter.check(clientId)
        expect(result.allowed).toBe(true)
        expect(result.remaining).toBe(4 - i)
      }
    })

    it('should block requests over the limit', () => {
      const clientId = '192.168.1.1'

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(clientId)
      }

      // Next request should be blocked
      const result = limiter.check(clientId)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.resetIn).toBeGreaterThan(0)
    })

    it('should track requests per client independently', () => {
      const client1 = '192.168.1.1'
      const client2 = '192.168.1.2'

      // Use up client1's limit
      for (let i = 0; i < 5; i++) {
        limiter.check(client1)
      }

      // Client1 should be blocked
      expect(limiter.check(client1).allowed).toBe(false)

      // Client2 should still be allowed
      expect(limiter.check(client2).allowed).toBe(true)
      expect(limiter.check(client2).remaining).toBe(3) // 4 remaining after 2 checks
    })
  })

  describe('Sliding Window', () => {
    it('should reset after window expires', () => {
      const clientId = '192.168.1.1'

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(clientId)
      }
      expect(limiter.check(clientId).allowed).toBe(false)

      // Advance time past window
      vi.advanceTimersByTime(61000)

      // Should be allowed again
      const result = limiter.check(clientId)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('should slide window correctly for partial expiration', () => {
      const clientId = '192.168.1.1'

      // Make 3 requests
      limiter.check(clientId)
      limiter.check(clientId)
      limiter.check(clientId)

      // Advance 30 seconds
      vi.advanceTimersByTime(30000)

      // Make 2 more requests (5 total in window)
      limiter.check(clientId)
      limiter.check(clientId)

      // Should be at limit
      expect(limiter.check(clientId).allowed).toBe(false)

      // Advance 31 more seconds (first 3 requests expire)
      vi.advanceTimersByTime(31000)

      // Should have 3 slots available again
      const result = limiter.check(clientId)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2) // 3 slots available, used 1
    })
  })

  describe('Reset Time Calculation', () => {
    it('should return correct resetIn', () => {
      const clientId = '192.168.1.1'

      limiter.check(clientId)

      const result = limiter.check(clientId)

      // resetIn should be based on oldest request in window
      expect(result.resetIn).toBeGreaterThanOrEqual(59000) // Close to window
      expect(result.resetIn).toBeLessThanOrEqual(60000)
    })

    it('should return resetIn when rate limited', () => {
      const clientId = '192.168.1.1'

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(clientId)
      }

      const result = limiter.check(clientId)

      expect(result.resetIn).toBeGreaterThan(0)
      expect(result.resetIn).toBeLessThanOrEqual(60000)
    })
  })

  describe('Peek', () => {
    it('should check limit without recording', () => {
      const clientId = '192.168.1.1'

      // Use 3 of 5 requests
      limiter.check(clientId)
      limiter.check(clientId)
      limiter.check(clientId)

      // Peek should not count as a request
      const peek1 = limiter.peek(clientId)
      expect(peek1.allowed).toBe(true)
      expect(peek1.remaining).toBe(2)

      const peek2 = limiter.peek(clientId)
      expect(peek2.allowed).toBe(true)
      expect(peek2.remaining).toBe(2) // Still 2, not decremented
    })
  })

  describe('Reset', () => {
    it('should reset rate limit for identifier', () => {
      const clientId = '192.168.1.1'

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        limiter.check(clientId)
      }
      expect(limiter.check(clientId).allowed).toBe(false)

      // Reset
      limiter.reset(clientId)

      // Should be allowed again
      expect(limiter.check(clientId).allowed).toBe(true)
    })

    it('should reset all rate limits', () => {
      const client1 = '192.168.1.1'
      const client2 = '192.168.1.2'

      // Use up limits for both clients
      for (let i = 0; i < 5; i++) {
        limiter.check(client1)
        limiter.check(client2)
      }

      // Both should be blocked
      expect(limiter.check(client1).allowed).toBe(false)
      expect(limiter.check(client2).allowed).toBe(false)

      // Reset all
      limiter.resetAll()

      // Both should be allowed
      expect(limiter.check(client1).allowed).toBe(true)
      expect(limiter.check(client2).allowed).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('should clean up old entries', () => {
      // Create multiple clients
      for (let i = 0; i < 10; i++) {
        limiter.check(`192.168.1.${i}`)
      }

      expect(limiter.getActiveCount()).toBe(10)

      // Advance time past window
      vi.advanceTimersByTime(61000)

      // Force cleanup
      const removed = limiter.cleanup()

      expect(removed).toBe(10)
      expect(limiter.getActiveCount()).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty client ID', () => {
      const result = limiter.check('')
      expect(result.allowed).toBe(true)
    })

    it('should handle IPv6 addresses', () => {
      const result = limiter.check('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
      expect(result.allowed).toBe(true)
    })

    it('should handle rapid requests', () => {
      const clientId = '192.168.1.1'

      // Make 10 rapid requests
      const results = []
      for (let i = 0; i < 10; i++) {
        results.push(limiter.check(clientId))
      }

      // First 5 should be allowed
      expect(results.slice(0, 5).every(r => r.allowed)).toBe(true)

      // Last 5 should be blocked
      expect(results.slice(5).every(r => !r.allowed)).toBe(true)
    })

    it('should handle maxRequests of 1', () => {
      const strictLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        name: 'strict-limiter'
      })

      const clientId = '192.168.1.1'

      expect(strictLimiter.check(clientId).allowed).toBe(true)
      expect(strictLimiter.check(clientId).allowed).toBe(false)
    })

    it('should handle very large maxRequests', () => {
      const lenientLimiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 1000000,
        name: 'lenient-limiter'
      })

      const clientId = '192.168.1.1'

      for (let i = 0; i < 100; i++) {
        expect(lenientLimiter.check(clientId).allowed).toBe(true)
      }
    })
  })

  describe('Remaining Count', () => {
    it('should return correct remaining count', () => {
      const clientId = '192.168.1.1'

      expect(limiter.check(clientId).remaining).toBe(4)
      expect(limiter.check(clientId).remaining).toBe(3)
      expect(limiter.check(clientId).remaining).toBe(2)
      expect(limiter.check(clientId).remaining).toBe(1)
      expect(limiter.check(clientId).remaining).toBe(0)
      expect(limiter.check(clientId).remaining).toBe(0) // Blocked
    })
  })

  describe('Total', () => {
    it('should return total limit', () => {
      const clientId = '192.168.1.1'
      const result = limiter.check(clientId)
      expect(result.total).toBe(5)
    })
  })
})
