/**
 * Tests for WhatsApp Channel Runner.
 *
 * Tests the WhatsAppChannel class that bridges the WhatsAppAdapter
 * with the Convex chat pipeline.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhatsAppChannel, startWhatsAppChannel } from './whatsapp.js';
import type { WhatsAppChannelConfig } from './whatsapp.js';

// =====================================================
// Test Helpers
// =====================================================

function createTestConfig(overrides: Partial<WhatsAppChannelConfig> = {}): WhatsAppChannelConfig {
  return {
    accessToken: 'test-access-token-123',
    phoneNumberId: '123456789',
    verifyToken: 'test-verify-token',
    agentId: 'test-agent-1',
    convexUrl: 'https://test-deployment.convex.cloud',
    logLevel: 'error', // Suppress logs in tests
    webhookPort: 0, // Disable webhook server in tests
    ...overrides,
  };
}

// =====================================================
// Tests
// =====================================================

describe('WhatsAppChannel', () => {
  describe('constructor', () => {
    it('should create a WhatsAppChannel instance', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      expect(channel).toBeInstanceOf(WhatsAppChannel);
      expect(channel.running).toBe(false);
    });

    it('should initialize with empty thread map', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      expect(channel.getThreadMap().size).toBe(0);
    });

    it('should expose the underlying adapter', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      expect(channel.getAdapter()).toBeDefined();
      expect(channel.getAdapter().platform).toBe('whatsapp');
    });
  });

  describe('stop', () => {
    it('should be safe to call stop when not running', async () => {
      const channel = new WhatsAppChannel(createTestConfig());
      await expect(channel.stop()).resolves.not.toThrow();
    });
  });

  describe('message splitting', () => {
    it('should not split short messages', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const result = splitMessage('Hello, world!', 4096);
      expect(result).toEqual(['Hello, world!']);
    });

    it('should split messages exceeding max length', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const longText = 'A'.repeat(5000);
      const result = splitMessage(longText, 4096);
      expect(result.length).toBeGreaterThan(1);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
    });

    it('should prefer splitting at paragraph breaks', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2000) + '\n\n' + 'B'.repeat(2500);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
      expect(result[0]).toContain('A');
      expect(result[1]).toContain('B');
    });

    it('should prefer splitting at line breaks', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2500) + '\n' + 'B'.repeat(2500);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
    });

    it('should prefer splitting at spaces', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(2500) + ' ' + 'B'.repeat(2500);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
    });

    it('should hard split when no good break point exists', () => {
      const channel = new WhatsAppChannel(createTestConfig());
      const splitMessage = (channel as any).splitMessage.bind(channel);
      const text = 'A'.repeat(8192);
      const result = splitMessage(text, 4096);
      expect(result.length).toBe(2);
      expect(result[0].length).toBe(4096);
    });
  });
});

describe('startWhatsAppChannel', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should throw if WHATSAPP_ACCESS_TOKEN is not set', async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await expect(startWhatsAppChannel()).rejects.toThrow('WHATSAPP_ACCESS_TOKEN is required');
  });

  it('should throw if WHATSAPP_PHONE_NUMBER_ID is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    await expect(startWhatsAppChannel()).rejects.toThrow('WHATSAPP_PHONE_NUMBER_ID is required');
  });

  it('should throw if WHATSAPP_VERIFY_TOKEN is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    await expect(startWhatsAppChannel()).rejects.toThrow('WHATSAPP_VERIFY_TOKEN is required');
  });

  it('should throw if CONVEX_URL is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
    delete process.env.CONVEX_URL;
    await expect(startWhatsAppChannel()).rejects.toThrow('CONVEX_URL is required');
  });

  it('should throw if agent ID is not set', async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-token';
    process.env.CONVEX_URL = 'https://test.convex.cloud';
    delete process.env.AGENTFORGE_AGENT_ID;
    await expect(startWhatsAppChannel()).rejects.toThrow('Agent ID is required');
  });

  it('should accept overrides for all env vars and create a channel', async () => {
    // This test verifies the function doesn't throw for missing env vars
    // when overrides are provided. With webhookPort 0, the adapter may
    // start successfully even with fake credentials.
    let channel: any;
    try {
      channel = await startWhatsAppChannel({
        accessToken: 'test',
        phoneNumberId: '123',
        verifyToken: 'verify',
        convexUrl: 'https://test.convex.cloud',
        agentId: 'agent-1',
        webhookPort: 0,
      });
      // If it starts, that's fine — config was accepted
      expect(channel).toBeDefined();
    } catch (err: any) {
      // If it throws, it should NOT be about missing config
      expect(err.message).not.toContain('is required');
    } finally {
      if (channel?.stop) await channel.stop();
    }
  });
});

// =====================================================
// NEW TESTS (AGE-118)
// =====================================================

describe('WhatsAppChannel — running state lifecycle', () => {
  it('should report running=false before start()', () => {
    const channel = new WhatsAppChannel(createTestConfig());
    expect(channel.running).toBe(false);
  });

  it('should report running=false after stop() when not started', async () => {
    const channel = new WhatsAppChannel(createTestConfig());
    await channel.stop();
    expect(channel.running).toBe(false);
  });

  it('should be safe to call stop() multiple times consecutively', async () => {
    const channel = new WhatsAppChannel(createTestConfig());
    await channel.stop();
    await channel.stop();
    expect(channel.running).toBe(false);
  });
});

describe('WhatsAppChannel — handleInboundMessage (unit)', () => {
  it('should skip a message with no text and no media', async () => {
    const channel = new WhatsAppChannel(createTestConfig());
    const handleInboundMessage = (channel as any).handleInboundMessage.bind(channel);

    // Spy on routeToAgent to ensure it is NOT called
    const routeSpy = vi.spyOn(channel as any, 'routeToAgent');

    await handleInboundMessage({
      text: '',
      media: [],
      chatId: '5215551234567',
      platformMessageId: 'wamid.empty',
      sender: { platformUserId: '5215551234567' },
    });

    expect(routeSpy).not.toHaveBeenCalled();
  });

  it('should deduplicate messages with the same chatId + platformMessageId', async () => {
    const channel = new WhatsAppChannel(createTestConfig());
    const handleInboundMessage = (channel as any).handleInboundMessage.bind(channel);

    // Patch routeToAgent to avoid actual Convex calls
    const routeSpy = vi.spyOn(channel as any, 'routeToAgent').mockResolvedValue(undefined);

    const msg = {
      text: 'Hello!',
      media: undefined,
      chatId: '5215551234567',
      platformMessageId: 'wamid.dup123',
      sender: { platformUserId: '5215551234567' },
    };

    await handleInboundMessage(msg);
    await handleInboundMessage(msg);

    // routeToAgent should only be called once despite two calls
    expect(routeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('WhatsAppChannel — media content description in routeToAgent', () => {
  it('should append media description to content when message has both text and media', async () => {
    const channel = new WhatsAppChannel(createTestConfig());

    let capturedArgs: Record<string, unknown> | null = null;

    // Stub the Convex action call
    const convex = (channel as any).convex;
    vi.spyOn(convex, 'action').mockImplementation(
      async (_path: string, args: Record<string, unknown>) => {
        capturedArgs = args;
        return { success: true, response: 'Got it!' };
      }
    );
    // Stub getOrCreateThread
    vi.spyOn(channel as any, 'getOrCreateThread').mockResolvedValue('thread-test-id');
    // Stub adapter.addReaction to avoid real API calls
    vi.spyOn((channel as any).adapter, 'addReaction').mockResolvedValue(true);
    // Stub adapter.sendMessage for response delivery
    vi.spyOn((channel as any).adapter, 'sendMessage').mockResolvedValue({ success: true });

    await (channel as any).routeToAgent({
      text: 'Look at this',
      media: [{ type: 'image', mimeType: 'image/jpeg', url: 'whatsapp:media:abc' }],
      chatId: '5215551234567',
      platformMessageId: 'wamid.media-text',
      sender: { platformUserId: '5215551234567' },
    });

    expect(capturedArgs).not.toBeNull();
    const content = (capturedArgs as any).content as string;
    expect(content).toContain('Look at this');
    expect(content).toContain('[image');
  });

  it('should use only media description when message has no text', async () => {
    const channel = new WhatsAppChannel(createTestConfig());

    let capturedArgs: Record<string, unknown> | null = null;

    const convex = (channel as any).convex;
    vi.spyOn(convex, 'action').mockImplementation(
      async (_path: string, args: Record<string, unknown>) => {
        capturedArgs = args;
        return { success: true, response: 'Noted.' };
      }
    );
    vi.spyOn(channel as any, 'getOrCreateThread').mockResolvedValue('thread-media-only');
    vi.spyOn((channel as any).adapter, 'addReaction').mockResolvedValue(true);
    vi.spyOn((channel as any).adapter, 'sendMessage').mockResolvedValue({ success: true });

    await (channel as any).routeToAgent({
      text: '',
      media: [{ type: 'audio', mimeType: 'audio/ogg', url: 'whatsapp:media:xyz', fileName: 'voice.ogg' }],
      chatId: '5215551234567',
      platformMessageId: 'wamid.audio-only',
      sender: { platformUserId: '5215551234567' },
    });

    expect(capturedArgs).not.toBeNull();
    const content = (capturedArgs as any).content as string;
    expect(content).toContain('[audio');
    expect(content).not.toMatch(/^\s/); // No leading whitespace
  });
});

describe('WhatsAppChannel — getOrCreateThread caching', () => {
  it('should create a thread on first call and cache it', async () => {
    const channel = new WhatsAppChannel(createTestConfig());
    const convex = (channel as any).convex;
    // mutation is called twice per getOrCreateThread: chat:createThread + logs:add
    const mutationSpy = vi.spyOn(convex, 'mutation').mockImplementation(
      async (path: string) => {
        if (path === 'chat:createThread') return 'new-thread-id-001';
        return undefined; // logs:add
      }
    );

    const id1 = await (channel as any).getOrCreateThread('5215550001111', 'Bob');
    expect(id1).toBe('new-thread-id-001');

    // chat:createThread was called exactly once
    const createThreadCalls = mutationSpy.mock.calls.filter(
      ([path]) => path === 'chat:createThread'
    );
    expect(createThreadCalls).toHaveLength(1);

    // Second call should use cache — chat:createThread not called again
    const id2 = await (channel as any).getOrCreateThread('5215550001111', 'Bob');
    expect(id2).toBe('new-thread-id-001');

    const createThreadCallsAfter = mutationSpy.mock.calls.filter(
      ([path]) => path === 'chat:createThread'
    );
    expect(createThreadCallsAfter).toHaveLength(1);
  });

  it('should create separate threads for different phone numbers', async () => {
    const channel = new WhatsAppChannel(createTestConfig());
    const convex = (channel as any).convex;

    let createThreadCount = 0;
    vi.spyOn(convex, 'mutation').mockImplementation(async (path: string) => {
      if (path === 'chat:createThread') {
        createThreadCount++;
        return createThreadCount === 1 ? 'thread-alice' : 'thread-bob';
      }
      return undefined; // logs:add
    });

    const idAlice = await (channel as any).getOrCreateThread('5215550000001', 'Alice');
    const idBob = await (channel as any).getOrCreateThread('5215550000002', 'Bob');

    expect(idAlice).toBe('thread-alice');
    expect(idBob).toBe('thread-bob');
    expect(channel.getThreadMap().size).toBe(2);
  });
});
