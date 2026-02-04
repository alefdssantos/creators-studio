/**
 * Tests for Circuit Breaker
 *
 * Critical component for protecting against cascading failures.
 * Must correctly transition between states and recover.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CircuitBreaker, CircuitState } from '../../src/infrastructure/circuit-breaker.js'
import { Platform } from '../../src/types/platform.types.js'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeMs: 10000, // 10 seconds
      halfOpenRequests: 2,
      enabled: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should start in CLOSED state for all platforms', () => {
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)
      expect(breaker.getState(Platform.TIKTOK)).toBe(CircuitState.CLOSED)
      expect(breaker.getState(Platform.TWITTER)).toBe(CircuitState.CLOSED)
    })

    it('should allow execution in CLOSED state', () => {
      expect(breaker.canExecute(Platform.YOUTUBE)).toBe(true)
    })
  })

  describe('State Transitions', () => {
    it('should remain CLOSED while failures < threshold', () => {
      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)
      expect(breaker.canExecute(Platform.YOUTUBE)).toBe(true)

      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)
      expect(breaker.canExecute(Platform.YOUTUBE)).toBe(true)
    })

    it('should transition to OPEN after reaching failure threshold', () => {
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
      expect(breaker.canExecute(Platform.YOUTUBE)).toBe(false)
    })

    it('should transition to HALF_OPEN after recovery time', () => {
      // Open the circuit
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)

      // Advance time past recovery period
      vi.advanceTimersByTime(11000)

      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.HALF_OPEN)
      expect(breaker.canExecute(Platform.YOUTUBE)).toBe(true)
    })

    it('should transition from HALF_OPEN to CLOSED on success', () => {
      // Open the circuit
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      // Advance to HALF_OPEN
      vi.advanceTimersByTime(11000)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.HALF_OPEN)

      // Record successes (need halfOpenRequests successes)
      breaker.recordSuccess(Platform.YOUTUBE)
      breaker.recordSuccess(Platform.YOUTUBE)

      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)
    })

    it('should transition from HALF_OPEN back to OPEN on failure', () => {
      // Open the circuit
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      // Advance to HALF_OPEN
      vi.advanceTimersByTime(11000)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.HALF_OPEN)

      // Record a failure
      breaker.recordFailure(Platform.YOUTUBE)

      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
    })
  })

  describe('Platform Isolation', () => {
    it('should track failures per platform independently', () => {
      // Fail YouTube
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      // YouTube should be OPEN, others should be CLOSED
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
      expect(breaker.getState(Platform.TIKTOK)).toBe(CircuitState.CLOSED)
      expect(breaker.getState(Platform.TWITTER)).toBe(CircuitState.CLOSED)

      expect(breaker.canExecute(Platform.YOUTUBE)).toBe(false)
      expect(breaker.canExecute(Platform.TIKTOK)).toBe(true)
      expect(breaker.canExecute(Platform.TWITTER)).toBe(true)
    })

    it('should allow simultaneous OPEN circuits for multiple platforms', () => {
      // Fail all platforms
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(Platform.YOUTUBE)
        breaker.recordFailure(Platform.TIKTOK)
        breaker.recordFailure(Platform.TWITTER)
      }

      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
      expect(breaker.getState(Platform.TIKTOK)).toBe(CircuitState.OPEN)
      expect(breaker.getState(Platform.TWITTER)).toBe(CircuitState.OPEN)
    })
  })

  describe('Success Resets Failures', () => {
    it('should reset failure count on success in CLOSED state', () => {
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      // Record a success - should reset failures
      breaker.recordSuccess(Platform.YOUTUBE)

      // Need 3 more failures to open
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)

      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
    })
  })

  describe('Status Reporting', () => {
    it('should return correct status for all platforms', () => {
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      const status = breaker.getAllStatus()

      expect(status[Platform.YOUTUBE]).toBe('open')
      expect(status[Platform.TIKTOK]).toBe('closed')
      expect(status[Platform.TWITTER]).toBe('closed')
    })
  })

  describe('Disabled Circuit Breaker', () => {
    it('should always allow execution when disabled', () => {
      const disabledBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeMs: 10000,
        halfOpenRequests: 2,
        enabled: false
      })

      // Record failures
      disabledBreaker.recordFailure(Platform.YOUTUBE)
      disabledBreaker.recordFailure(Platform.YOUTUBE)
      disabledBreaker.recordFailure(Platform.YOUTUBE)
      disabledBreaker.recordFailure(Platform.YOUTUBE)

      // Should still allow execution
      expect(disabledBreaker.canExecute(Platform.YOUTUBE)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid state transitions', () => {
      // Open the circuit
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)

      // Advance to HALF_OPEN
      vi.advanceTimersByTime(11000)

      // Fail immediately
      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)

      // Advance again
      vi.advanceTimersByTime(11000)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.HALF_OPEN)

      // Succeed to close
      breaker.recordSuccess(Platform.YOUTUBE)
      breaker.recordSuccess(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)
    })

    it('should handle recording success in OPEN state gracefully', () => {
      // Open the circuit
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      // Record success while OPEN (edge case)
      breaker.recordSuccess(Platform.YOUTUBE)

      // Should still be OPEN
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
    })

    it('should reset failure count properly after recovery', () => {
      // Open -> HALF_OPEN -> CLOSED cycle
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)

      vi.advanceTimersByTime(11000)

      breaker.recordSuccess(Platform.YOUTUBE)
      breaker.recordSuccess(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)

      // Now need 3 failures again to open
      breaker.recordFailure(Platform.YOUTUBE)
      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.CLOSED)

      breaker.recordFailure(Platform.YOUTUBE)
      expect(breaker.getState(Platform.YOUTUBE)).toBe(CircuitState.OPEN)
    })
  })
})
