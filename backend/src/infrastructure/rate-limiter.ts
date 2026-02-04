/**
 * Rate limiter with sliding window
 */

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  name?: string;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  total: number;
}

export class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private requests = new Map<string, number[]>();

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  /**
   * Check if request is allowed and record it
   */
  check(identifier: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request array for this identifier
    let userRequests = this.requests.get(identifier) || [];

    // Filter out old requests
    userRequests = userRequests.filter((time) => time > windowStart);
    this.requests.set(identifier, userRequests);

    const remaining = Math.max(0, this.maxRequests - userRequests.length);
    const allowed = userRequests.length < this.maxRequests;

    // Calculate reset time
    const oldestRequest = userRequests[0];
    const resetIn = oldestRequest
      ? Math.max(0, oldestRequest + this.windowMs - now)
      : 0;

    if (allowed) {
      userRequests.push(now);
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetIn,
      total: this.maxRequests,
    };
  }

  /**
   * Check without recording
   */
  peek(identifier: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const userRequests = (this.requests.get(identifier) || []).filter(
      (time) => time > windowStart
    );

    const remaining = Math.max(0, this.maxRequests - userRequests.length);
    const allowed = userRequests.length < this.maxRequests;
    const oldestRequest = userRequests[0];
    const resetIn = oldestRequest
      ? Math.max(0, oldestRequest + this.windowMs - now)
      : 0;

    return {
      allowed,
      remaining,
      resetIn,
      total: this.maxRequests,
    };
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.requests.clear();
  }

  /**
   * Cleanup old entries
   */
  cleanup(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let removed = 0;

    for (const [identifier, requests] of this.requests) {
      const filtered = requests.filter((time) => time > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(identifier);
        removed++;
      } else {
        this.requests.set(identifier, filtered);
      }
    }

    return removed;
  }

  /**
   * Get current active identifiers count
   */
  getActiveCount(): number {
    return this.requests.size;
  }
}

export default RateLimiter;
