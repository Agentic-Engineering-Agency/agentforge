/**
 * In-memory sliding window rate limiter.
 *
 * Tracks requests per token/identifier and enforces limits:
 * - Burst size: Max requests in immediate succession
 * - Per-minute limit: Max requests per minute
 * - Per-hour limit: Max requests per hour
 */

/**
 * Default rate limit configuration.
 */
export const DEFAULT_RATE_LIMIT_CONFIG = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
  burstSize: 10,
} as const;

/**
 * Rate limit configuration.
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
}

/**
 * Rate limit error with retry information.
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Request tracking data.
 */
interface RequestData {
  timestamps: number[];
}

/**
 * In-memory sliding window rate limiter.
 *
 * Uses a Map to track request timestamps per token.
 * Old timestamps are pruned as they fall outside the time windows.
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly requests: Map<string, RequestData> = new Map();
  private cleanupCounter = 0;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...config,
    };
  }

  /**
   * Check if a request should be allowed.
   *
   * Throws RateLimitError if the limit has been exceeded.
   *
   * @param token - Token/identifier to check
   * @throws RateLimitError if limit exceeded
   */
  checkLimit(token: string): void {
    const now = Date.now();
    const data = this.requests.get(token) || { timestamps: [] };

    // Prune old timestamps outside our time windows
    const minuteAgo = now - 60 * 1000;
    const hourAgo = now - 60 * 60 * 1000;

    data.timestamps = data.timestamps.filter(
      (ts) => ts > hourAgo // Keep only recent hour
    );

    // Check limits

    // Burst check: limit rapid-fire requests within 1-second window
    const burstWindow = now - 1000;
    const recentBurst = data.timestamps.filter(ts => ts > burstWindow).length;
    if (recentBurst >= this.config.burstSize) {
      throw new RateLimitError(
        `Rate limit exceeded: ${this.config.burstSize} burst requests per second`,
        1
      );
    }

    if (data.timestamps.length >= this.config.requestsPerHour) {
      throw new RateLimitError(
        `Rate limit exceeded: ${this.config.requestsPerHour} requests per hour`,
        this.calculateRetryAfter(data.timestamps, this.config.requestsPerHour, 60 * 60 * 1000)
      );
    }

    const recentMinute = data.timestamps.filter((ts) => ts > minuteAgo).length;
    if (recentMinute >= this.config.requestsPerMinute) {
      throw new RateLimitError(
        `Rate limit exceeded: ${this.config.requestsPerMinute} requests per minute`,
        this.calculateRetryAfter(
          data.timestamps.filter((ts) => ts > minuteAgo),
          this.config.requestsPerMinute,
          60 * 1000
        )
      );
    }

    // Add this request
    data.timestamps.push(now);
    this.requests.set(token, data);

    // Periodic cleanup of stale entries
    if (++this.cleanupCounter % 100 === 0) {
      this.cleanup();
    }
  }

  /**
   * Reset rate limit for a specific token or all tokens.
   *
   * @param token - Optional token to reset. If omitted, resets all.
   */
  reset(token?: string): void {
    if (token) {
      this.requests.delete(token);
    } else {
      this.requests.clear();
    }
  }

  /**
   * Remove stale entries with no recent activity.
   * Called automatically every 100 requests.
   */
  cleanup(): void {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, data] of this.requests.entries()) {
      if (data.timestamps.length === 0 || data.timestamps[data.timestamps.length - 1] <= hourAgo) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Calculate retry-after time in seconds.
   *
   * @param timestamps - Request timestamps
   * @param limit - The limit that was exceeded
   * @param windowMs - Time window in milliseconds
   * @returns Retry-after seconds
   */
  private calculateRetryAfter(
    timestamps: number[],
    limit: number,
    windowMs: number
  ): number {
    if (timestamps.length < limit) return 0;

    // The oldest request in the window determines when we can retry
    const oldestTimestamp = timestamps[timestamps.length - limit];
    const retryAt = oldestTimestamp + windowMs;
    const now = Date.now();
    return Math.max(0, Math.ceil((retryAt - now) / 1000));
  }
}
