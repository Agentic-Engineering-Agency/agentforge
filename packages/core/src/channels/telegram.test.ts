/**
 * Tests for Telegram Channel Runner.
 *
 * Tests the TelegramChannel class that bridges the TelegramAdapter
 * with the Convex chat pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelegramChannel, startTelegramChannel } from './telegram.js';
import type { TelegramChannelConfig } from './telegram.js';

// =====================================================
// Test Helpers
// =====================================================

function createTestConfig(overrides: Partial<TelegramChannelConfig> = {}): TelegramChannelConfig {
  return {
    botToken: 'test-bot-token-123',
    agentId: 'test-agent-1',
    convexUrl: 'https://test-deployment.convex.cloud',
    logLevel: 'error', // Suppress logs in tests
    ...overrides,
  };
}

// =====================================================
// Tests
// =====================================================

describe('TelegramChannel', () => {
  describe('constructor', () => {
    it('should create a TelegramChannel instance', () => {
      const channel = new TelegramChannel(createTestConfig());
      expect(channel).toBeInstanceOf(TelegramChannel);
      expect(channel.running).toBe(false);
    });

    it('should initialize with empty thread map', () => {
      const channel = new TelegramChannel(createTestConfig());
      expect(channel.getThreadMap().size).toBe(0);
    });

    it('should expose the underlying adapter', () => {
      const channel = new TelegramChannel(createTestConfig());
      expect(channel.getAdapter()).toBeDefined();
      expect(channel.getAdapter().platform).toBe('telegram');
    });
  });

  describe('stop', () => {
    it('should be safe to call stop when not running', async () => {
      const channel = new TelegramChannel(createTestConfig());
      await expect(channel.stop()).resolves.not.toThrow();
    });
  });

  describe('message splitting', () => {
    it('should not split short messages', () => {
      const channel = new TelegramChannel(createTestConfig());
      // Access private method via any cast for testing
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const result = splitMessage('Hello, world!', 4096);
      expect(result).toEqual(['Hello, world!']);
    });

    it('should split messages exceeding max length', () => {
      const channel = new TelegramChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const longText = 'A'.repeat(5000);
      const result = splitMessage(longText, 4096);
      expect(result.length).toBeGreaterThan(1);
      // All chunks should be within limit
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
    });

    it('should prefer splitting at paragraph breaks', () => {
      const channel = new TelegramChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2000) + '\n\n' + 'B'.repeat(2000) + '\n\n' + 'C'.repeat(2000);
      const result = splitMessage(text, 4096);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle text with no natural break points', () => {
      const channel = new TelegramChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'X'.repeat(10000); // No spaces or newlines
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(3); // ceil(10000/4096) = 3
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
    });
  });
});

describe('startTelegramChannel', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw if botToken is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await expect(
      startTelegramChannel({ agentId: 'test', convexUrl: 'https://test.convex.cloud' })
    ).rejects.toThrow('TELEGRAM_BOT_TOKEN is required');
  });

  it('should throw if convexUrl is missing', async () => {
    delete process.env.CONVEX_URL;
    await expect(
      startTelegramChannel({ botToken: 'test-token', agentId: 'test' })
    ).rejects.toThrow('CONVEX_URL is required');
  });

  it('should throw if agentId is missing', async () => {
    delete process.env.AGENTFORGE_AGENT_ID;
    await expect(
      startTelegramChannel({ botToken: 'test-token', convexUrl: 'https://test.convex.cloud' })
    ).rejects.toThrow('Agent ID is required');
  });
});
