import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SlackAdapter } from './slack-adapter.js';
import { slackConfigSchema } from './types.js';
import type { ChannelConfig } from '@agentforge-ai/core';

// =====================================================
// Mock @slack/bolt
// =====================================================

const mockPostMessage = vi.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' });
const mockChatDelete = vi.fn().mockResolvedValue({ ok: true });
const mockChatUpdate = vi.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' });
const mockReactionsAdd = vi.fn().mockResolvedValue({ ok: true });
const mockAuthTest = vi.fn().mockResolvedValue({ ok: true, user: 'testbot', team: 'TestTeam' });
const mockAppStart = vi.fn().mockResolvedValue(undefined);
const mockAppStop = vi.fn().mockResolvedValue(undefined);
const mockAppMessage = vi.fn();
const mockAppEvent = vi.fn();
const mockAppCommand = vi.fn();

vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(() => ({
    client: {
      chat: {
        postMessage: mockPostMessage,
        delete: mockChatDelete,
        update: mockChatUpdate,
      },
      reactions: { add: mockReactionsAdd },
      auth: { test: mockAuthTest },
    },
    start: mockAppStart,
    stop: mockAppStop,
    message: mockAppMessage,
    event: mockAppEvent,
    command: mockAppCommand,
  })),
}));

// =====================================================
// Helpers
// =====================================================

function makeConfig(overrides: Partial<ChannelConfig['credentials']> = {}): ChannelConfig {
  return {
    id: 'test-slack',
    platform: 'slack',
    orgId: 'org-1',
    agentId: 'agent-1',
    enabled: true,
    credentials: {
      botToken: 'xoxb-test-token-1234',
      appToken: 'xapp-test-token-5678',
      signingSecret: 'test-signing-secret-abcdef',
      ...overrides,
    },
    settings: { socketMode: true, port: 3099 },
  };
}

// =====================================================
// Tests
// =====================================================

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await adapter.stop();
    } catch {
      // ignore
    }
  });

  // ----- Config Validation (Zod) -----

  describe('Config validation (Zod)', () => {
    it('should reject missing bot token', () => {
      const result = slackConfigSchema.safeParse({
        botToken: '',
        appToken: 'xapp-valid',
        signingSecret: 'secret',
      });
      expect(result.success).toBe(false);
    });

    it('should reject bot token without xoxb- prefix', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'invalid-token',
        appToken: 'xapp-valid',
        signingSecret: 'secret',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('xoxb-');
      }
    });

    it('should reject missing app token', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid',
        appToken: '',
        signingSecret: 'secret',
      });
      expect(result.success).toBe(false);
    });

    it('should reject app token without xapp- prefix', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid',
        appToken: 'bad-prefix',
        signingSecret: 'secret',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing signing secret', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid',
        appToken: 'xapp-valid',
        signingSecret: '',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid config with all fields', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid-token',
        appToken: 'xapp-valid-token',
        signingSecret: 'signing-secret-123',
        socketMode: true,
        port: 3002,
      });
      expect(result.success).toBe(true);
    });

    it('should apply defaults for optional fields', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid-token',
        appToken: 'xapp-valid-token',
        signingSecret: 'signing-secret-123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.socketMode).toBe(true);
        expect(result.data.port).toBe(3002);
      }
    });

    it('should reject invalid port number', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid-token',
        appToken: 'xapp-valid-token',
        signingSecret: 'secret',
        port: 99999,
      });
      expect(result.success).toBe(false);
    });

    it('should reject port = 0', () => {
      const result = slackConfigSchema.safeParse({
        botToken: 'xoxb-valid-token',
        appToken: 'xapp-valid-token',
        signingSecret: 'secret',
        port: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  // ----- Adapter Lifecycle -----

  describe('Lifecycle (start/stop)', () => {
    it('should start successfully with valid config', async () => {
      await adapter.start(makeConfig());
      expect(mockAppStart).toHaveBeenCalledOnce();
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('should stop successfully after start', async () => {
      await adapter.start(makeConfig());
      await adapter.stop();
      expect(mockAppStop).toHaveBeenCalledOnce();
      expect(adapter.getConnectionState()).toBe('disconnected');
    });

    it('should throw on invalid credentials', async () => {
      const config = makeConfig({ botToken: 'invalid' });
      config.autoReconnect = false;
      await expect(adapter.start(config)).rejects.toThrow('Invalid Slack config');
    });

    it('should register message handler on connect', async () => {
      await adapter.start(makeConfig());
      expect(mockAppMessage).toHaveBeenCalledOnce();
    });

    it('should register app_mention handler on connect', async () => {
      await adapter.start(makeConfig());
      expect(mockAppEvent).toHaveBeenCalledWith('app_mention', expect.any(Function));
    });

    it('should report platform as slack', () => {
      expect(adapter.platform).toBe('slack');
    });
  });

  // ----- sendMessage -----

  describe('sendMessage()', () => {
    beforeEach(async () => {
      await adapter.start(makeConfig());
    });

    it('should send text message with correct payload', async () => {
      const result = await adapter.sendMessage({
        chatId: 'C123',
        text: 'Hello Slack!',
      });

      expect(result.success).toBe(true);
      expect(result.platformMessageId).toBe('1234567890.123456');
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          text: 'Hello Slack!',
        })
      );
    });

    it('should include thread_ts for threaded messages', async () => {
      await adapter.sendMessage({
        chatId: 'C123',
        text: 'Thread reply',
        threadId: '1234567890.000001',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: '1234567890.000001',
        })
      );
    });

    it('should enable markdown by default', async () => {
      await adapter.sendMessage({
        chatId: 'C123',
        text: '*bold text*',
      });

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ mrkdwn: true })
      );
    });

    it('should handle send failure gracefully', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('channel_not_found'));

      const result = await adapter.sendMessage({
        chatId: 'invalid-channel',
        text: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('channel_not_found');
    });

    it('should return error when not connected', async () => {
      await adapter.stop();

      const result = await adapter.sendMessage({
        chatId: 'C123',
        text: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });
  });

  // ----- sendBlocks -----

  describe('sendBlocks()', () => {
    beforeEach(async () => {
      await adapter.start(makeConfig());
    });

    it('should send Block Kit blocks with text fallback', async () => {
      const blocks = [
        {
          type: 'section' as const,
          text: { type: 'mrkdwn' as const, text: 'Hello from *Block Kit*!' },
        },
        { type: 'divider' as const },
        {
          type: 'actions' as const,
          elements: [
            {
              type: 'button' as const,
              text: { type: 'plain_text' as const, text: 'Click Me' },
              action_id: 'btn_1',
              value: 'clicked',
            },
          ],
        },
      ];

      const result = await adapter.sendBlocks('C123', blocks, 'Fallback text');

      expect(result.success).toBe(true);
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'section' }),
            expect.objectContaining({ type: 'divider' }),
            expect.objectContaining({ type: 'actions' }),
          ]),
          text: 'Fallback text',
        })
      );
    });

    it('should return error when not connected', async () => {
      await adapter.stop();

      const result = await adapter.sendBlocks('C123', []);
      expect(result.success).toBe(false);
    });
  });

  // ----- app_mention event -----

  describe('app_mention event', () => {
    it('should call custom mention handler', async () => {
      const mentionHandler = vi.fn();
      adapter.onMention(mentionHandler);

      await adapter.start(makeConfig());

      // Get the registered app_mention handler
      const eventCall = mockAppEvent.mock.calls.find((c: any[]) => c[0] === 'app_mention');
      expect(eventCall).toBeDefined();

      // Simulate app_mention event
      const handler = eventCall![1];
      await handler({
        event: {
          channel: 'C123',
          user: 'U456',
          text: '<@BOT> hello',
          ts: '1234567890.123456',
        },
      });

      expect(mentionHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          user: 'U456',
          text: '<@BOT> hello',
        })
      );
    });
  });

  // ----- Slash Commands -----

  describe('Slash command handling', () => {
    it('should register and execute slash command handler', async () => {
      const handler = vi.fn();
      adapter.onSlashCommand('/test', handler);

      await adapter.start(makeConfig());

      // Verify command was registered
      expect(mockAppCommand).toHaveBeenCalledWith('/test', expect.any(Function));
    });
  });

  // ----- Rate Limiting -----

  describe('Rate limiting', () => {
    beforeEach(async () => {
      await adapter.start(makeConfig());
    });

    it('should allow messages under rate limit', async () => {
      const results = await Promise.all([
        adapter.sendMessage({ chatId: 'C1', text: 'msg1' }),
        adapter.sendMessage({ chatId: 'C1', text: 'msg2' }),
        adapter.sendMessage({ chatId: 'C1', text: 'msg3' }),
      ]);

      results.forEach((r) => expect(r.success).toBe(true));
    });

    it('should throttle rapid sends', async () => {
      const startTime = Date.now();
      const promises: Promise<any>[] = [];

      // Send more than a few messages rapidly
      for (let i = 0; i < 5; i++) {
        promises.push(adapter.sendMessage({ chatId: 'C1', text: `msg${i}` }));
      }

      const results = await Promise.all(promises);
      results.forEach((r) => expect(r.success).toBe(true));
      // All should eventually succeed (rate limiter queues, doesn't reject)
      expect(mockPostMessage).toHaveBeenCalledTimes(5);
    });
  });

  // ----- Signature Verification -----

  describe('Signature verification (HMAC-SHA256)', () => {
    const signingSecret = 'test-signing-secret';

    it('should verify a valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"test":"payload"}';
      const sigBaseString = `v0:${timestamp}:${body}`;

      // Compute expected signature using crypto.subtle
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(signingSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBaseString));
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const signature = `v0=${hex}`;

      const result = await SlackAdapter.verifySignature(signingSecret, body, timestamp, signature);
      expect(result).toBe(true);
    });

    it('should reject an invalid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = '{"test":"payload"}';
      const signature = 'v0=invalid_hex_signature_here_that_is_wrong';

      const result = await SlackAdapter.verifySignature(signingSecret, body, timestamp, signature);
      expect(result).toBe(false);
    });

    it('should reject expired timestamp (>5 min old)', async () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const body = '{"test":"payload"}';
      const signature = 'v0=doesntmatter';

      const result = await SlackAdapter.verifySignature(signingSecret, body, oldTimestamp, signature);
      expect(result).toBe(false);
    });

    it('should reject future timestamp (>5 min ahead)', async () => {
      const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString();
      const body = '{"test":"payload"}';
      const signature = 'v0=doesntmatter';

      const result = await SlackAdapter.verifySignature(signingSecret, body, futureTimestamp, signature);
      expect(result).toBe(false);
    });
  });

  // ----- deleteMessage -----

  describe('deleteMessage()', () => {
    it('should delete a message', async () => {
      await adapter.start(makeConfig());

      const result = await adapter.deleteMessage('1234567890.123456', 'C123');
      expect(result).toBe(true);
      expect(mockChatDelete).toHaveBeenCalledWith({
        channel: 'C123',
        ts: '1234567890.123456',
      });
    });

    it('should return false when not connected', async () => {
      const result = await adapter.deleteMessage('ts', 'C123');
      expect(result).toBe(false);
    });
  });

  // ----- editMessage -----

  describe('editMessage()', () => {
    it('should edit a message', async () => {
      await adapter.start(makeConfig());

      const result = await adapter.editMessage('1234567890.123456', {
        chatId: 'C123',
        text: 'Updated text',
      });

      expect(result.success).toBe(true);
      expect(mockChatUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          ts: '1234567890.123456',
          text: 'Updated text',
        })
      );
    });
  });

  // ----- addReaction -----

  describe('addReaction()', () => {
    it('should add a reaction', async () => {
      await adapter.start(makeConfig());

      const result = await adapter.addReaction('1234567890.123456', 'C123', ':thumbsup:');
      expect(result).toBe(true);
      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: 'C123',
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });
    });

    it('should strip colons from emoji name', async () => {
      await adapter.start(makeConfig());
      await adapter.addReaction('ts', 'C123', ':rocket:');

      expect(mockReactionsAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'rocket' })
      );
    });
  });

  // ----- healthCheck -----

  describe('healthCheck()', () => {
    it('should return healthy when connected', async () => {
      await adapter.start(makeConfig());

      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details).toContain('testbot');
    });

    it('should return disconnected when not started', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('disconnected');
    });

    it('should return unhealthy on API failure', async () => {
      await adapter.start(makeConfig());
      mockAuthTest.mockRejectedValueOnce(new Error('auth_failed'));

      const health = await adapter.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.details).toContain('auth_failed');
    });
  });

  // ----- getCapabilities -----

  describe('getCapabilities()', () => {
    it('should report correct capabilities', () => {
      const caps = adapter.getCapabilities();

      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsReactions).toBe(true);
      expect(caps.supportsEditing).toBe(true);
      expect(caps.supportsDeleting).toBe(true);
      expect(caps.supportsActions).toBe(true);
      expect(caps.supportsGroupChat).toBe(true);
      expect(caps.supportsMarkdown).toBe(true);
      expect(caps.maxTextLength).toBe(40000);
      expect(caps.platformSpecific?.supportsBlockKit).toBe(true);
      expect(caps.platformSpecific?.supportsSlashCommands).toBe(true);
      expect(caps.platformSpecific?.supportsSocketMode).toBe(true);
    });
  });

  // ----- Event Emission -----

  describe('Event emission', () => {
    it('should emit inbound messages to registered handlers', async () => {
      const handler = vi.fn();
      adapter.on(handler);
      await adapter.start(makeConfig());

      // Get the registered message handler
      const messageHandler = mockAppMessage.mock.calls[0][0];

      // Simulate incoming message
      await messageHandler({
        message: {
          ts: '123.456',
          channel: 'C123',
          channel_type: 'im',
          user: 'U789',
          text: 'Hello bot!',
        },
        say: vi.fn(),
      });

      // Adapter emits connection_state events too, find the message event
      const messageEvent = handler.mock.calls.find(
        (call: any[]) => call[0].type === 'message'
      );
      expect(messageEvent).toBeDefined();
      expect(messageEvent![0].data.text).toBe('Hello bot!');
      expect(messageEvent![0].data.chatId).toBe('C123');
    });

    it('should skip bot messages', async () => {
      const handler = vi.fn();
      adapter.on(handler);
      await adapter.start(makeConfig());

      const messageHandler = mockAppMessage.mock.calls[0][0];
      await messageHandler({
        message: {
          ts: '123.456',
          channel: 'C123',
          user: 'U789',
          text: 'Bot message',
          bot_id: 'B123',
        },
        say: vi.fn(),
      });

      const messageEvents = handler.mock.calls.filter(
        (call: any[]) => call[0].type === 'message'
      );
      expect(messageEvents).toHaveLength(0);
    });

    it('should skip message subtypes (edits, deletes)', async () => {
      const handler = vi.fn();
      adapter.on(handler);
      await adapter.start(makeConfig());

      const messageHandler = mockAppMessage.mock.calls[0][0];
      await messageHandler({
        message: {
          ts: '123.456',
          channel: 'C123',
          user: 'U789',
          text: 'Edited',
          subtype: 'message_changed',
        },
        say: vi.fn(),
      });

      const messageEvents = handler.mock.calls.filter(
        (call: any[]) => call[0].type === 'message'
      );
      expect(messageEvents).toHaveLength(0);
    });
  });
});
