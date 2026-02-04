/**
 * Circuit breaker pattern for platform resilience
 */

import { Platform } from '../types/platform.types.js';
import { logEvents } from '../logging/logger.js';
import { resilienceConfig } from '../config/resilience.config.js';

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTime: number;
  halfOpenRequests: number;
}

interface CircuitStatus {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: number;
  lastStateChange: number;
  halfOpenAttempts: number;
}

export class CircuitBreaker {
  private circuits = new Map<Platform, CircuitStatus>();
  private options: CircuitBreakerOptions;
  private enabled: boolean;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: options?.failureThreshold ?? resilienceConfig.circuitBreaker.failureThreshold,
      recoveryTime: options?.recoveryTime ?? resilienceConfig.circuitBreaker.recoveryTime,
      halfOpenRequests: options?.halfOpenRequests ?? resilienceConfig.circuitBreaker.halfOpenRequests,
    };
    this.enabled = resilienceConfig.circuitBreaker.enabled;
  }

  /**
   * Check if request can proceed
   */
  canExecute(platform: Platform): boolean {
    if (!this.enabled) return true;

    const circuit = this.getOrCreateCircuit(platform);

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if recovery time has passed
        if (Date.now() - circuit.lastStateChange >= this.options.recoveryTime) {
          this.transitionToHalfOpen(platform);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited requests in half-open state
        return circuit.halfOpenAttempts < this.options.halfOpenRequests;
    }
  }

  /**
   * Record a successful operation
   */
  recordSuccess(platform: Platform): void {
    if (!this.enabled) return;

    const circuit = this.getOrCreateCircuit(platform);
    circuit.successes++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.halfOpenAttempts++;

      // If enough successes in half-open, close the circuit
      if (circuit.halfOpenAttempts >= this.options.halfOpenRequests) {
        this.transitionToClosed(platform);
      }
    } else if (circuit.state === CircuitState.CLOSED) {
      // Reset failure count on success
      circuit.failures = 0;
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure(platform: Platform): void {
    if (!this.enabled) return;

    const circuit = this.getOrCreateCircuit(platform);
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.transitionToOpen(platform);
    } else if (circuit.state === CircuitState.CLOSED) {
      // Check if failures exceed threshold
      if (circuit.failures >= this.options.failureThreshold) {
        this.transitionToOpen(platform);
      }
    }
  }

  /**
   * Get circuit state for platform
   */
  getState(platform: Platform): CircuitState {
    const circuit = this.circuits.get(platform);
    return circuit?.state ?? CircuitState.CLOSED;
  }

  /**
   * Get full circuit status
   */
  getStatus(platform: Platform): CircuitStatus | null {
    return this.circuits.get(platform) ?? null;
  }

  /**
   * Get all circuits status
   */
  getAllStatus(): Map<Platform, CircuitStatus> {
    return new Map(this.circuits);
  }

  /**
   * Force reset a circuit
   */
  reset(platform: Platform): void {
    this.circuits.delete(platform);
  }

  /**
   * Force reset all circuits
   */
  resetAll(): void {
    this.circuits.clear();
  }

  /**
   * Enable or disable circuit breaker
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.resetAll();
    }
  }

  private getOrCreateCircuit(platform: Platform): CircuitStatus {
    let circuit = this.circuits.get(platform);
    if (!circuit) {
      circuit = {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        lastStateChange: Date.now(),
        halfOpenAttempts: 0,
      };
      this.circuits.set(platform, circuit);
    }
    return circuit;
  }

  private transitionToOpen(platform: Platform): void {
    const circuit = this.getOrCreateCircuit(platform);
    circuit.state = CircuitState.OPEN;
    circuit.lastStateChange = Date.now();
    circuit.halfOpenAttempts = 0;

    logEvents.circuitBreakerOpened({
      platform,
      failures: circuit.failures,
      threshold: this.options.failureThreshold,
    });
  }

  private transitionToHalfOpen(platform: Platform): void {
    const circuit = this.getOrCreateCircuit(platform);
    circuit.state = CircuitState.HALF_OPEN;
    circuit.lastStateChange = Date.now();
    circuit.halfOpenAttempts = 0;

    logEvents.circuitBreakerHalfOpen({ platform });
  }

  private transitionToClosed(platform: Platform): void {
    const circuit = this.getOrCreateCircuit(platform);
    circuit.state = CircuitState.CLOSED;
    circuit.lastStateChange = Date.now();
    circuit.failures = 0;
    circuit.halfOpenAttempts = 0;

    logEvents.circuitBreakerClosed({
      platform,
      recoveryTimeMs: this.options.recoveryTime,
    });
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();

export default circuitBreaker;
