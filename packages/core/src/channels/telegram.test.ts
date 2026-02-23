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

describe('TelegramChannel — lifecycle and routing', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockTelegramApi(result: unknown, ok = true) {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok, result }),
    });
  }

  it('should set isRunning to true after start and false after stop', async () => {
    // getMe, deleteWebhook, getUpdates (first poll)
    mockTelegramApi({ id: 1, is_bot: true, username: 'bot' });
    mockTelegramApi(true);
    mockTelegramApi([]);
    // agents:get query
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: { name: 'TestAgent', model: 'gpt-4o', provider: 'openai' } }),
    });

    const channel = new TelegramChannel(createTestConfig());
    await channel.start();
    expect(channel.running).toBe(true);

    await channel.stop();
    expect(channel.running).toBe(false);
  });

  it('should not start again if already running', async () => {
    mockTelegramApi({ id: 1, is_bot: true, username: 'bot' });
    mockTelegramApi(true);
    mockTelegramApi([]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ value: { name: 'A', model: 'm', provider: 'p' } }),
    });

    const channel = new TelegramChannel(createTestConfig());
    await channel.start();

    // Record how many fetch calls happened
    const callCountAfterStart = mockFetch.mock.calls.length;

    // Second start should be a no-op (logs a warning)
    await channel.start();
    expect(mockFetch.mock.calls.length).toBe(callCountAfterStart);

    await channel.stop();
  });

  it('should route voice message type differently from text messages', () => {
    const channel = new TelegramChannel(createTestConfig());
    // Expose private method for testing
    const handleInbound = (channel as any).handleInboundMessage.bind(channel);

    // Spy on handleVoiceMessage
    const voiceSpy = vi.spyOn(channel as any, 'handleVoiceMessage').mockResolvedValue(undefined);
    const routeSpy = vi.spyOn(channel as any, 'routeToAgent').mockResolvedValue(undefined);

    // Voice-only message (no text)
    const voiceMsg = {
      platformMessageId: 'v1',
      channelId: 'ch1',
      platform: 'telegram',
      chatId: '123',
      chatType: 'dm' as const,
      sender: { platformUserId: '456', displayName: 'Alice' },
      text: '',
      media: [{ type: 'voice_note' as const, url: 'telegram:file:voice-id' }],
      timestamp: new Date(),
      isEdit: false,
    };

    handleInbound(voiceMsg);
    expect(voiceSpy).toHaveBeenCalled();
    expect(routeSpy).not.toHaveBeenCalled();
  });

  it('should skip empty text messages without media', () => {
    const channel = new TelegramChannel(createTestConfig());
    const handleInbound = (channel as any).handleInboundMessage.bind(channel);

    const routeSpy = vi.spyOn(channel as any, 'routeToAgent').mockResolvedValue(undefined);
    const voiceSpy = vi.spyOn(channel as any, 'handleVoiceMessage').mockResolvedValue(undefined);

    const emptyMsg = {
      platformMessageId: 'e1',
      channelId: 'ch1',
      platform: 'telegram',
      chatId: '123',
      chatType: 'dm' as const,
      sender: { platformUserId: '456', displayName: 'Bob' },
      text: '   ',
      media: undefined,
      timestamp: new Date(),
      isEdit: false,
    };

    handleInbound(emptyMsg);
    expect(routeSpy).not.toHaveBeenCalled();
    expect(voiceSpy).not.toHaveBeenCalled();
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
