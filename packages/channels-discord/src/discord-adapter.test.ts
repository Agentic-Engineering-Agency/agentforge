/**
 * Tests for Discord Channel Adapter
 *
 * All Discord.js interactions are mocked — no real API calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChannelConfig, ChannelEvent, InboundMessage } from '@agentforge-ai/core';

// =====================================================
// Mock discord.js
// =====================================================

// We define mock factories before vi.mock so the factory can reference them
const mockUser = {
  id: 'bot-user-id-123',
  tag: 'TestBot#0001',
  displayName: 'TestBot',
  username: 'testbot',
  bot: true,
  displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discordapp.com/avatars/bot.png'),
};

const mockChannelMessages = {
  fetch: vi.fn(),
};

const mockTextChannel = {
  id: 'channel-id-456',
  type: 0, // GuildText
  send: vi.fn().mockResolvedValue({ id: 'sent-msg-id', createdAt: new Date() }),
  sendTyping: vi.fn().mockResolvedValue(undefined),
  messages: mockChannelMessages,
};

const mockDMChannel = {
  id: 'dm-channel-id-789',
  type: 1, // DM
  send: vi.fn().mockResolvedValue({ id: 'sent-dm-id', createdAt: new Date() }),
  sendTyping: vi.fn().mockResolvedValue(undefined),
  messages: mockChannelMessages,
};

const mockChannelsCache = new Map<string, typeof mockTextChannel | typeof mockDMChannel>();

const mockClientUser = { ...mockUser };

let readyHandler: (() => void) | null = null;
let errorHandler: ((e: Error) => void) | null = null;
const mockEventHandlers = new Map<string, ((...args: unknown[]) => void)[]>();

const mockClient = {
  user: mockClientUser,
  isReady: vi.fn().mockReturnValue(false),
  login: vi.fn().mockImplementation(async () => {
    // Simulate becoming ready after login
    mockClient.isReady.mockReturnValue(true);
    mockClient.user = mockClientUser;
    if (readyHandler) {
      setTimeout(readyHandler, 0);
    }
    return 'TOKEN';
  }),
  destroy: vi.fn(),
  removeAllListeners: vi.fn(),
  channels: {
    cache: mockChannelsCache,
    fetch: vi.fn().mockImplementation(async (id: string) => {
      return mockChannelsCache.get(id) ?? null;
    }),
  },
  on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = mockEventHandlers.get(event) ?? [];
    handlers.push(handler);
    mockEventHandlers.set(event, handlers);
    return mockClient;
  }),
  once: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
    if (event === 'ready') {
      readyHandler = handler as () => void;
    } else if (event === 'error') {
      errorHandler = handler as (e: Error) => void;
    }
    return mockClient;
  }),
  off: vi.fn(),
  emit: vi.fn().mockImplementation((event: string, ...args: unknown[]) => {
    const handlers = mockEventHandlers.get(event) ?? [];
    for (const h of handlers) h(...args);
    if (event === 'ready' && readyHandler) readyHandler();
    if (event === 'error' && errorHandler) errorHandler(args[0] as Error);
  }),
};

vi.mock('discord.js', () => {
  const GatewayIntentBits = {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4,
    DirectMessages: 8,
    GuildMessageReactions: 16,
  };

  const Partials = { Channel: 'Channel', Message: 'Message' };

  const ChannelType = {
    DM: 1,
    GroupDM: 3,
    GuildText: 0,
    GuildAnnouncement: 5,
    GuildForum: 15,
    GuildVoice: 2,
    PublicThread: 11,
    PrivateThread: 12,
    AnnouncementThread: 10,
  };

  const Events = {
    ClientReady: 'ready',
    MessageCreate: 'messageCreate',
    MessageUpdate: 'messageUpdate',
    InteractionCreate: 'interactionCreate',
    Error: 'error',
  };

  const Client = vi.fn().mockImplementation(() => mockClient);

  return { Client, GatewayIntentBits, Partials, ChannelType, Events };
});

vi.mock('@discordjs/rest', () => {
  const REST = vi.fn().mockImplementation(() => ({
    setToken: vi.fn().mockReturnThis(),
    put: vi.fn().mockResolvedValue([]),
  }));

  const Routes = {
    applicationCommands: vi.fn().mockReturnValue('/commands'),
    applicationGuildCommands: vi.fn().mockReturnValue('/guild/commands'),
  };

  return { REST, Routes };
});

// =====================================================
// Import adapter after mocks are set up
// =====================================================

import { DiscordAdapter } from './discord-adapter.js';

// =====================================================
// Test Helpers
// =====================================================

function createConfig(overrides: Partial<ChannelConfig> = {}): ChannelConfig {
  return {
    id: 'test-discord',
    platform: 'discord',
    orgId: 'org-1',
    agentId: 'agent-1',
    enabled: true,
    credentials: {
      botToken: 'Bot test-bot-token',
      clientId: 'client-123',
    },
    settings: {
      mentionOnly: false,
      respondToDMs: true,
      registerCommands: false, // skip command registration in tests
    },
    autoReconnect: false,
    ...overrides,
  };
}

function createMockMessage(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'msg-id-123',
    content: 'Hello bot!',
    author: {
      id: 'user-id-456',
      username: 'testuser',
      displayName: 'Test User',
      bot: false,
      displayAvatarURL: vi.fn().mockReturnValue('https://cdn.discordapp.com/avatars/user.png'),
    },
    member: {
      displayName: 'Test User',
    },
    channelId: 'channel-id-456',
    channel: {
      id: 'channel-id-456',
      type: 0, // GuildText
    },
    guild: { id: 'guild-id-789' },
    guildId: 'guild-id-789',
    reference: null,
    thread: null,
    mentions: {
      users: new Map<string, unknown>(),
    },
    attachments: new Map<string, unknown>(),
    createdAt: new Date(),
    type: 0,
    ...overrides,
  };
}

function createMockDMMessage(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return createMockMessage({
    channelId: 'dm-channel-id-789',
    channel: { id: 'dm-channel-id-789', type: 1 }, // DM
    guild: null,
    guildId: null,
    ...overrides,
  });
}

// =====================================================
// Tests
// =====================================================

describe('DiscordAdapter', () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    adapter = new DiscordAdapter();
    vi.clearAllMocks();
    readyHandler = null;
    errorHandler = null;
    mockEventHandlers.clear();
    mockChannelsCache.clear();
    mockClient.isReady.mockReturnValue(false);
    mockClient.login.mockImplementation(async () => {
      mockClient.isReady.mockReturnValue(true);
      mockClient.user = mockClientUser;
      if (readyHandler) setTimeout(readyHandler, 0);
      return 'TOKEN';
    });
  });

  afterEach(async () => {
    try {
      await adapter.stop();
    } catch {
      // Ignore
    }
  });

  // ----- Platform identity -----

  describe('platform', () => {
    it('should identify as discord', () => {
      expect(adapter.platform).toBe('discord');
    });
  });

  // ----- Capabilities -----

  describe('getCapabilities', () => {
    it('should return Discord capabilities', () => {
      const caps = adapter.getCapabilities();
      expect(caps.maxTextLength).toBe(2000);
      expect(caps.supportsThreads).toBe(true);
      expect(caps.supportsReactions).toBe(true);
      expect(caps.supportsEditing).toBe(true);
      expect(caps.supportsDeleting).toBe(true);
      expect(caps.supportsTypingIndicator).toBe(true);
      expect(caps.supportsGroupChat).toBe(true);
      expect(caps.supportsMarkdown).toBe(true);
      expect(caps.maxFileSize).toBe(25 * 1024 * 1024);
      expect(caps.supportedMedia).toContain('image');
      expect(caps.supportedMedia).toContain('audio');
      expect(caps.supportedMedia).toContain('video');
      expect(caps.supportedMedia).toContain('file');
      expect(caps.platformSpecific?.supportsEmbeds).toBe(true);
      expect(caps.platformSpecific?.supportsSlashCommands).toBe(true);
    });
  });

  // ----- Health check (before connect) -----

  describe('healthCheck (disconnected)', () => {
    it('should return disconnected when client is not ready', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('disconnected');
    });
  });

  // ----- Connect / Disconnect -----

  describe('connect', () => {
    it('should throw if no bot token', async () => {
      await expect(
        adapter.start(createConfig({ credentials: { botToken: '' } }))
      ).rejects.toThrow('Discord bot token is required');
    });

    it('should connect successfully', async () => {
      await adapter.start(createConfig());
      expect(adapter.getConnectionState()).toBe('connected');
    });

    it('should set botUserId from client user after ready', async () => {
      await adapter.start(createConfig());
      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details).toContain('bot-user-id-123');
    });
  });

  describe('disconnect', () => {
    it('should destroy the client on disconnect', async () => {
      await adapter.start(createConfig());
      await adapter.stop();
      expect(mockClient.destroy).toHaveBeenCalled();
      expect(mockClient.removeAllListeners).toHaveBeenCalled();
    });
  });

  // ----- Health check (after connect) -----

  describe('healthCheck (connected)', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
    });

    it('should return healthy when client is ready', async () => {
      const health = await adapter.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details).toContain('TestBot#0001');
    });
  });

  // ----- sendMessage -----

  describe('sendMessage', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
      mockChannelsCache.set('channel-id-456', mockTextChannel);
      mockTextChannel.send.mockResolvedValue({ id: 'sent-msg-id', createdAt: new Date() });
    });

    it('should send a text message', async () => {
      const result = await adapter.sendMessage({
        chatId: 'channel-id-456',
        text: 'Hello from agent!',
      });

      expect(result.success).toBe(true);
      expect(result.platformMessageId).toBe('sent-msg-id');
      expect(mockTextChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Hello from agent!' })
      );
    });

    it('should send a message with embeds via platformOptions', async () => {
      const embed = { title: 'Test Embed', description: 'Embed description' };

      const result = await adapter.sendMessage({
        chatId: 'channel-id-456',
        text: 'Check this embed:',
        platformOptions: { embeds: [embed] },
      });

      expect(result.success).toBe(true);
      expect(mockTextChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Check this embed:',
          embeds: [embed],
        })
      );
    });

    it('should send a message with reply reference', async () => {
      const result = await adapter.sendMessage({
        chatId: 'channel-id-456',
        text: 'Reply message',
        replyToMessageId: 'orig-msg-id',
      });

      expect(result.success).toBe(true);
      expect(mockTextChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          reply: { messageReference: 'orig-msg-id' },
        })
      );
    });

    it('should send to thread when threadId is provided', async () => {
      const mockThread = {
        ...mockTextChannel,
        id: 'thread-id-999',
        type: 11, // PublicThread
      };
      mockChannelsCache.set('thread-id-999', mockThread);

      const result = await adapter.sendMessage({
        chatId: 'channel-id-456',
        text: 'Thread reply',
        threadId: 'thread-id-999',
      });

      expect(result.success).toBe(true);
      expect(mockThread.send).toHaveBeenCalled();
    });

    it('should return error when channel is not found', async () => {
      const result = await adapter.sendMessage({
        chatId: 'nonexistent-channel',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should return error when send throws', async () => {
      mockTextChannel.send.mockRejectedValueOnce(new Error('Missing Permissions'));

      const result = await adapter.sendMessage({
        chatId: 'channel-id-456',
        text: 'Hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing Permissions');
    });
  });

  // ----- editMessage -----

  describe('editMessage', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
      mockChannelsCache.set('channel-id-456', mockTextChannel);
    });

    it('should edit a message', async () => {
      const mockMsg = { edit: vi.fn().mockResolvedValue({}) };
      mockChannelMessages.fetch.mockResolvedValueOnce(mockMsg);

      const result = await adapter.editMessage('msg-id-123', {
        chatId: 'channel-id-456',
        text: 'Edited text',
      });

      expect(result.success).toBe(true);
      expect(mockMsg.edit).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Edited text' })
      );
    });

    it('should fail without text or embeds', async () => {
      const result = await adapter.editMessage('msg-id-123', {
        chatId: 'channel-id-456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Text or embeds are required');
    });

    it('should fail without chatId', async () => {
      const result = await adapter.editMessage('msg-id-123', {
        text: 'New text',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('chatId is required');
    });
  });

  // ----- deleteMessage -----

  describe('deleteMessage', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
      mockChannelsCache.set('channel-id-456', mockTextChannel);
    });

    it('should delete a message', async () => {
      const mockMsg = { delete: vi.fn().mockResolvedValue(undefined) };
      mockChannelMessages.fetch.mockResolvedValueOnce(mockMsg);

      const result = await adapter.deleteMessage('msg-id-123', 'channel-id-456');
      expect(result).toBe(true);
      expect(mockMsg.delete).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      mockChannelMessages.fetch.mockRejectedValueOnce(new Error('Unknown Message'));

      const result = await adapter.deleteMessage('bad-id', 'channel-id-456');
      expect(result).toBe(false);
    });
  });

  // ----- sendTypingIndicator -----

  describe('sendTypingIndicator', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
      mockChannelsCache.set('channel-id-456', mockTextChannel);
    });

    it('should call sendTyping on the channel', async () => {
      await adapter.sendTypingIndicator('channel-id-456');
      expect(mockTextChannel.sendTyping).toHaveBeenCalled();
    });

    it('should not throw if channel not found', async () => {
      await expect(adapter.sendTypingIndicator('unknown-channel')).resolves.toBeUndefined();
    });
  });

  // ----- addReaction -----

  describe('addReaction', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
      mockChannelsCache.set('channel-id-456', mockTextChannel);
    });

    it('should add a reaction to a message', async () => {
      const mockMsg = { react: vi.fn().mockResolvedValue(undefined) };
      mockChannelMessages.fetch.mockResolvedValueOnce(mockMsg);

      const result = await adapter.addReaction('msg-id-123', 'channel-id-456', '👍');
      expect(result).toBe(true);
      expect(mockMsg.react).toHaveBeenCalledWith('👍');
    });

    it('should return false on error', async () => {
      mockChannelMessages.fetch.mockRejectedValueOnce(new Error('Unknown Message'));

      const result = await adapter.addReaction('bad-id', 'channel-id-456', '👍');
      expect(result).toBe(false);
    });
  });

  // ----- Message normalization -----

  describe('message normalization (guild message)', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
    });

    it('should emit InboundMessage for guild text channel messages', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage();
      for (const h of messageHandlers) h(rawMessage);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);

      const msg = msgEvents[0].data as InboundMessage;
      expect(msg.platform).toBe('discord');
      expect(msg.text).toBe('Hello bot!');
      expect(msg.chatId).toBe('channel-id-456');
      expect(msg.chatType).toBe('channel');
      expect(msg.sender.platformUserId).toBe('user-id-456');
      expect(msg.sender.username).toBe('testuser');
    });

    it('should strip bot @mention from message content', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        content: '<@bot-user-id-123> what is the weather?',
        mentions: {
          users: new Map([['bot-user-id-123', mockUser]]),
        },
      });
      for (const h of messageHandlers) h(rawMessage);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      expect((msgEvents[0].data as InboundMessage).text).toBe('what is the weather?');
    });

    it('should ignore messages from the bot itself', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        author: { ...mockUser, id: 'bot-user-id-123', bot: true },
      });
      for (const h of messageHandlers) h(rawMessage);

      expect(events.filter((e) => e.type === 'message')).toHaveLength(0);
    });

    it('should ignore messages from other bots', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        author: {
          id: 'other-bot-id',
          username: 'otherbot',
          displayName: 'Other Bot',
          bot: true,
          displayAvatarURL: vi.fn().mockReturnValue(''),
        },
      });
      for (const h of messageHandlers) h(rawMessage);

      expect(events.filter((e) => e.type === 'message')).toHaveLength(0);
    });
  });

  describe('message normalization (DM)', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
    });

    it('should emit InboundMessage for DMs', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockDMMessage({ content: 'Direct message' });
      for (const h of messageHandlers) h(rawMessage);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);

      const msg = msgEvents[0].data as InboundMessage;
      expect(msg.chatType).toBe('dm');
      expect(msg.text).toBe('Direct message');
    });

    it('should not emit DM if respondToDMs is false', async () => {
      await adapter.stop();
      adapter = new DiscordAdapter();
      mockClient.isReady.mockReturnValue(false);
      readyHandler = null;
      mockEventHandlers.clear();
      mockClient.login.mockImplementation(async () => {
        mockClient.isReady.mockReturnValue(true);
        if (readyHandler) setTimeout(readyHandler, 0);
        return 'TOKEN';
      });

      await adapter.start(
        createConfig({
          settings: { mentionOnly: false, respondToDMs: false, registerCommands: false },
        })
      );

      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockDMMessage({ content: 'Direct message' });
      for (const h of messageHandlers) h(rawMessage);

      expect(events.filter((e) => e.type === 'message')).toHaveLength(0);
    });
  });

  describe('message normalization (thread)', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
    });

    it('should emit InboundMessage with thread chatType', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        content: 'Thread message',
        channelId: 'thread-id-999',
        channel: { id: 'thread-id-999', type: 11 }, // PublicThread
        thread: null,
      });
      for (const h of messageHandlers) h(rawMessage);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      expect((msgEvents[0].data as InboundMessage).chatType).toBe('thread');
    });
  });

  describe('mention-only mode', () => {
    beforeEach(async () => {
      await adapter.stop();
      adapter = new DiscordAdapter();
      mockClient.isReady.mockReturnValue(false);
      readyHandler = null;
      mockEventHandlers.clear();
      mockClient.login.mockImplementation(async () => {
        mockClient.isReady.mockReturnValue(true);
        if (readyHandler) setTimeout(readyHandler, 0);
        return 'TOKEN';
      });

      await adapter.start(
        createConfig({
          settings: { mentionOnly: true, respondToDMs: true, registerCommands: false },
        })
      );
    });

    it('should ignore guild messages without bot @mention', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        content: 'Hello everyone',
        mentions: { users: new Map() },
      });
      for (const h of messageHandlers) h(rawMessage);

      expect(events.filter((e) => e.type === 'message')).toHaveLength(0);
    });

    it('should process guild messages with bot @mention', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        content: '<@bot-user-id-123> what is the weather?',
        mentions: {
          users: new Map([['bot-user-id-123', mockUser]]),
        },
      });
      for (const h of messageHandlers) h(rawMessage);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      // Bot mention stripped
      expect((msgEvents[0].data as InboundMessage).text).toBe('what is the weather?');
    });
  });

  describe('edited messages', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
    });

    it('should emit message_edited event for updated messages', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const updateHandlers = mockEventHandlers.get('messageUpdate') ?? [];
      const oldMessage = createMockMessage({ content: 'Original' });
      const newMessage = createMockMessage({ content: 'Edited content', id: 'msg-id-123' });
      // Mark as not partial
      (newMessage as Record<string, unknown>)['partial'] = false;

      for (const h of updateHandlers) h(oldMessage, newMessage);

      const editEvents = events.filter((e) => e.type === 'message_edited');
      expect(editEvents).toHaveLength(1);
      expect((editEvents[0].data as InboundMessage).text).toBe('Edited content');
    });

    it('should skip partial message updates', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const updateHandlers = mockEventHandlers.get('messageUpdate') ?? [];
      const oldMessage = createMockMessage();
      const partialNewMessage = { partial: true };

      for (const h of updateHandlers) h(oldMessage, partialNewMessage);

      expect(events.filter((e) => e.type === 'message_edited')).toHaveLength(0);
    });
  });

  describe('media attachments', () => {
    beforeEach(async () => {
      await adapter.start(createConfig());
    });

    it('should include image attachments in InboundMessage', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const attachment = {
        id: 'attach-id-1',
        url: 'https://cdn.discordapp.com/attachments/image.png',
        name: 'image.png',
        contentType: 'image/png',
        size: 12345,
        width: 800,
        height: 600,
      };

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        content: '',
        attachments: new Map([['attach-id-1', attachment]]),
      });
      for (const h of messageHandlers) h(rawMessage);

      const msgEvents = events.filter((e) => e.type === 'message');
      expect(msgEvents).toHaveLength(1);
      const msg = msgEvents[0].data as InboundMessage;
      expect(msg.media).toHaveLength(1);
      expect(msg.media![0].type).toBe('image');
      expect(msg.media![0].url).toBe('https://cdn.discordapp.com/attachments/image.png');
      expect(msg.media![0].width).toBe(800);
      expect(msg.media![0].height).toBe(600);
    });

    it('should map audio MIME types correctly', () => {
      const events: ChannelEvent[] = [];
      adapter.on((event) => events.push(event));

      const attachment = {
        id: 'audio-1',
        url: 'https://cdn.discordapp.com/audio.mp3',
        name: 'audio.mp3',
        contentType: 'audio/mpeg',
        size: 99999,
        width: null,
        height: null,
      };

      const messageHandlers = mockEventHandlers.get('messageCreate') ?? [];
      const rawMessage = createMockMessage({
        attachments: new Map([['audio-1', attachment]]),
      });
      for (const h of messageHandlers) h(rawMessage);

      const msg = (events.filter((e) => e.type === 'message')[0]?.data) as InboundMessage;
      expect(msg.media![0].type).toBe('audio');
    });
  });
});
