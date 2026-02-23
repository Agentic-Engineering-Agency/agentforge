/**
 * Tests for WhatsApp Channel Adapter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WhatsAppAdapter,
  type WhatsAppWebhookPayload,
  type WhatsAppMessage,
} from './whatsapp-adapter.js';
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

function mockApiResponse(result: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(result),
  });
}

function mockApiError(message: string, code = 190) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () =>
      Promise.resolve({
        error: { message, code, type: 'OAuthException', fbtrace_id: 'test' },
      }),
  });
}

// =====================================================
// Test Helpers
// =====================================================

function createConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'test-whatsapp',
    platform: 'whatsapp',
    orgId: 'org-1',
    agentId: 'agent-1',
    enabled: true,
    credentials: {
      accessToken: 'test-access-token',
      phoneNumberId: '123456789',
      verifyToken: 'test-verify-token',
    },
    settings: {
      webhookPort: 0, // Disable built-in server in tests
    },
    autoReconnect: false,
    ...overrides,
  };
}

function createTextMessage(text: string, from: string = '5215551234567'): WhatsAppMessage {
  return {
    from,
    id: 'wamid.test123',
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'text',
    text: { body: text },
  };
}

function createImageMessage(from: string = '5215551234567'): WhatsAppMessage {
  return {
    from,
    id: 'wamid.img123',
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'image',
    image: {
      id: 'media-id-123',
      mime_type: 'image/jpeg',
      caption: 'A test image',
    },
  };
}

function createDocumentMessage(from: string = '5215551234567'): WhatsAppMessage {
  return {
    from,
    id: 'wamid.doc123',
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'document',
    document: {
      id: 'media-id-456',
      mime_type: 'application/pdf',
      filename: 'test.pdf',
      caption: 'A test document',
    },
  };
}

function createWebhookPayload(
  messages: WhatsAppMessage[],
  contacts: Array<{ profile: { name: string }; wa_id: string }> = []
): WhatsAppWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: '123456789',
              },
              contacts,
              messages,
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

// =====================================================
// Tests
// =====================================================

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;

  beforeEach(() => {
    adapter = new WhatsAppAdapter();
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
    it('should have platform set to "whatsapp"', () => {
      expect(adapter.platform).toBe('whatsapp');
    });
  });

  describe('connect', () => {
    it('should connect successfully with valid credentials', async () => {
      // Mock phone number verification
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });

      const config = createConfig({ settings: { webhookPort: 0 } });
      await adapter.connect(config);
      expect(adapter.getConnectionState()).toBe('disconnected'); // connect doesn't set state, start does
    });

    it('should throw if access token is missing', async () => {
      const config = createConfig({
        credentials: { accessToken: '', phoneNumberId: '123', verifyToken: 'test' },
      });
      await expect(adapter.connect(config)).rejects.toThrow('access token is required');
    });

    it('should throw if phone number ID is missing', async () => {
      const config = createConfig({
        credentials: { accessToken: 'token', phoneNumberId: '', verifyToken: 'test' },
      });
      await expect(adapter.connect(config)).rejects.toThrow('phone number ID is required');
    });

    it('should throw if verify token is missing', async () => {
      const config = createConfig({
        credentials: { accessToken: 'token', phoneNumberId: '123', verifyToken: '' },
      });
      await expect(adapter.connect(config)).rejects.toThrow('verify token is required');
    });

    it('should throw if API verification fails', async () => {
      mockApiError('Invalid OAuth access token', 190);

      const config = createConfig({ settings: { webhookPort: 0 } });
      await expect(adapter.connect(config)).rejects.toThrow('WhatsApp API error');
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.supportedMedia).toContain('image');
      expect(caps.supportedMedia).toContain('file');
      expect(caps.supportedMedia).toContain('audio');
      expect(caps.supportedMedia).toContain('video');
      expect(caps.supportedMedia).toContain('sticker');
      expect(caps.supportedMedia).toContain('location');
      expect(caps.maxTextLength).toBe(4096);
      expect(caps.supportsThreads).toBe(false);
      expect(caps.supportsReactions).toBe(true);
      expect(caps.supportsEditing).toBe(false);
      expect(caps.supportsActions).toBe(true);
      expect(caps.supportsGroupChat).toBe(true);
      expect(caps.supportsReadReceipts).toBe(true);
      expect(caps.maxFileSize).toBe(100 * 1024 * 1024);
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      // Mock phone number verification for connect
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
    });

    it('should send a text message', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.sent123' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        text: 'Hello from AgentForge!',
      });

      expect(result.success).toBe(true);
      expect(result.platformMessageId).toBe('wamid.sent123');

      // Verify the API call
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.to).toBe('5215551234567');
      expect(body.type).toBe('text');
      expect(body.text.body).toBe('Hello from AgentForge!');
    });

    it('should send a text message with reply context', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.reply123' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        text: 'Reply to your message',
        replyToMessageId: 'wamid.original123',
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.context).toEqual({ message_id: 'wamid.original123' });
    });

    it('should send an image message', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.img-sent123' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        text: 'Check this out',
        media: [
          {
            type: 'image',
            url: 'https://example.com/image.jpg',
            caption: 'Test image',
          },
        ],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('image');
      expect(body.image.link).toBe('https://example.com/image.jpg');
    });

    it('should send a document message', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.doc-sent123' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        media: [
          {
            type: 'file',
            url: 'https://example.com/doc.pdf',
            fileName: 'report.pdf',
          },
        ],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('document');
      expect(body.document.link).toBe('https://example.com/doc.pdf');
      expect(body.document.filename).toBe('report.pdf');
    });

    it('should send an interactive button message', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.btn-sent123' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        text: 'Choose an option:',
        actions: [
          { type: 'button', label: 'Option A', actionId: 'opt_a' },
          { type: 'button', label: 'Option B', actionId: 'opt_b' },
        ],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('button');
      expect(body.interactive.action.buttons).toHaveLength(2);
    });

    it('should return error when no text or media', async () => {
      const result = await adapter.sendMessage({
        chatId: '5215551234567',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No text or media');
    });

    it('should handle API errors gracefully', async () => {
      mockApiError('Rate limit exceeded', 429);

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('WhatsApp API error');
    });
  });

  describe('healthCheck', () => {
    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
    });

    it('should return healthy when API is reachable', async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });

      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details).toContain('Test Business');
    });

    it('should return unhealthy on API error', async () => {
      mockApiError('Invalid token', 190);

      const health = await adapter.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.details).toContain('WhatsApp API error');
    });
  });

  describe('verifyWebhook', () => {
    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
    });

    it('should verify valid webhook request', async () => {
      const result = await adapter.verifyWebhook('subscribe', 'test-verify-token', 'challenge-123');
      expect(result).toBe('challenge-123');
    });

    it('should reject invalid verify token', async () => {
      const result = await adapter.verifyWebhook('subscribe', 'wrong-token', 'challenge-123');
      expect(result).toBeNull();
    });

    it('should reject non-subscribe mode', async () => {
      const result = await adapter.verifyWebhook('unsubscribe', 'test-verify-token', 'challenge-123');
      expect(result).toBeNull();
    });

    it('should handle missing parameters', async () => {
      const result = await adapter.verifyWebhook(undefined, undefined, undefined);
      expect(result).toBeNull();
    });
  });

  describe('handleWebhookPayload', () => {
    let events: ChannelEvent[];

    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));

      events = [];
      adapter.on((event) => {
        events.push(event);
      });
    });

    it('should process a text message', () => {
      const payload = createWebhookPayload(
        [createTextMessage('Hello!')],
        [{ profile: { name: 'John Doe' }, wa_id: '5215551234567' }]
      );

      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message');

      const msg = events[0].data as InboundMessage;
      expect(msg.text).toBe('Hello!');
      expect(msg.platform).toBe('whatsapp');
      expect(msg.chatId).toBe('5215551234567');
      expect(msg.sender.displayName).toBe('John Doe');
      expect(msg.sender.platformUserId).toBe('5215551234567');
    });

    it('should process an image message', () => {
      const payload = createWebhookPayload(
        [createImageMessage()],
        [{ profile: { name: 'Jane' }, wa_id: '5215551234567' }]
      );

      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.text).toBe('A test image');
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('image');
      expect(msg.media![0].url).toBe('whatsapp:media:media-id-123');
    });

    it('should process a document message', () => {
      const payload = createWebhookPayload(
        [createDocumentMessage()],
        [{ profile: { name: 'Jane' }, wa_id: '5215551234567' }]
      );

      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('file');
      expect(msg.media![0].fileName).toBe('test.pdf');
      expect(msg.media![0].mimeType).toBe('application/pdf');
    });

    it('should process a message with reply context', () => {
      const message: WhatsAppMessage = {
        ...createTextMessage('Reply text'),
        context: { from: '5215559876543', id: 'wamid.original' },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.replyTo?.platformMessageId).toBe('wamid.original');
    });

    it('should process interactive button reply as callback', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.interactive123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'opt_a', title: 'Option A' },
        },
      };

      const payload = createWebhookPayload(
        [message],
        [{ profile: { name: 'John' }, wa_id: '5215551234567' }]
      );

      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('callback');
      const action = events[0].data as CallbackAction;
      expect(action.actionId).toBe('opt_a');
      expect(action.value).toBe('Option A');
    });

    it('should process interactive list reply as callback', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.list123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'item_1', title: 'Item 1', description: 'First item' },
        },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('callback');
      const action = events[0].data as CallbackAction;
      expect(action.actionId).toBe('item_1');
      expect(action.value).toBe('Item 1');
    });

    it('should ignore non-whatsapp_business_account payloads', () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'page',
        entry: [],
      };

      adapter.handleWebhookPayload(payload);
      expect(events).toHaveLength(0);
    });

    it('should ignore non-messages field changes', () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '123456789',
                  },
                },
                field: 'account_update',
              },
            ],
          },
        ],
      };

      adapter.handleWebhookPayload(payload);
      expect(events).toHaveLength(0);
    });

    it('should handle multiple messages in one payload', () => {
      const payload = createWebhookPayload([
        createTextMessage('First message', '5215551111111'),
        createTextMessage('Second message', '5215552222222'),
      ]);

      adapter.handleWebhookPayload(payload);
      expect(events).toHaveLength(2);
    });

    it('should emit error event for failed status updates', () => {
      const payload: WhatsAppWebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '123456789',
                  },
                  statuses: [
                    {
                      id: 'wamid.failed123',
                      status: 'failed',
                      timestamp: String(Math.floor(Date.now() / 1000)),
                      recipient_id: '5215551234567',
                      errors: [{ code: 131047, title: 'Re-engagement message', message: 'More than 24h' }],
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      adapter.handleWebhookPayload(payload);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('error');
    });
  });

  describe('addReaction', () => {
    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
    });

    it('should send a reaction', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.reaction123' }] });

      const result = await adapter.addReaction('wamid.msg123', '5215551234567', '👍');
      expect(result).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('reaction');
      expect(body.reaction.emoji).toBe('👍');
      expect(body.reaction.message_id).toBe('wamid.msg123');
    });

    it('should return false on reaction error', async () => {
      mockApiError('Message not found', 131009);

      const result = await adapter.addReaction('wamid.invalid', '5215551234567', '👍');
      expect(result).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect cleanly', async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
      await expect(adapter.disconnect()).resolves.not.toThrow();
    });
  });

  describe('location message', () => {
    let events: ChannelEvent[];

    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));

      events = [];
      adapter.on((event) => {
        events.push(event);
      });
    });

    it('should process a location message', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.loc123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'location',
        location: {
          latitude: 20.6597,
          longitude: -103.3496,
          name: 'Guadalajara',
          address: 'Jalisco, Mexico',
        },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.text).toContain('Guadalajara');
      expect(msg.text).toContain('Jalisco, Mexico');
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('location');
      expect(msg.media![0].url).toContain('20.6597');
    });
  });

  // =====================================================
  // NEW TESTS (AGE-118)
  // =====================================================

  describe('video message handling', () => {
    let events: ChannelEvent[];

    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));

      events = [];
      adapter.on((event) => {
        events.push(event);
      });
    });

    it('should normalize inbound video message with mimeType and caption', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.vid123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'video',
        video: {
          id: 'media-video-999',
          mime_type: 'video/mp4',
          caption: 'Watch this clip',
        },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('video');
      expect(msg.media![0].url).toBe('whatsapp:media:media-video-999');
      expect(msg.media![0].mimeType).toBe('video/mp4');
      expect(msg.text).toBe('Watch this clip');
    });
  });

  describe('audio/voice note message handling', () => {
    let events: ChannelEvent[];

    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));

      events = [];
      adapter.on((event) => {
        events.push(event);
      });
    });

    it('should normalize inbound audio message with mimeType', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.audio123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'audio',
        audio: {
          id: 'media-audio-777',
          mime_type: 'audio/ogg; codecs=opus',
        },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('audio');
      expect(msg.media![0].url).toBe('whatsapp:media:media-audio-777');
      expect(msg.media![0].mimeType).toBe('audio/ogg; codecs=opus');
      // Audio messages have no caption/text extraction
      expect(msg.text).toBeUndefined();
    });

    it('should normalize audio message without optional mimeType', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.audio456',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'audio',
        audio: { id: 'media-audio-no-mime' },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.media![0].mimeType).toBeUndefined();
    });
  });

  describe('sticker message handling', () => {
    let events: ChannelEvent[];

    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));

      events = [];
      adapter.on((event) => {
        events.push(event);
      });
    });

    it('should normalize inbound sticker message', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.sticker123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'sticker',
        sticker: {
          id: 'media-sticker-111',
          mime_type: 'image/webp',
        },
      };

      const payload = createWebhookPayload([message]);
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      const msg = events[0].data as InboundMessage;
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('sticker');
      expect(msg.media![0].url).toBe('whatsapp:media:media-sticker-111');
      expect(msg.media![0].mimeType).toBe('image/webp');
    });
  });

  describe('button message callback (template button reply)', () => {
    let events: ChannelEvent[];

    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));

      events = [];
      adapter.on((event) => {
        events.push(event);
      });
    });

    it('should emit callback event for template button reply', () => {
      const message: WhatsAppMessage = {
        from: '5215551234567',
        id: 'wamid.btn-template-123',
        timestamp: String(Math.floor(Date.now() / 1000)),
        type: 'button',
        button: { text: 'Yes, confirm', payload: 'confirm_action' },
      };

      const payload = createWebhookPayload(
        [message],
        [{ profile: { name: 'Alice' }, wa_id: '5215551234567' }]
      );
      adapter.handleWebhookPayload(payload);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('callback');
      const action = events[0].data as CallbackAction;
      expect(action.actionId).toBe('confirm_action');
      expect(action.value).toBe('Yes, confirm');
      expect(action.sender.platformUserId).toBe('5215551234567');
      expect(action.sender.displayName).toBe('Alice');
    });
  });

  describe('getMediaUrl and downloadMedia', () => {
    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
    });

    it('should resolve a media URL from a media ID', async () => {
      mockApiResponse({ url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=abc123' });

      const url = await adapter.getMediaUrl('media-id-abc123');
      expect(url).toBe('https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=abc123');

      const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(call[0]).toContain('media-id-abc123');
      expect(call[1].headers.Authorization).toContain('Bearer test-access-token');
    });

    it('should download media with Authorization header', async () => {
      const mockBuffer = new ArrayBuffer(8);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      const result = await adapter.downloadMedia('https://example.com/media-file.ogg');
      expect(result).toBe(mockBuffer);

      const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(call[0]).toBe('https://example.com/media-file.ogg');
      expect(call[1].headers.Authorization).toBe('Bearer test-access-token');
    });

    it('should throw when downloadMedia receives non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(adapter.downloadMedia('https://example.com/restricted.ogg')).rejects.toThrow(
        'Failed to download media: 403 Forbidden'
      );
    });
  });

  describe('outbound audio and video message sending', () => {
    beforeEach(async () => {
      mockApiResponse({
        id: '123456789',
        display_phone_number: '+1234567890',
        verified_name: 'Test Business',
      });
      await adapter.connect(createConfig({ settings: { webhookPort: 0 } }));
    });

    it('should send an audio message', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.audio-sent' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        media: [{ type: 'audio', url: 'https://example.com/voice.ogg' }],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('audio');
      expect(body.audio.link).toBe('https://example.com/voice.ogg');
    });

    it('should send a video message with caption', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.video-sent' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        text: 'Here is the video',
        media: [{ type: 'video', url: 'https://example.com/clip.mp4', caption: 'clip' }],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('video');
      expect(body.video.link).toBe('https://example.com/clip.mp4');
      expect(body.video.caption).toBe('Here is the video');
    });

    it('should send a sticker message', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.sticker-sent' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        media: [{ type: 'sticker', url: 'https://example.com/sticker.webp' }],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('sticker');
      expect(body.sticker.link).toBe('https://example.com/sticker.webp');
    });

    it('should send a location message from a geo: URL', async () => {
      mockApiResponse({ messages: [{ id: 'wamid.location-sent' }] });

      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        media: [{ type: 'location', url: 'geo:19.4326,-99.1332' }],
      });

      expect(result.success).toBe(true);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.type).toBe('location');
      expect(body.location.latitude).toBeCloseTo(19.4326);
      expect(body.location.longitude).toBeCloseTo(-99.1332);
    });

    it('should return error for invalid geo: URL format', async () => {
      const result = await adapter.sendMessage({
        chatId: '5215551234567',
        media: [{ type: 'location', url: 'not-a-geo-url' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid location URL format');
    });
  });
});
