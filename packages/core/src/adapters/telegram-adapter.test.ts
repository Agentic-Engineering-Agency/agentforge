/**
 * Tests for Telegram Channel Adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TelegramAdapter,
  type TelegramUpdate,
  type TelegramMessage,
} from './telegram-adapter.js';
import type {
  ChannelConfig,
  ChannelEvent,
  InboundMessage,
  CallbackAction,
} from '../channel-adapter.js';

// =====================================================
// Mock fetch
// =====================================================

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function mockApiResponse(result: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve({ ok, result }),
  });
}

function mockApiError(description: string, errorCode = 400) {
  mockFetch.mockResolvedValueOnce({
    json: () =>
      Promise.resolve({
        ok: false,
        description,
        error_code: errorCode,
      }),
  });
}

// =====================================================
// Test Helpers
// =====================================================

function createConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'test-telegram',
    platform: 'telegram',
    orgId: 'org-1',
    agentId: 'agent-1',
    enabled: true,
    credentials: { botToken: 'test-bot-token' },
    settings: {
      botUsername: 'test_bot',
      groupMentionOnly: true,
    },
    autoReconnect: false,
    ...overrides,
  };
}

function createTextMessage(
  text: string,
  chatType: 'private' | 'group' = 'private'
): TelegramMessage {
  return {
    message_id: 123,
    from: {
      id: 456,
      is_bot: false,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    },
    chat: {
      id: chatType === 'private' ? 456 : -100123,
      type: chatType,
      title: chatType !== 'private' ? 'Test Group' : undefined,
    },
    date: Math.floor(Date.now() / 1000),
    text,
  };
}

function createPhotoMessage(): TelegramMessage {
  return {
    ...createTextMessage(''),
    text: undefined,
    caption: 'Photo caption',
    photo: [
      { file_id: 'small', file_unique_id: 's1', width: 100, height: 100 },
      { file_id: 'large', file_unique_id: 'l1', width: 800, height: 600, file_size: 50000 },
    ],
  };
}

// =====================================================
// Tests
// =====================================================

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;

  beforeEach(() => {
    adapter = new TelegramAdapter();
    mockFetch.mockReset();
  });

  afterEach(async () => {
    try {
      await adapter.stop();
    } catch {
      // Ignore
    }
  });

  describe('platform', () => {
    it('should identify as telegram', () => {
      expect(adapter.platform).toBe('telegram');
    });
  });

  describe('connect', () => {
    it('should connect with polling mode', async () => {
      // getMe
      mockApiResponse({ id: 123, is_bot: true, first_name: 'Bot', username: 'test_bot' });
      // deleteWebhook
      mockApiResponse(true);
      // First getUpdates (from polling)
      mockApiResponse([]);

      await adapter.start(createConfig());
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('should throw if no bot token', async () => {
      await expect(
        adapter.start(createConfig({ credentials: { botToken: '' } }))
      ).rejects.toThrow('Telegram bot token is required');
    });

    it('should throw if getMe fails', async () => {
      mockApiError('Unauthorized', 401);

      await expect(adapter.start(createConfig())).rejects.toThrow(
        'Telegram API error'
      );
    });
  });

  describe('capabilities', () => {
    it('should return Telegram capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.maxTextLength).toBe(4096);
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsActions).toBe(true);
      expect(caps.supportedMedia).toContain('image');
      expect(caps.supportedMedia).toContain('voice_note');
      expect(caps.supportedMedia).toContain('sticker');
      expect(caps.platformSpecific?.supportsInlineKeyboards).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy when API responds', async () => {
      mockApiResponse({ id: 123, is_bot: true, username: 'test_bot' });
      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details).toContain('test_bot');
    });

    it('should return unhealthy on API error', async () => {
      mockApiError('Unauthorized', 401);
      const health = await adapter.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      // Connect first
      mockApiResponse({ id: 123, is_bot: true, username: 'test_bot' });
      mockApiResponse(true); // deleteWebhook
      mockApiResponse([]); // getUpdates
      await adapter.start(createConfig());
    });

    it('should send a text message', async () => {
      mockApiResponse({ message_id: 789, date: Math.floor(Date.now() / 1000) });

      const result = await adapter.sendMessage({
        chatId: '456',
        text: 'Hello from agent!',
      });

      expect(result.success).toBe(true);
      expect(result.platformMessageId).toBe('789');
    });

    it('should send with inline keyboard', async () => {
      mockApiResponse({ message_id: 790, date: Math.floor(Date.now() / 1000) });

      const result = await adapter.sendMessage({
        chatId: '456',
        text: 'Choose an option:',
        actions: [
          { type: 'button', label: 'Option A', actionId: 'opt_a' },
          { type: 'button', label: 'Option B', actionId: 'opt_b' },
          { type: 'url_button', label: 'Visit', actionId: 'visit', url: 'https://example.com' },
        ],
      });

      expect(result.success).toBe(true);

      // Verify the API was called with inline_keyboard
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.reply_markup).toBeDefined();
    });

    it('should send a photo', async () => {
      mockApiResponse({ message_id: 791, date: Math.floor(Date.now() / 1000) });

      const result = await adapter.sendMessage({
        chatId: '456',
        text: 'Check this out!',
        media: [{ type: 'image', url: 'https://example.com/photo.jpg' }],
      });

      expect(result.success).toBe(true);
    });

    it('should handle send errors', async () => {
      mockApiError('Chat not found', 400);

      const result = await adapter.sendMessage({
        chatId: 'invalid',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chat not found');
    });

    it('should return error for empty message', async () => {
      const result = await adapter.sendMessage({ chatId: '456' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No text or media');
    });
  });

  describe('editMessage', () => {
    it('should edit a message', async () => {
      mockApiResponse({ message_id: 789 });

      const result = await adapter.editMessage('789', {
        chatId: '456',
        text: 'Edited text',
      });

      expect(result.success).toBe(true);
    });

    it('should fail without text', async () => {
      const result = await adapter.editMessage('789', { chatId: '456' });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      mockApiResponse(true);
      const result = await adapter.deleteMessage('789', '456');
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      mockApiError('Message not found', 400);
      const result = await adapter.deleteMessage('999', '456');
      expect(result).toBe(false);
    });
  });

  describe('webhook handling', () => {
    beforeEach(async () => {
      mockApiResponse({ id: 123, is_bot: true, username: 'test_bot' });
      mockApiResponse(true); // deleteWebhook
      mockApiResponse([]); // getUpdates
      await adapter.start(createConfig());
    });

    it('should process text message updates', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const update: TelegramUpdate = {
        update_id: 1,
        message: createTextMessage('Hello bot!'),
      };

      adapter.handleWebhookUpdate(update);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      expect((msgEvents[0].data as InboundMessage).text).toBe('Hello bot!');
      expect((msgEvents[0].data as InboundMessage).platform).toBe('telegram');
    });

    it('should process photo message updates', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const update: TelegramUpdate = {
        update_id: 2,
        message: createPhotoMessage(),
      };

      adapter.handleWebhookUpdate(update);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      const msg = msgEvents[0].data as InboundMessage;
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('image');
      expect(msg.text).toBe('Photo caption');
    });

    it('should process edited message updates', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const update: TelegramUpdate = {
        update_id: 3,
        edited_message: createTextMessage('Edited text'),
      };

      adapter.handleWebhookUpdate(update);

      const editEvents = events.filter((e) => e.type === 'message_edited');
      expect(editEvents).toHaveLength(1);
    });

    it('should process callback queries', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      // Mock answerCallbackQuery
      mockApiResponse(true);

      const update: TelegramUpdate = {
        update_id: 4,
        callback_query: {
          id: 'cb-1',
          from: { id: 456, is_bot: false, first_name: 'Test' },
          message: createTextMessage('Choose:'),
          data: 'opt_a',
        },
      };

      adapter.handleWebhookUpdate(update);

      const cbEvents = events.filter((e) => e.type === 'callback');
      expect(cbEvents).toHaveLength(1);
      expect((cbEvents[0].data as CallbackAction).actionId).toBe('opt_a');
    });

    it('should ignore group messages without @mention', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const update: TelegramUpdate = {
        update_id: 5,
        message: createTextMessage('Hello everyone', 'group'),
      };

      adapter.handleWebhookUpdate(update);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(0);
    });

    it('should process group messages with @mention', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const msg = createTextMessage('@test_bot what is the weather?', 'group');
      msg.entities = [
        { type: 'mention', offset: 0, length: 9 },
      ];

      const update: TelegramUpdate = {
        update_id: 6,
        message: msg,
      };

      adapter.handleWebhookUpdate(update);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      // Bot mention should be stripped
      expect((msgEvents[0].data as InboundMessage).text).toBe(
        'what is the weather?'
      );
    });

    it('should process group messages with bot commands', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const msg = createTextMessage('/help', 'group');
      msg.entities = [{ type: 'bot_command', offset: 0, length: 5 }];

      adapter.handleWebhookUpdate(update_from_msg(7, msg));

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
    });
  });

  describe('getFileUrl', () => {
    it('should return file download URL', async () => {
      // Connect first so botToken is set
      mockApiResponse({ id: 123, is_bot: true, username: 'test_bot' });
      mockApiResponse(true); // deleteWebhook
      mockApiResponse([]); // getUpdates
      await adapter.start(createConfig());

      mockApiResponse({ file_path: 'photos/file_1.jpg' });
      const url = await adapter.getFileUrl('file-id-123');
      expect(url).toContain('file/bottest-bot-token/photos/file_1.jpg');
    });
  });
});

// Helper to create an update from a message
function update_from_msg(id: number, msg: TelegramMessage): TelegramUpdate {
  return { update_id: id, message: msg };
}
