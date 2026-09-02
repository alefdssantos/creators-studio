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
  recoveryTimeMs: number;
  halfOpenRequests: number;
  enabled: boolean;
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
  private options: Omit<CircuitBreakerOptions, 'enabled'>;
  private enabled: boolean;

  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: options?.failureThreshold ?? resilienceConfig.circuitBreaker.failureThreshold,
      recoveryTimeMs: options?.recoveryTimeMs ?? resilienceConfig.circuitBreaker.recoveryTime,
      halfOpenRequests: options?.halfOpenRequests ?? resilienceConfig.circuitBreaker.halfOpenRequests,
    };
    this.enabled = options?.enabled ?? resilienceConfig.circuitBreaker.enabled;
  }

  /**
   * Check if request can proceed
   */
  canExecute(platform: Platform): boolean {
    if (!this.enabled) return true;

    const circuit = this.getOrCreateCircuit(platform);
    this.refreshState(platform, circuit);

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
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
    this.refreshState(platform, circuit);
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
    this.refreshState(platform, circuit);
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
    if (!this.enabled) return CircuitState.CLOSED;
    const circuit = this.getOrCreateCircuit(platform);
    this.refreshState(platform, circuit);
    return circuit.state;
  }

  /**
   * Get full circuit status
   */
  getStatus(platform: Platform): CircuitStatus | null {
    const circuit = this.circuits.get(platform);
    if (circuit) this.refreshState(platform, circuit);
    return circuit ?? null;
  }

  /**
   * Get all circuits status
   */
  getAllStatus(): Record<Platform, CircuitState> {
    return Object.fromEntries(
      Object.values(Platform).map((platform) => [platform, this.getState(platform)])
    ) as Record<Platform, CircuitState>;
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

  private refreshState(platform: Platform, circuit: CircuitStatus): void {
    if (
      circuit.state === CircuitState.OPEN &&
      Date.now() - circuit.lastStateChange >= this.options.recoveryTimeMs
    ) {
      this.transitionToHalfOpen(platform);
    }
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
      recoveryTimeMs: this.options.recoveryTimeMs,
    });
  }
}

// Singleton instance
export const circuitBreaker = new CircuitBreaker();

export default circuitBreaker;
