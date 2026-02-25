/**
 * Discord Channel Adapter for AgentForge.
 *
 * Implements the ChannelAdapter interface for the Discord Bot API using discord.js v14.
 *
 * Features:
 * - Text messages in guild channels and DMs
 * - Thread support (forum and text threads)
 * - Reactions, message editing and deletion
 * - Typing indicators
 * - Slash command registration and handling
 * - Embeds via platformOptions.embeds
 * - Guild @mention detection
 * - Rate limiting
 * - Max 25MB file uploads, 2000 char text limit
 *
 * @packageDocumentation
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Routes,
  type Message,
  type DMChannel,
  type TextChannel,
  type ThreadChannel,
  type NewsChannel,
  type VoiceChannel,
  type PartialMessage,
  type Interaction,
  type ChatInputCommandInteraction,
  type Channel,
  ChannelType,
  Events,
} from 'discord.js';
import { REST } from '@discordjs/rest';

import {
  ChannelAdapter,
  MessageNormalizer,
  type ChannelConfig,
  type ChannelCapabilities,
  type HealthStatus,
  type InboundMessage,
  type OutboundMessage,
  type SendResult,
  type MediaAttachment,
  type ChatType,
  type CallbackAction,
} from '../../channel-adapter.js';

import type { DiscordAdapterConfig, DiscordSlashCommand } from './types.js';
import { DISCORD_BOT_COMMANDS } from './types.js';

// =====================================================
// Sendable channel type union
// =====================================================

type SendableChannel = TextChannel | DMChannel | NewsChannel | ThreadChannel | VoiceChannel;

// =====================================================
// Discord Adapter
// =====================================================

/**
 * Discord Bot channel adapter.
 *
 * @example
 * ```typescript
 * import { ChannelRegistry } from '../../channel-adapter.js';
 * import { DiscordAdapter } from '@agentforge-ai/channels-discord';
 *
 * const registry = new ChannelRegistry();
 * registry.registerFactory('discord', () => new DiscordAdapter());
 *
 * const adapter = await registry.createAdapter({
 *   id: 'my-discord-bot',
 *   platform: 'discord',
 *   orgId: 'org-1',
 *   agentId: 'agent-1',
 *   enabled: true,
 *   credentials: { botToken: 'BOT_TOKEN', clientId: 'CLIENT_ID' },
 *   settings: {
 *     mentionOnly: false,
 *     respondToDMs: true,
 *   },
 * });
 * ```
 */
export class DiscordAdapter extends ChannelAdapter {
  readonly platform = 'discord';

  private client: Client | null = null;
  private adapterConfig: DiscordAdapterConfig | null = null;
  private botUserId: string = '';

  // Rate limiting
  private messageTimestamps: number[] = [];
  private rateLimitPerSecond: number = 5;

  // ----- Lifecycle -----

  async connect(config: ChannelConfig): Promise<void> {
    const botToken = config.credentials.botToken;
    if (!botToken) {
      throw new Error('Discord bot token is required in credentials.botToken');
    }

    this.adapterConfig = {
      botToken,
      clientId: config.credentials.clientId ?? (config.settings?.clientId as string | undefined),
      guildId: config.credentials.guildId ?? (config.settings?.guildId as string | undefined),
      registerCommands: config.settings?.registerCommands as boolean ?? true,
      mentionOnly: config.settings?.mentionOnly as boolean ?? false,
      respondToDMs: config.settings?.respondToDMs as boolean ?? true,
      rateLimitPerSecond: config.settings?.rateLimitPerSecond as number ?? 5,
    };

    this.rateLimitPerSecond = this.adapterConfig.rateLimitPerSecond!;

    // Build intent list — MessageContent requires privileged intent in Discord dev portal
    const intents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessageReactions,
    ];

    this.client = new Client({
      intents,
      partials: [Partials.Channel, Partials.Message],
    });

    // Register event handlers before login
    this.registerClientEvents();

    // Log in — this throws if the token is invalid
    await this.client.login(botToken);

    // Wait for the ready event
    await this.waitForReady();

    // Register slash commands if configured
    if (this.adapterConfig.registerCommands && this.adapterConfig.clientId) {
      await this.registerSlashCommands(
        botToken,
        this.adapterConfig.clientId,
        DISCORD_BOT_COMMANDS,
        this.adapterConfig.guildId
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
      this.client = null;
    }

    this.botUserId = '';
    this.adapterConfig = null;
  }

  // ----- Message Sending -----

  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    try {
      await this.enforceRateLimit();

      const targetChannelId = message.threadId ?? message.chatId;
      const channel = await this.resolveChannel(targetChannelId);
      if (!channel) {
        return { success: false, error: `Channel ${targetChannelId} not found` };
      }

      if (message.showTyping) {
        await this.sendTypingIndicator(message.chatId);
        if (message.typingDurationMs) {
          await this.sleep(message.typingDurationMs);
        }
      }

      const sendableChannel = channel as SendableChannel;

      // Build message payload
      const payload = this.buildMessagePayload(message);

      const sent = await sendableChannel.send(payload);

      return {
        success: true,
        platformMessageId: sent.id,
        deliveredAt: sent.createdAt,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ----- Capabilities -----

  getCapabilities(): ChannelCapabilities {
    return {
      supportedMedia: ['image', 'audio', 'video', 'file'],
      maxTextLength: 2000,
      supportsThreads: true,
      supportsReactions: true,
      supportsEditing: true,
      supportsDeleting: true,
      supportsTypingIndicator: true,
      supportsReadReceipts: false,
      supportsActions: false,
      supportsGroupChat: true,
      supportsMarkdown: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB
      platformSpecific: {
        supportsEmbeds: true,
        supportsSlashCommands: true,
        supportsThreads: true,
        supportsForums: true,
        supportsNitroFileSize: 500 * 1024 * 1024, // 500MB for Nitro servers
      },
    };
  }

  // ----- Health Check -----

  async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
    if (!this.client || !this.client.isReady()) {
      return { status: 'disconnected', details: 'Discord client is not ready' };
    }

    try {
      const user = this.client.user;
      if (user) {
        return {
          status: 'healthy',
          details: `Bot ${user.tag} (ID: ${user.id}) is connected`,
        };
      }
      return { status: 'degraded', details: 'Client ready but user is null' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ----- Optional Overrides -----

  override async editMessage(
    platformMessageId: string,
    message: Partial<OutboundMessage>
  ): Promise<SendResult> {
    try {
      if (!message.text && !message.platformOptions?.embeds) {
        return { success: false, error: 'Text or embeds are required for editing' };
      }

      const targetChannelId = message.threadId ?? message.chatId;
      if (!targetChannelId) {
        return { success: false, error: 'chatId is required for editing' };
      }

      const channel = await this.resolveChannel(targetChannelId);
      if (!channel) {
        return { success: false, error: `Channel ${targetChannelId} not found` };
      }

      const textChannel = channel as TextChannel | DMChannel | ThreadChannel;
      const msg = await textChannel.messages.fetch(platformMessageId);
      const editPayload = this.buildMessagePayload(message as OutboundMessage);
      await msg.edit(editPayload);

      return { success: true, platformMessageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  override async deleteMessage(
    platformMessageId: string,
    chatId: string
  ): Promise<boolean> {
    try {
      const channel = await this.resolveChannel(chatId);
      if (!channel) return false;

      const textChannel = channel as TextChannel | DMChannel | ThreadChannel;
      const msg = await textChannel.messages.fetch(platformMessageId);
      await msg.delete();
      return true;
    } catch {
      return false;
    }
  }

  override async sendTypingIndicator(chatId: string): Promise<void> {
    try {
      const channel = await this.resolveChannel(chatId);
      if (!channel) return;
      const sendable = channel as SendableChannel;
      await sendable.sendTyping();
    } catch {
      // Ignore typing indicator errors
    }
  }

  override async addReaction(
    platformMessageId: string,
    chatId: string,
    emoji: string
  ): Promise<boolean> {
    try {
      const channel = await this.resolveChannel(chatId);
      if (!channel) return false;

      const textChannel = channel as TextChannel | DMChannel | ThreadChannel;
      const msg = await textChannel.messages.fetch(platformMessageId);
      await msg.react(emoji);
      return true;
    } catch {
      return false;
    }
  }

  // ----- Internal: Client Events -----

  private registerClientEvents(): void {
    if (!this.client) return;

    this.client.on(Events.MessageCreate, (message: Message) => {
      this.handleDiscordMessage(message);
    });

    this.client.on(Events.MessageUpdate, (_old: Message | PartialMessage, newMessage: Message | PartialMessage) => {
      if (newMessage.partial) return;
      this.handleDiscordMessage(newMessage as Message, true);
    });

    this.client.on(Events.InteractionCreate, (interaction: Interaction) => {
      if (interaction.isChatInputCommand()) {
        this.handleSlashCommand(interaction);
      }
    });

    this.client.on(Events.Error, (error: Error) => {
      this.emit({
        type: 'error',
        data: { error, recoverable: true },
      });
    });
  }

  // ----- Internal: Message Handling -----

  private handleDiscordMessage(message: Message, isEdit = false): void {
    // Ignore messages from the bot itself
    if (message.author.id === this.botUserId) return;
    // Ignore other bots
    if (message.author.bot) return;

    // Guild channel: apply mention filter if configured
    if (message.guild && this.adapterConfig?.mentionOnly) {
      if (!this.isBotMentioned(message)) return;
    }

    // DM filter
    if (!message.guild && !this.adapterConfig?.respondToDMs) return;

    const normalized = this.normalizeDiscordMessage(message, isEdit);

    if (isEdit) {
      this.emit({ type: 'message_edited', data: normalized });
    } else {
      this.emitMessage(normalized);
    }
  }

  private handleSlashCommand(interaction: ChatInputCommandInteraction): void {
    // Emit as a regular inbound message so the channel runner can handle commands
    const normalized = this.normalizeSlashCommand(interaction);
    this.emitMessage(normalized);
  }

  // ----- Internal: Message Normalization -----

  private normalizeDiscordMessage(message: Message, isEdit: boolean): InboundMessage {
    const chatId = message.channelId;
    const threadId = message.thread?.id;
    const chatType = this.mapChannelType(message.channel);

    // Strip bot @mention from content
    let text = message.content;
    if (this.botUserId && text) {
      text = text.replace(new RegExp(`<@!?${this.botUserId}>`, 'g'), '').trim();
    }

    const media = this.extractMedia(message);

    return MessageNormalizer.normalize({
      platformMessageId: message.id,
      channelId: this.config?.id ?? '',
      platform: 'discord',
      chatId,
      chatType,
      senderId: message.author.id,
      senderName: message.member?.displayName ?? message.author.displayName,
      senderUsername: message.author.username,
      senderAvatar: message.author.displayAvatarURL(),
      text: text || undefined,
      media,
      replyToId: message.reference?.messageId,
      threadId: threadId ?? (chatType === 'thread' ? chatId : undefined),
      rawData: {
        guildId: message.guildId,
        channelId: message.channelId,
        messageType: message.type,
      },
      timestamp: message.createdAt,
      isEdit,
    });
  }

  private normalizeSlashCommand(interaction: ChatInputCommandInteraction): InboundMessage {
    const chatType = this.mapChannelType(interaction.channel);

    return MessageNormalizer.normalize({
      platformMessageId: interaction.id,
      channelId: this.config?.id ?? '',
      platform: 'discord',
      chatId: interaction.channelId,
      chatType,
      senderId: interaction.user.id,
      senderName: interaction.member
        ? (interaction.member as { displayName?: string }).displayName ?? interaction.user.displayName
        : interaction.user.displayName,
      senderUsername: interaction.user.username,
      senderAvatar: interaction.user.displayAvatarURL(),
      text: `/${interaction.commandName}`,
      rawData: {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        interactionId: interaction.id,
        commandName: interaction.commandName,
        isSlashCommand: true,
      },
      timestamp: interaction.createdAt,
    });
  }

  private extractMedia(message: Message): MediaAttachment[] | undefined {
    if (message.attachments.size === 0) return undefined;

    const media: MediaAttachment[] = [];

    for (const attachment of message.attachments.values()) {
      const mimeType = attachment.contentType ?? undefined;
      const mediaType = this.mapMimeTypeToMediaType(mimeType);

      media.push({
        type: mediaType,
        url: attachment.url,
        fileName: attachment.name ?? undefined,
        mimeType,
        sizeBytes: attachment.size,
        width: attachment.width ?? undefined,
        height: attachment.height ?? undefined,
      });
    }

    return media.length > 0 ? media : undefined;
  }

  private mapMimeTypeToMediaType(
    mimeType: string | undefined
  ): 'image' | 'audio' | 'video' | 'file' {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
  }

  private mapChannelType(channel: Channel | null): ChatType {
    if (!channel) return 'channel';

    switch (channel.type) {
      case ChannelType.DM:
      case ChannelType.GroupDM:
        return 'dm';
      case ChannelType.PublicThread:
      case ChannelType.PrivateThread:
      case ChannelType.AnnouncementThread:
        return 'thread';
      case ChannelType.GuildText:
      case ChannelType.GuildAnnouncement:
      case ChannelType.GuildForum:
      case ChannelType.GuildVoice:
        return 'channel';
      default:
        return 'channel';
    }
  }

  // ----- Internal: Message Payload Builder -----

  private buildMessagePayload(message: OutboundMessage | Partial<OutboundMessage>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (message.text) {
      payload['content'] = message.text;
    }

    // Support Discord embeds via platformOptions
    const embeds = message.platformOptions?.embeds;
    if (embeds) {
      payload['embeds'] = embeds;
    }

    // Reply reference
    if (message.replyToMessageId) {
      payload['reply'] = { messageReference: message.replyToMessageId };
    }

    return payload;
  }

  // ----- Internal: @Mention Detection -----

  private isBotMentioned(message: Message): boolean {
    if (!this.botUserId) return false;
    return message.mentions.users.has(this.botUserId);
  }

  // ----- Internal: Channel Resolution -----

  private async resolveChannel(channelId: string): Promise<Channel | null> {
    if (!this.client) return null;

    try {
      const cached = this.client.channels.cache.get(channelId);
      if (cached) return cached;

      return await this.client.channels.fetch(channelId);
    } catch {
      return null;
    }
  }

  // ----- Internal: Slash Command Registration -----

  private async registerSlashCommands(
    botToken: string,
    clientId: string,
    commands: DiscordSlashCommand[],
    guildId?: string
  ): Promise<void> {
    try {
      const rest = new REST({ version: '10' }).setToken(botToken);
      const route = guildId
        ? Routes.applicationGuildCommands(clientId, guildId)
        : Routes.applicationCommands(clientId);

      await rest.put(route, { body: commands });
    } catch {
      // Non-fatal: log but don't throw — bot can still work without slash commands
      this.emit({
        type: 'error',
        data: {
          error: new Error('Failed to register Discord slash commands'),
          recoverable: true,
        },
      });
    }
  }

  // ----- Internal: Ready Wait -----

  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Discord client is not initialized'));
        return;
      }

      if (this.client.isReady()) {
        this.botUserId = this.client.user!.id;
        resolve();
        return;
      }

      const onReady = () => {
        this.botUserId = this.client!.user!.id;
        resolve();
      };

      const onError = (error: Error) => {
        reject(error);
      };

      this.client.once(Events.ClientReady, onReady);
      this.client.once(Events.Error, onError);

      // Timeout after 30 seconds
      const timeout = setTimeout(() => {
        this.client?.off(Events.ClientReady, onReady);
        this.client?.off(Events.Error, onError);
        reject(new Error('Discord client did not become ready within 30 seconds'));
      }, 30000);

      this.client.once(Events.ClientReady, () => clearTimeout(timeout));
    });
  }

  // ----- Internal: Rate Limiting -----

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    this.messageTimestamps = this.messageTimestamps.filter((t) => now - t < 1000);

    if (this.messageTimestamps.length >= this.rateLimitPerSecond) {
      const oldestInWindow = this.messageTimestamps[0];
      const waitMs = 1000 - (now - oldestInWindow);
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
    }

    this.messageTimestamps.push(Date.now());
  }

  // ----- Utility -----

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
