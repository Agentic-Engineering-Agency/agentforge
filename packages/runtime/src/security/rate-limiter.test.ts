import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, RateLimitError } from "./rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    test("creates with default config", () => {
      const limiter = new RateLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    test("creates with custom config", () => {
      const limiter = new RateLimiter({
        requestsPerMinute: 30,
        requestsPerHour: 500,
        burstSize: 5,
      });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe("checkLimit", () => {
    test("allows first request", () => {
      const limiter = new RateLimiter();
      expect(() => limiter.checkLimit("token-1")).not.toThrow();
    });

    test("allows requests up to burst size", () => {
      const limiter = new RateLimiter({ burstSize: 5 });

      for (let i = 0; i < 5; i++) {
        expect(() => limiter.checkLimit("token-1")).not.toThrow();
      }
    });

    test("blocks requests exceeding burst size", () => {
      const limiter = new RateLimiter({ burstSize: 3 });

      for (let i = 0; i < 3; i++) {
        limiter.checkLimit("token-1");
      }

      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);
    });

    test("resets after reset() is called", () => {
      const limiter = new RateLimiter({
        burstSize: 3,
        requestsPerMinute: 3,
      });

      // Use up burst
      for (let i = 0; i < 3; i++) {
        limiter.checkLimit("token-1");
      }

      // Should be blocked
      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);

      // Reset should allow requests again
      limiter.reset("token-1");
      expect(() => limiter.checkLimit("token-1")).not.toThrow();
    });

    test("enforces per-minute limit", () => {
      const limiter = new RateLimiter({
        burstSize: 10,
        requestsPerMinute: 5,
      });

      // Use 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit("token-1");
      }

      // Even though burst is 10, minute limit should block
      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);
    });

    test("enforces per-hour limit", () => {
      const limiter = new RateLimiter({
        burstSize: 10,
        requestsPerMinute: 10,
        requestsPerHour: 5,
      });

      // Use 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit("token-1");
      }

      // Should be blocked due to hour limit
      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);
    });

    test("tracks different tokens separately", () => {
      const limiter = new RateLimiter({ burstSize: 2 });

      // Use up token-1
      limiter.checkLimit("token-1");
      limiter.checkLimit("token-1");

      // token-1 should be blocked
      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);

      // token-2 should still work
      expect(() => limiter.checkLimit("token-2")).not.toThrow();
    });

    test("evicts oldest clients when capacity is exceeded", () => {
      const limiter = new RateLimiter({
        burstSize: 1,
        requestsPerMinute: 100,
        requestsPerHour: 100,
        maxClients: 2,
      });

      limiter.checkLimit("client-1");
      vi.advanceTimersByTime(10);
      limiter.checkLimit("client-2");

      // client-1 should be at its burst limit before eviction
      expect(() => limiter.checkLimit("client-1")).toThrow(RateLimitError);

      // Adding a third client should evict the oldest (client-1)
      vi.advanceTimersByTime(10);
      limiter.checkLimit("client-3");

      // After eviction, client-1 should behave like a new client
      expect(() => limiter.checkLimit("client-1")).not.toThrow();
    });
  });

  describe("reset", () => {
    test("resets rate limit for specific token", () => {
      const limiter = new RateLimiter({ burstSize: 2 });

      limiter.checkLimit("token-1");
      limiter.checkLimit("token-1");

      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);

      limiter.reset("token-1");

      expect(() => limiter.checkLimit("token-1")).not.toThrow();
    });

    test("resets all tokens when called without argument", () => {
      const limiter = new RateLimiter({ burstSize: 1 });

      limiter.checkLimit("token-1");
      limiter.checkLimit("token-2");

      expect(() => limiter.checkLimit("token-1")).toThrow(RateLimitError);
      expect(() => limiter.checkLimit("token-2")).toThrow(RateLimitError);

      limiter.reset();

      expect(() => limiter.checkLimit("token-1")).not.toThrow();
      expect(() => limiter.checkLimit("token-2")).not.toThrow();
    });
  });

  describe("RateLimitError", () => {
    test("includes helpful information", () => {
      const limiter = new RateLimiter({ burstSize: 1 });

      limiter.checkLimit("token-1");

      try {
        limiter.checkLimit("token-1");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.message).toContain("Rate limit exceeded");
          expect(error.retryAfter).toBeDefined();
        }
      }
    });
  });
});
