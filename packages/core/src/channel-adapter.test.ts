/**
 * Tests for Channel Adapter Architecture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChannelAdapter,
  ChannelRegistry,
  MessageNormalizer,
  channelConfigSchema,
  outboundMessageSchema,
  type ChannelConfig,
  type ChannelCapabilities,
  type ChannelEvent,
  type ConnectionState,
  type HealthStatus,
  type InboundMessage,
  type OutboundMessage,
  type SendResult,
} from './channel-adapter.js';

// =====================================================
// Mock Adapter Implementation
// =====================================================

class MockAdapter extends ChannelAdapter {
  readonly platform = 'mock';
  public connectCalled = false;
  public disconnectCalled = false;
  public lastSentMessage: OutboundMessage | null = null;
  public shouldFailConnect = false;
  public shouldFailHealth = false;

  async connect(_config: ChannelConfig): Promise<void> {
    if (this.shouldFailConnect) {
      throw new Error('Mock connection failed');
    }
    this.connectCalled = true;
  }

  async disconnect(): Promise<void> {
    this.disconnectCalled = true;
  }

  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    this.lastSentMessage = message;
    return {
      success: true,
      platformMessageId: `mock-${Date.now()}`,
      deliveredAt: new Date(),
    };
  }

  getCapabilities(): ChannelCapabilities {
    return {
      supportedMedia: ['image', 'audio', 'video', 'file'],
      maxTextLength: 4096,
      supportsThreads: true,
      supportsReactions: true,
      supportsEditing: true,
      supportsDeleting: true,
      supportsTypingIndicator: true,
      supportsReadReceipts: false,
      supportsActions: true,
      supportsGroupChat: true,
      supportsMarkdown: true,
      maxFileSize: 50 * 1024 * 1024,
    };
  }

  async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
    if (this.shouldFailHealth) {
      return { status: 'unhealthy', details: 'Mock health check failed' };
    }
    return { status: 'healthy' };
  }

  // Expose protected methods for testing
  public testEmitMessage(msg: InboundMessage): void {
    this.emitMessage(msg);
  }

  public testSetConnectionState(state: ConnectionState, error?: string): void {
    this.setConnectionState(state, error);
  }

  public testTriggerReconnect(): Promise<void> {
    return this.triggerReconnect();
  }
}

// =====================================================
// Test Helpers
// =====================================================

function createMockConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'test-adapter-1',
    platform: 'mock',
    orgId: 'org-123',
    agentId: 'agent-456',
    enabled: true,
    credentials: { apiKey: 'test-key' },
    autoReconnect: false,
    ...overrides,
  };
}

function createMockInboundMessage(): InboundMessage {
  return {
    platformMessageId: 'msg-123',
    channelId: 'test-adapter-1',
    platform: 'mock',
    chatId: 'chat-789',
    chatType: 'dm',
    sender: {
      platformUserId: 'user-456',
      displayName: 'Test User',
      username: 'testuser',
    },
    text: 'Hello, agent!',
    timestamp: new Date(),
  };
}

// =====================================================
// Tests
// =====================================================

describe('ChannelAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
  });

  describe('lifecycle', () => {
    it('should start in disconnected state', () => {
      expect(adapter.getConnectionState()).toBe('disconnected');
    });

    it('should connect and update state', async () => {
      await adapter.start(createMockConfig());
      expect(adapter.connectCalled).toBe(true);
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('should store config on start', async () => {
      const config = createMockConfig();
      await adapter.start(config);
      expect(adapter.getConfig()).toEqual(config);
    });

    it('should disconnect and update state', async () => {
      await adapter.start(createMockConfig());
      await adapter.stop();
      expect(adapter.disconnectCalled).toBe(true);
      expect(adapter.getConnectionState()).toBe('disconnected');
    });

    it('should clear config on stop', async () => {
      await adapter.start(createMockConfig());
      await adapter.stop();
      expect(adapter.getConfig()).toBeNull();
    });

    it('should handle connect failure', async () => {
      adapter.shouldFailConnect = true;
      await expect(adapter.start(createMockConfig())).rejects.toThrow(
        'Mock connection failed'
      );
    });
  });

  describe('events', () => {
    it('should register and call event handlers', async () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      await adapter.start(createMockConfig());

      // Should have connecting + connected events
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[0].type).toBe('connection_state');
      expect((events[0].data as any).state).toBe('connecting');
      expect(events[1].type).toBe('connection_state');
      expect((events[1].data as any).state).toBe('connected');
    });

    it('should emit message events', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const msg = createMockInboundMessage();
      adapter.testEmitMessage(msg);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message');
      expect((events[0].data as InboundMessage).text).toBe('Hello, agent!');
    });

    it('should unregister event handlers', () => {
      const events: ChannelEvent[] = [];
      const unsubscribe = adapter.on((event) => events.push(event));

      adapter.testEmitMessage(createMockInboundMessage());
      expect(events).toHaveLength(1);

      unsubscribe();
      adapter.testEmitMessage(createMockInboundMessage());
      expect(events).toHaveLength(1); // No new events
    });

    it('should handle errors in event handlers gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      adapter.on(() => {
        throw new Error('Handler error');
      });

      // Should not throw
      adapter.testEmitMessage(createMockInboundMessage());
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const result = await adapter.sendMessage({
        chatId: 'chat-123',
        text: 'Hello from agent!',
      });

      expect(result.success).toBe(true);
      expect(result.platformMessageId).toBeDefined();
      expect(adapter.lastSentMessage?.text).toBe('Hello from agent!');
    });
  });

  describe('capabilities', () => {
    it('should return capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.maxTextLength).toBe(4096);
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportedMedia).toContain('image');
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
    });

    it('should return unhealthy status', async () => {
      adapter.shouldFailHealth = true;
      const health = await adapter.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('default optional methods', () => {
    it('should return failure for editMessage by default', async () => {
      const result = await adapter.editMessage('msg-1', { text: 'edited' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });

    it('should return false for deleteMessage by default', async () => {
      const result = await adapter.deleteMessage('msg-1', 'chat-1');
      expect(result).toBe(false);
    });

    it('should not throw for sendTypingIndicator by default', async () => {
      await expect(adapter.sendTypingIndicator('chat-1')).resolves.not.toThrow();
    });

    it('should return false for addReaction by default', async () => {
      const result = await adapter.addReaction('msg-1', 'chat-1', '👍');
      expect(result).toBe(false);
    });
  });
});

describe('ChannelRegistry', () => {
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
    registry.registerFactory('mock', () => new MockAdapter());
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('factory management', () => {
    it('should register a factory', () => {
      expect(registry.getRegisteredPlatforms()).toContain('mock');
    });

    it('should throw on duplicate factory', () => {
      expect(() =>
        registry.registerFactory('mock', () => new MockAdapter())
      ).toThrow("Factory for platform 'mock' is already registered");
    });

    it('should unregister a factory', () => {
      registry.unregisterFactory('mock');
      expect(registry.getRegisteredPlatforms()).not.toContain('mock');
    });
  });

  describe('adapter lifecycle', () => {
    it('should create and start an adapter', async () => {
      const adapter = await registry.createAdapter(createMockConfig());
      expect(adapter).toBeInstanceOf(MockAdapter);
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('should throw for unknown platform', async () => {
      await expect(
        registry.createAdapter(createMockConfig({ platform: 'unknown' }))
      ).rejects.toThrow("No factory registered for platform 'unknown'");
    });

    it('should throw for duplicate adapter ID', async () => {
      await registry.createAdapter(createMockConfig());
      await expect(
        registry.createAdapter(createMockConfig())
      ).rejects.toThrow("Adapter with ID 'test-adapter-1' already exists");
    });

    it('should get adapter by ID', async () => {
      await registry.createAdapter(createMockConfig());
      const adapter = registry.getAdapter('test-adapter-1');
      expect(adapter).toBeDefined();
    });

    it('should return undefined for unknown ID', () => {
      expect(registry.getAdapter('nonexistent')).toBeUndefined();
    });

    it('should list all adapters', async () => {
      await registry.createAdapter(createMockConfig({ id: 'a1' }));
      await registry.createAdapter(createMockConfig({ id: 'a2' }));
      const all = registry.getAllAdapters();
      expect(all.size).toBe(2);
    });

    it('should remove an adapter', async () => {
      await registry.createAdapter(createMockConfig());
      await registry.removeAdapter('test-adapter-1');
      expect(registry.getAdapter('test-adapter-1')).toBeUndefined();
    });

    it('should not create adapter if disabled', async () => {
      const adapter = (await registry.createAdapter(
        createMockConfig({ enabled: false })
      )) as MockAdapter;
      expect(adapter.connectCalled).toBe(false);
      expect(adapter.getConnectionState()).toBe('disconnected');
    });
  });

  describe('hot reload', () => {
    it('should reload an adapter with new config', async () => {
      await registry.createAdapter(createMockConfig());
      const newAdapter = await registry.reloadAdapter(
        createMockConfig({ credentials: { apiKey: 'new-key' } })
      );
      expect(newAdapter).toBeDefined();
      expect(newAdapter.getConnectionState()).toBe('connected');
    });
  });

  describe('global events', () => {
    it('should forward events to global handlers', async () => {
      const events: ChannelEvent[] = [];
      registry.onGlobal((event) => events.push(event));

      await registry.createAdapter(createMockConfig());

      // Should have received connection state events
      expect(events.length).toBeGreaterThan(0);
    });

    it('should unregister global handlers', async () => {
      const events: ChannelEvent[] = [];
      const unsub = registry.onGlobal((event) => events.push(event));
      unsub();

      await registry.createAdapter(createMockConfig());
      expect(events).toHaveLength(0);
    });
  });

  describe('health check', () => {
    it('should health check all adapters', async () => {
      await registry.createAdapter(createMockConfig({ id: 'h1' }));
      await registry.createAdapter(createMockConfig({ id: 'h2' }));

      const results = await registry.healthCheckAll();
      expect(results.size).toBe(2);
      expect(results.get('h1')?.status).toBe('healthy');
      expect(results.get('h2')?.status).toBe('healthy');
    });

    it('should handle health check errors', async () => {
      const adapter = (await registry.createAdapter(
        createMockConfig()
      )) as MockAdapter;
      adapter.shouldFailHealth = true;

      const results = await registry.healthCheckAll();
      expect(results.get('test-adapter-1')?.status).toBe('unhealthy');
    });
  });

  describe('shutdown', () => {
    it('should stop all adapters', async () => {
      await registry.createAdapter(createMockConfig({ id: 's1' }));
      await registry.createAdapter(createMockConfig({ id: 's2' }));

      await registry.shutdown();
      expect(registry.getAllAdapters().size).toBe(0);
    });
  });
});

describe('MessageNormalizer', () => {
  it('should normalize a message', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'msg-1',
      channelId: 'ch-1',
      platform: 'telegram',
      chatId: 'chat-1',
      chatType: 'dm',
      senderId: 'user-1',
      senderName: 'Alice',
      senderUsername: 'alice',
      text: 'Hello!',
    });

    expect(msg.platformMessageId).toBe('msg-1');
    expect(msg.platform).toBe('telegram');
    expect(msg.sender.displayName).toBe('Alice');
    expect(msg.text).toBe('Hello!');
    expect(msg.timestamp).toBeInstanceOf(Date);
  });

  it('should include reply info', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'msg-2',
      channelId: 'ch-1',
      platform: 'discord',
      chatId: 'chat-1',
      chatType: 'group',
      senderId: 'user-2',
      replyToId: 'msg-1',
      replyToText: 'Original message',
    });

    expect(msg.replyTo).toBeDefined();
    expect(msg.replyTo?.platformMessageId).toBe('msg-1');
    expect(msg.replyTo?.text).toBe('Original message');
  });

  it('should not include reply if no replyToId', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'msg-3',
      channelId: 'ch-1',
      platform: 'slack',
      chatId: 'chat-1',
      chatType: 'channel',
      senderId: 'user-3',
    });

    expect(msg.replyTo).toBeUndefined();
  });

  it('should truncate text', () => {
    const long = 'a'.repeat(5000);
    const truncated = MessageNormalizer.truncateText(long, 4096);
    expect(truncated.length).toBe(4096);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should not truncate short text', () => {
    const short = 'Hello';
    expect(MessageNormalizer.truncateText(short, 4096)).toBe('Hello');
  });

  it('should convert markdown to plain text', () => {
    const md = '**bold** and *italic* with `code` and [link](https://example.com)';
    const plain = MessageNormalizer.markdownToPlainText(md);
    expect(plain).toBe('bold and italic with code and link');
  });
});

describe('Zod Schemas', () => {
  it('should validate channel config', () => {
    const result = channelConfigSchema.safeParse({
      id: 'test-1',
      platform: 'telegram',
      orgId: 'org-1',
      agentId: 'agent-1',
      enabled: true,
      credentials: { botToken: 'xxx' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid channel config', () => {
    const result = channelConfigSchema.safeParse({
      id: 'test-1',
      // Missing required fields
    });
    expect(result.success).toBe(false);
  });

  it('should validate outbound message', () => {
    const result = outboundMessageSchema.safeParse({
      chatId: 'chat-1',
      text: 'Hello!',
      markdown: true,
    });
    expect(result.success).toBe(true);
  });

  it('should validate outbound message with optional fields', () => {
    const result = outboundMessageSchema.safeParse({
      chatId: 'chat-1',
      replyToMessageId: 'msg-1',
      threadId: 'thread-1',
      showTyping: true,
      typingDurationMs: 2000,
    });
    expect(result.success).toBe(true);
  });
});
