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

// =====================================================
// New Integration Tests (AGE-118 / SPEC-20260223-001)
// =====================================================

// Second mock platform for multi-channel tests
class AltAdapter extends ChannelAdapter {
  readonly platform = 'alt';
  public lastSentMessage: OutboundMessage | null = null;

  async connect(_config: ChannelConfig): Promise<void> {}
  async disconnect(): Promise<void> {}
  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    this.lastSentMessage = message;
    return { success: true, platformMessageId: `alt-${Date.now()}`, deliveredAt: new Date() };
  }
  getCapabilities(): ChannelCapabilities {
    return {
      supportedMedia: ['image', 'voice_note'],
      maxTextLength: 2000,
      supportsThreads: false,
      supportsReactions: false,
      supportsEditing: false,
      supportsDeleting: false,
      supportsTypingIndicator: false,
      supportsReadReceipts: false,
      supportsActions: false,
      supportsGroupChat: true,
      supportsMarkdown: false,
    };
  }
  async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
    return { status: 'healthy' };
  }
  public testEmitMessage(msg: InboundMessage): void {
    this.emitMessage(msg);
  }
}

describe('Multi-channel routing', () => {
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
    registry.registerFactory('mock', () => new MockAdapter());
    registry.registerFactory('alt', () => new AltAdapter());
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  it('should route messages from two adapters independently', async () => {
    const mockEvents: ChannelEvent[] = [];
    const altEvents: ChannelEvent[] = [];

    const mockAdapter = await registry.createAdapter(
      createMockConfig({ id: 'mock-1', platform: 'mock' })
    );
    const altAdapter = await registry.createAdapter(
      createMockConfig({ id: 'alt-1', platform: 'alt' })
    );

    mockAdapter.on((e) => { if (e.type === 'message') mockEvents.push(e); });
    altAdapter.on((e) => { if (e.type === 'message') altEvents.push(e); });

    const mockMsg: InboundMessage = { ...createMockInboundMessage(), channelId: 'mock-1', platform: 'mock' };
    const altMsg: InboundMessage = { ...createMockInboundMessage(), channelId: 'alt-1', platform: 'alt', platformMessageId: 'alt-msg-1' };

    (mockAdapter as MockAdapter).testEmitMessage(mockMsg);
    (altAdapter as AltAdapter).testEmitMessage(altMsg);

    expect(mockEvents).toHaveLength(1);
    expect((mockEvents[0].data as InboundMessage).platform).toBe('mock');
    expect(altEvents).toHaveLength(1);
    expect((altEvents[0].data as InboundMessage).platform).toBe('alt');
  });

  it('should not cross-contaminate messages between adapters', async () => {
    const altEvents: ChannelEvent[] = [];

    const mockAdapter = await registry.createAdapter(
      createMockConfig({ id: 'mock-2', platform: 'mock' })
    );
    const altAdapter = await registry.createAdapter(
      createMockConfig({ id: 'alt-2', platform: 'alt' })
    );

    altAdapter.on((e) => { if (e.type === 'message') altEvents.push(e); });

    // Only emit on mockAdapter — altAdapter handler must NOT fire
    (mockAdapter as MockAdapter).testEmitMessage(createMockInboundMessage());

    expect(altEvents).toHaveLength(0);
  });

  it('should return all adapters from getAllAdapters', async () => {
    await registry.createAdapter(createMockConfig({ id: 'mc-1', platform: 'mock' }));
    await registry.createAdapter(createMockConfig({ id: 'ac-1', platform: 'alt' }));

    const all = registry.getAllAdapters();
    expect(all.size).toBe(2);
    expect(all.has('mc-1')).toBe(true);
    expect(all.has('ac-1')).toBe(true);
  });
});

describe('Media type normalization', () => {
  it('should normalize an image message', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'img-1',
      channelId: 'ch-1',
      platform: 'telegram',
      chatId: 'chat-1',
      chatType: 'dm',
      senderId: 'user-1',
      media: [
        {
          type: 'image',
          url: 'https://example.com/photo.jpg',
          mimeType: 'image/jpeg',
          width: 1280,
          height: 720,
          caption: 'A nice photo',
        },
      ],
    });

    expect(msg.media).toHaveLength(1);
    expect(msg.media![0].type).toBe('image');
    expect(msg.media![0].width).toBe(1280);
    expect(msg.media![0].caption).toBe('A nice photo');
  });

  it('should normalize a voice_note message', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'voice-1',
      channelId: 'ch-1',
      platform: 'telegram',
      chatId: 'chat-1',
      chatType: 'dm',
      senderId: 'user-1',
      media: [
        {
          type: 'voice_note',
          url: 'https://example.com/voice.ogg',
          mimeType: 'audio/ogg',
          durationSeconds: 12,
        },
      ],
    });

    expect(msg.media).toHaveLength(1);
    expect(msg.media![0].type).toBe('voice_note');
    expect(msg.media![0].durationSeconds).toBe(12);
  });

  it('should emit a reaction event with correct payload', () => {
    const adapter = new MockAdapter();
    const events: ChannelEvent[] = [];
    adapter.on((e) => events.push(e));

    // Access emit through the public testSetConnectionState pathway to simulate an emit
    // We use a direct cast to access the protected emit for the reaction event
    (adapter as any).emit({
      type: 'reaction',
      data: { messageId: 'msg-1', emoji: '👍', userId: 'user-1', added: true },
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('reaction');
    const data = (events[0] as Extract<ChannelEvent, { type: 'reaction' }>).data;
    expect(data.emoji).toBe('👍');
    expect(data.added).toBe(true);
  });

  it('should normalize a message with no text or media (empty content)', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'empty-1',
      channelId: 'ch-1',
      platform: 'discord',
      chatId: 'chat-1',
      chatType: 'group',
      senderId: 'user-1',
    });

    expect(msg.text).toBeUndefined();
    expect(msg.media).toBeUndefined();
    expect(msg.platformMessageId).toBe('empty-1');
  });
});

describe('Connection lifecycle sequence', () => {
  it('should transition through connecting → connected → disconnected on start/stop', async () => {
    const adapter = new MockAdapter();
    const states: ConnectionState[] = [];
    adapter.on((e) => {
      if (e.type === 'connection_state') {
        states.push((e.data as { state: ConnectionState }).state);
      }
    });

    await adapter.start(createMockConfig());
    await adapter.stop();

    expect(states).toEqual(['connecting', 'connected', 'disconnected']);
  });

  it('should allow restarting after stop', async () => {
    const adapter = new MockAdapter();
    await adapter.start(createMockConfig());
    await adapter.stop();

    // Restart should succeed — not throw
    await adapter.start(createMockConfig({ id: 'restart-test' }));
    expect(adapter.getConnectionState()).toBe('connected');
    await adapter.stop();
  });

  it('should emit error state when connect fails with autoReconnect disabled', async () => {
    const adapter = new MockAdapter();
    adapter.shouldFailConnect = true;
    const states: ConnectionState[] = [];
    adapter.on((e) => {
      if (e.type === 'connection_state') {
        states.push((e.data as { state: ConnectionState }).state);
      }
    });

    await expect(adapter.start(createMockConfig({ autoReconnect: false }))).rejects.toThrow();
    expect(states).toContain('error');
  });
});

describe('Health check statuses', () => {
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
    registry.registerFactory('mock', () => new MockAdapter());
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  it('should include platform name in healthCheckAll results', async () => {
    await registry.createAdapter(createMockConfig({ id: 'hp-1' }));
    const results = await registry.healthCheckAll();
    expect(results.get('hp-1')?.platform).toBe('mock');
  });

  it('should report degraded status when adapter returns degraded', async () => {
    // Override healthCheck at instance level after creation
    const adapter = (await registry.createAdapter(createMockConfig({ id: 'deg-1' }))) as MockAdapter;
    vi.spyOn(adapter, 'healthCheck').mockResolvedValueOnce({ status: 'degraded', details: 'high latency' });

    const results = await registry.healthCheckAll();
    expect(results.get('deg-1')?.status).toBe('degraded');
    expect(results.get('deg-1')?.details).toBe('high latency');
  });

  it('should catch thrown errors from healthCheck and report unhealthy', async () => {
    const adapter = (await registry.createAdapter(createMockConfig({ id: 'throw-1' }))) as MockAdapter;
    vi.spyOn(adapter, 'healthCheck').mockRejectedValueOnce(new Error('network timeout'));

    const results = await registry.healthCheckAll();
    expect(results.get('throw-1')?.status).toBe('unhealthy');
    expect(results.get('throw-1')?.details).toContain('network timeout');
  });
});

describe('Connection state event emission', () => {
  it('should emit connection_state event with correct state when setConnectionState is called', () => {
    const adapter = new MockAdapter();
    const states: Array<{ state: ConnectionState; error?: string }> = [];
    adapter.on((e) => {
      if (e.type === 'connection_state') {
        states.push(e.data as { state: ConnectionState; error?: string });
      }
    });

    adapter.testSetConnectionState('connecting');
    adapter.testSetConnectionState('connected');
    adapter.testSetConnectionState('error', 'something broke');

    expect(states[0].state).toBe('connecting');
    expect(states[1].state).toBe('connected');
    expect(states[2].state).toBe('error');
    expect(states[2].error).toBe('something broke');
  });
});

describe('Registry edge cases', () => {
  let registry: ChannelRegistry;

  beforeEach(() => {
    registry = new ChannelRegistry();
    registry.registerFactory('mock', () => new MockAdapter());
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  it('should not throw when removing a non-existent adapter', async () => {
    await expect(registry.removeAdapter('does-not-exist')).resolves.not.toThrow();
  });

  it('getAllAdapters should return a defensive copy (mutations do not affect registry)', async () => {
    await registry.createAdapter(createMockConfig({ id: 'copy-test' }));
    const snapshot = registry.getAllAdapters();
    snapshot.delete('copy-test');

    // Registry still has the adapter
    expect(registry.getAdapter('copy-test')).toBeDefined();
  });

  it('should allow re-registering a factory after unregistering', () => {
    registry.unregisterFactory('mock');
    expect(() => registry.registerFactory('mock', () => new MockAdapter())).not.toThrow();
    expect(registry.getRegisteredPlatforms()).toContain('mock');
  });
});

describe('MessageNormalizer missing/optional fields', () => {
  it('should inject a default timestamp when none is provided', () => {
    const before = new Date();
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'ts-1',
      channelId: 'ch-1',
      platform: 'slack',
      chatId: 'chat-1',
      chatType: 'channel',
      senderId: 'user-1',
    });
    const after = new Date();

    expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should preserve explicit timestamp when provided', () => {
    const ts = new Date('2025-01-01T00:00:00Z');
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'ts-2',
      channelId: 'ch-1',
      platform: 'slack',
      chatId: 'chat-1',
      chatType: 'channel',
      senderId: 'user-1',
      timestamp: ts,
    });

    expect(msg.timestamp).toEqual(ts);
  });

  it('should leave sender optional fields undefined when not provided', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'sender-1',
      channelId: 'ch-1',
      platform: 'discord',
      chatId: 'chat-1',
      chatType: 'dm',
      senderId: 'user-min',
    });

    expect(msg.sender.platformUserId).toBe('user-min');
    expect(msg.sender.displayName).toBeUndefined();
    expect(msg.sender.username).toBeUndefined();
    expect(msg.sender.avatarUrl).toBeUndefined();
  });

  it('should handle isEdit flag correctly', () => {
    const msg = MessageNormalizer.normalize({
      platformMessageId: 'edit-1',
      channelId: 'ch-1',
      platform: 'telegram',
      chatId: 'chat-1',
      chatType: 'group',
      senderId: 'user-1',
      text: 'edited text',
      isEdit: true,
    });

    expect(msg.isEdit).toBe(true);
  });

  it('should strip markdown headers and lists correctly', () => {
    const md = '# Title\n## Subtitle\n- item one\n* item two';
    const plain = MessageNormalizer.markdownToPlainText(md);
    expect(plain).not.toContain('#');
    expect(plain).toContain('• item one');
    expect(plain).toContain('• item two');
    expect(plain).toContain('Title');
  });
});

describe('Concurrent message processing', () => {
  it('should handle multiple simultaneous sendMessage calls independently', async () => {
    const adapter = new MockAdapter();

    const results = await Promise.all([
      adapter.sendMessage({ chatId: 'chat-1', text: 'msg-a' }),
      adapter.sendMessage({ chatId: 'chat-2', text: 'msg-b' }),
      adapter.sendMessage({ chatId: 'chat-3', text: 'msg-c' }),
    ]);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    expect(results.every((r) => r.platformMessageId !== undefined)).toBe(true);
  });

  it('should handle concurrent inbound events without dropping any', () => {
    const adapter = new MockAdapter();
    const received: string[] = [];
    adapter.on((e) => {
      if (e.type === 'message') {
        received.push((e.data as InboundMessage).platformMessageId);
      }
    });

    const ids = ['m1', 'm2', 'm3', 'm4', 'm5'];
    ids.forEach((id) => {
      adapter.testEmitMessage({ ...createMockInboundMessage(), platformMessageId: id });
    });

    expect(received).toHaveLength(ids.length);
    expect(received).toEqual(ids);
  });
});

describe('Adapter configuration validation (Zod)', () => {
  it('should reject config with missing credentials field', () => {
    const result = channelConfigSchema.safeParse({
      id: 'bad-1',
      platform: 'telegram',
      orgId: 'org-1',
      agentId: 'agent-1',
      enabled: true,
      // credentials omitted
    });
    expect(result.success).toBe(false);
  });

  it('should reject config with invalid webhookUrl', () => {
    const result = channelConfigSchema.safeParse({
      id: 'bad-2',
      platform: 'telegram',
      orgId: 'org-1',
      agentId: 'agent-1',
      enabled: true,
      credentials: {},
      webhookUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should accept config with valid webhookUrl', () => {
    const result = channelConfigSchema.safeParse({
      id: 'good-1',
      platform: 'telegram',
      orgId: 'org-1',
      agentId: 'agent-1',
      enabled: true,
      credentials: { botToken: 'abc' },
      webhookUrl: 'https://example.com/webhook',
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-positive reconnectIntervalMs', () => {
    const result = channelConfigSchema.safeParse({
      id: 'bad-3',
      platform: 'telegram',
      orgId: 'org-1',
      agentId: 'agent-1',
      enabled: true,
      credentials: {},
      reconnectIntervalMs: -1000,
    });
    expect(result.success).toBe(false);
  });
});
