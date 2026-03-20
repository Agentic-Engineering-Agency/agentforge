/**
 * Telegram Channel Adapter for AgentForge.
 *
 * Implements the ChannelAdapter interface for Telegram Bot API,
 * supporting both webhook and long-polling modes.
 *
 * Features:
 * - Text, images, audio, video, files, voice notes, stickers
 * - Inline keyboard buttons for agent interactions
 * - Group chat with @mention detection
 * - Webhook mode (production) + long-polling (development)
 * - Reply-to threading
 * - Rate limiting per Telegram API limits
 *
 * @packageDocumentation
 */

import {
  ChannelAdapter,
  MessageNormalizer,
  type ChannelConfig,
  type ChannelCapabilities,
  type ChannelEvent,
  type ConnectionState,
  type HealthStatus,
  type InboundMessage,
  type OutboundMessage,
  type SendResult,
  type MediaAttachment,
  type ChatType,
  type CallbackAction,
} from '../channel-adapter.js';

// =====================================================
// Telegram-Specific Types
// =====================================================

/**
 * Telegram Bot API Update object (simplified).
 */
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Telegram Message object (simplified).
 */
export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  reply_to_message?: TelegramMessage;
  photo?: TelegramPhotoSize[];
  audio?: TelegramAudio;
  video?: TelegramVideo;
  document?: TelegramDocument;
  voice?: TelegramVoice;
  sticker?: TelegramSticker;
  entities?: TelegramMessageEntity[];
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
  title?: string;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated: boolean;
  emoji?: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

/**
 * Inline keyboard button for Telegram.
 */
export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

/**
 * Telegram adapter configuration.
 */
export interface TelegramAdapterConfig {
  /** Bot token from BotFather */
  botToken: string;
  /** Whether to use webhook mode (true) or long-polling (false). Default: false */
  useWebhook?: boolean;
  /** Webhook URL (required if useWebhook is true) */
  webhookUrl?: string;
  /** Webhook secret token for verification */
  webhookSecret?: string;
  /** Polling interval in ms. Default: 1000 */
  pollingIntervalMs?: number;
  /** Bot username (for @mention detection in groups) */
  botUsername?: string;
  /** Whether to respond only to @mentions in groups. Default: true */
  groupMentionOnly?: boolean;
  /** Rate limit: max messages per second. Default: 30 */
  rateLimitPerSecond?: number;
}

// =====================================================
// Telegram Adapter
// =====================================================

/**
 * Telegram Bot API channel adapter.
 *
 * @example
 * ```typescript
 * import { ChannelRegistry } from '@agentforge-ai/core';
 * import { TelegramAdapter } from '@agentforge-ai/core/adapters/telegram';
 *
 * const registry = new ChannelRegistry();
 * registry.registerFactory('telegram', () => new TelegramAdapter());
 *
 * const adapter = await registry.createAdapter({
 *   id: 'my-telegram-bot',
 *   platform: 'telegram',
 *   orgId: 'org-1',
 *   agentId: 'agent-1',
 *   enabled: true,
 *   credentials: { botToken: 'BOT_TOKEN' },
 *   settings: {
 *     botUsername: 'my_bot',
 *     groupMentionOnly: true,
 *   },
 * });
 * ```
 */
export class TelegramAdapter extends ChannelAdapter {
  readonly platform = 'telegram';

  private botToken: string = '';
  private botUsername: string = '';
  private botInfo: TelegramUser | null = null;
  private pollingActive: boolean = false;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private lastUpdateId: number = 0;
  private adapterConfig: TelegramAdapterConfig | null = null;

  // Rate limiting
  private messageTimestamps: number[] = [];
  private rateLimitPerSecond: number = 30;

  // Base URL for Telegram Bot API
  private get apiBase(): string {
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  // ----- Lifecycle -----

  async connect(config: ChannelConfig): Promise<void> {
    this.botToken = config.credentials.botToken;
    if (!this.botToken) {
      throw new Error('Telegram bot token is required in credentials.botToken');
    }

    this.adapterConfig = {
      botToken: this.botToken,
      useWebhook: config.settings?.useWebhook as boolean ?? false,
      webhookUrl: config.settings?.webhookUrl as string ?? config.webhookUrl,
      webhookSecret: config.settings?.webhookSecret as string,
      pollingIntervalMs: config.settings?.pollingIntervalMs as number ?? 1000,
      botUsername: config.settings?.botUsername as string ?? '',
      groupMentionOnly: config.settings?.groupMentionOnly as boolean ?? true,
      rateLimitPerSecond: config.settings?.rateLimitPerSecond as number ?? 30,
    };

    this.rateLimitPerSecond = this.adapterConfig.rateLimitPerSecond!;

    // Verify bot token by calling getMe
    this.botInfo = await this.callApi<TelegramUser>('getMe');
    this.botUsername =
      this.adapterConfig.botUsername || this.botInfo.username || '';

    if (this.adapterConfig.useWebhook && this.adapterConfig.webhookUrl) {
      // Set webhook
      await this.callApi('setWebhook', {
        url: this.adapterConfig.webhookUrl,
        secret_token: this.adapterConfig.webhookSecret,
      });
    } else {
      // Start long-polling
      await this.callApi('deleteWebhook');
      this.startPolling();
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();

    if (this.adapterConfig?.useWebhook) {
      try {
        await this.callApi('deleteWebhook');
      } catch (error) {
        console.debug('[TelegramAdapter.disconnect] Failed to delete webhook:', error instanceof Error ? error.message : error);
      }
    }

    this.botToken = '';
    this.botInfo = null;
    this.adapterConfig = null;
  }

  // ----- Message Sending -----

  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    try {
      // Rate limiting
      await this.enforceRateLimit();

      // Show typing indicator
      if (message.showTyping) {
        await this.sendTypingIndicator(message.chatId);
        if (message.typingDurationMs) {
          await this.sleep(message.typingDurationMs);
        }
      }

      // Build inline keyboard from actions
      const replyMarkup = message.actions
        ? this.buildInlineKeyboard(message)
        : undefined;

      // Send media if present
      if (message.media && message.media.length > 0) {
        return await this.sendMediaMessage(message, replyMarkup);
      }

      // Send text message
      if (message.text) {
        const params: Record<string, unknown> = {
          chat_id: message.chatId,
          text: message.text,
          parse_mode: message.markdown ? 'MarkdownV2' : undefined,
          reply_to_message_id: message.replyToMessageId
            ? parseInt(message.replyToMessageId)
            : undefined,
          reply_markup: replyMarkup
            ? JSON.stringify(replyMarkup)
            : undefined,
        };

        // Remove undefined values
        Object.keys(params).forEach(
          (k) => params[k] === undefined && delete params[k]
        );

        const result = await this.callApi<TelegramMessage>(
          'sendMessage',
          params
        );

        return {
          success: true,
          platformMessageId: String(result.message_id),
          deliveredAt: new Date(result.date * 1000),
        };
      }

      return { success: false, error: 'No text or media to send' };
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
      supportedMedia: [
        'image',
        'audio',
        'video',
        'file',
        'voice_note',
        'sticker',
        'location',
      ],
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
      maxFileSize: 50 * 1024 * 1024, // 50MB
      platformSpecific: {
        supportsInlineKeyboards: true,
        supportsCallbackQueries: true,
        supportsBotCommands: true,
        supportsWebhooks: true,
        supportsLongPolling: true,
      },
    };
  }

  // ----- Health Check -----

  async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
    try {
      const me = await this.callApi<TelegramUser>('getMe');
      if (me && me.id) {
        return {
          status: 'healthy',
          details: `Bot @${me.username} (ID: ${me.id}) is connected`,
        };
      }
      return { status: 'degraded', details: 'getMe returned unexpected result' };
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
      if (!message.text) {
        return { success: false, error: 'Text is required for editing' };
      }

      await this.callApi('editMessageText', {
        chat_id: message.chatId,
        message_id: parseInt(platformMessageId),
        text: message.text,
        parse_mode: message.markdown ? 'MarkdownV2' : undefined,
      });

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
      await this.callApi('deleteMessage', {
        chat_id: chatId,
        message_id: parseInt(platformMessageId),
      });
      return true;
    } catch {
      return false;
    }
  }

  override async sendTypingIndicator(chatId: string): Promise<void> {
    try {
      await this.callApi('sendChatAction', {
        chat_id: chatId,
        action: 'typing',
      });
    } catch (error) {
      console.debug('[TelegramAdapter.sendTypingIndicator] Failed for chat %s:', chatId, error instanceof Error ? error.message : error);
    }
  }

  // ----- Webhook Handler -----

  /**
   * Handle an incoming webhook update.
   * Call this from your webhook endpoint.
   */
  handleWebhookUpdate(update: TelegramUpdate): void {
    this.processUpdate(update);
  }

  // ----- Internal: Polling -----

  private startPolling(): void {
    this.pollingActive = true;
    this.poll();
  }

  private stopPolling(): void {
    this.pollingActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.pollingActive) return;

    try {
      const updates = await this.callApi<TelegramUpdate[]>('getUpdates', {
        offset: this.lastUpdateId + 1,
        timeout: 30,
        allowed_updates: JSON.stringify([
          'message',
          'edited_message',
          'callback_query',
        ]),
      });

      if (updates && updates.length > 0) {
        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          this.processUpdate(update);
        }
      }
    } catch (error) {
      this.emit({
        type: 'error',
        data: {
          error: error instanceof Error ? error : new Error(String(error)),
          recoverable: true,
        },
      });
    }

    // Schedule next poll
    const interval = this.adapterConfig?.pollingIntervalMs ?? 1000;
    this.pollingTimer = setTimeout(() => this.poll(), interval);
  }

  // ----- Internal: Update Processing -----

  private processUpdate(update: TelegramUpdate): void {
    if (update.callback_query) {
      this.processCallbackQuery(update.callback_query);
      return;
    }

    const message = update.message || update.edited_message;
    if (!message) return;

    const isEdit = !!update.edited_message;

    // Group mention check
    if (this.shouldIgnoreGroupMessage(message)) return;

    // Normalize the message
    const normalized = this.normalizeMessage(message, isEdit);

    if (isEdit) {
      this.emit({ type: 'message_edited', data: normalized });
    } else {
      this.emitMessage(normalized);
    }
  }

  private processCallbackQuery(query: TelegramCallbackQuery): void {
    const action: CallbackAction = {
      actionId: query.data || '',
      sender: {
        platformUserId: String(query.from.id),
        displayName: `${query.from.first_name}${query.from.last_name ? ' ' + query.from.last_name : ''}`,
        username: query.from.username,
      },
      chatId: query.message ? String(query.message.chat.id) : '',
      messageId: query.message ? String(query.message.message_id) : '',
      platform: 'telegram',
      channelId: this.config?.id || '',
      timestamp: new Date(),
    };

    this.emitCallback(action);

    // Answer callback query to remove loading state
    this.callApi('answerCallbackQuery', { callback_query_id: query.id }).catch(
      () => {}
    );
  }

  private shouldIgnoreGroupMessage(message: TelegramMessage): boolean {
    if (!this.adapterConfig?.groupMentionOnly) return false;

    const chatType = message.chat.type;
    if (chatType === 'private') return false;

    // Check for @mention of bot
    if (message.entities) {
      for (const entity of message.entities) {
        if (entity.type === 'mention' && message.text) {
          const mention = message.text.substring(
            entity.offset,
            entity.offset + entity.length
          );
          if (
            mention.toLowerCase() === `@${this.botUsername.toLowerCase()}`
          ) {
            return false;
          }
        }
        if (entity.type === 'bot_command') {
          return false;
        }
      }
    }

    // Check for reply to bot
    if (
      message.reply_to_message?.from?.id === this.botInfo?.id
    ) {
      return false;
    }

    return true; // Ignore non-mentioned group messages
  }

  private normalizeMessage(
    message: TelegramMessage,
    isEdit: boolean
  ): InboundMessage {
    const media = this.extractMedia(message);
    const text = message.text || message.caption;

    // Strip bot mention from text in groups
    let cleanText = text;
    if (cleanText && this.botUsername) {
      cleanText = cleanText
        .replace(new RegExp(`@${this.botUsername}\\b`, 'gi'), '')
        .trim();
    }

    return MessageNormalizer.normalize({
      platformMessageId: String(message.message_id),
      channelId: this.config?.id || '',
      platform: 'telegram',
      chatId: String(message.chat.id),
      chatType: this.mapChatType(message.chat.type),
      senderId: String(message.from?.id || 0),
      senderName: message.from
        ? `${message.from.first_name}${message.from.last_name ? ' ' + message.from.last_name : ''}`
        : undefined,
      senderUsername: message.from?.username,
      text: cleanText,
      media,
      replyToId: message.reply_to_message
        ? String(message.reply_to_message.message_id)
        : undefined,
      replyToText: message.reply_to_message?.text,
      rawData: message as unknown as Record<string, unknown>,
      timestamp: new Date(message.date * 1000),
      isEdit,
    });
  }

  private extractMedia(message: TelegramMessage): MediaAttachment[] | undefined {
    const media: MediaAttachment[] = [];

    if (message.photo && message.photo.length > 0) {
      // Get the largest photo
      const largest = message.photo[message.photo.length - 1];
      media.push({
        type: 'image',
        url: `telegram:file:${largest.file_id}`,
        width: largest.width,
        height: largest.height,
        sizeBytes: largest.file_size,
        caption: message.caption,
      });
    }

    if (message.audio) {
      media.push({
        type: 'audio',
        url: `telegram:file:${message.audio.file_id}`,
        mimeType: message.audio.mime_type,
        sizeBytes: message.audio.file_size,
        durationSeconds: message.audio.duration,
        caption: message.caption,
      });
    }

    if (message.video) {
      media.push({
        type: 'video',
        url: `telegram:file:${message.video.file_id}`,
        mimeType: message.video.mime_type,
        width: message.video.width,
        height: message.video.height,
        sizeBytes: message.video.file_size,
        durationSeconds: message.video.duration,
        caption: message.caption,
      });
    }

    if (message.document) {
      media.push({
        type: 'file',
        url: `telegram:file:${message.document.file_id}`,
        fileName: message.document.file_name,
        mimeType: message.document.mime_type,
        sizeBytes: message.document.file_size,
        caption: message.caption,
      });
    }

    if (message.voice) {
      media.push({
        type: 'voice_note',
        url: `telegram:file:${message.voice.file_id}`,
        mimeType: message.voice.mime_type,
        sizeBytes: message.voice.file_size,
        durationSeconds: message.voice.duration,
      });
    }

    if (message.sticker) {
      media.push({
        type: 'sticker',
        url: `telegram:file:${message.sticker.file_id}`,
        width: message.sticker.width,
        height: message.sticker.height,
      });
    }

    return media.length > 0 ? media : undefined;
  }

  private mapChatType(
    type: 'private' | 'group' | 'supergroup' | 'channel'
  ): ChatType {
    switch (type) {
      case 'private':
        return 'dm';
      case 'group':
      case 'supergroup':
        return 'group';
      case 'channel':
        return 'channel';
      default:
        return 'dm';
    }
  }

  // ----- Internal: Media Sending -----

  private async sendMediaMessage(
    message: OutboundMessage,
    replyMarkup?: Record<string, unknown>
  ): Promise<SendResult> {
    const media = message.media![0];
    const baseParams: Record<string, unknown> = {
      chat_id: message.chatId,
      caption: message.text,
      parse_mode: message.markdown ? 'MarkdownV2' : undefined,
      reply_to_message_id: message.replyToMessageId
        ? parseInt(message.replyToMessageId)
        : undefined,
      reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined,
    };

    // Remove undefined values
    Object.keys(baseParams).forEach(
      (k) => baseParams[k] === undefined && delete baseParams[k]
    );

    let method: string;
    let fileParam: string;

    switch (media.type) {
      case 'image':
        method = 'sendPhoto';
        fileParam = 'photo';
        break;
      case 'audio':
        method = 'sendAudio';
        fileParam = 'audio';
        break;
      case 'video':
        method = 'sendVideo';
        fileParam = 'video';
        break;
      case 'voice_note':
        method = 'sendVoice';
        fileParam = 'voice';
        break;
      case 'sticker':
        method = 'sendSticker';
        fileParam = 'sticker';
        break;
      default:
        method = 'sendDocument';
        fileParam = 'document';
    }

    const result = await this.callApi<TelegramMessage>(method, {
      ...baseParams,
      [fileParam]: media.url,
    });

    return {
      success: true,
      platformMessageId: String(result.message_id),
      deliveredAt: new Date(result.date * 1000),
    };
  }

  // ----- Internal: Inline Keyboard -----

  private buildInlineKeyboard(
    message: OutboundMessage
  ): Record<string, unknown> | undefined {
    if (!message.actions || message.actions.length === 0) return undefined;

    const buttons: TelegramInlineKeyboardButton[][] = [];
    let currentRow: TelegramInlineKeyboardButton[] = [];

    for (const action of message.actions) {
      if (action.type === 'url_button' && action.url) {
        currentRow.push({ text: action.label, url: action.url });
      } else if (action.type === 'button') {
        currentRow.push({
          text: action.label,
          callback_data: action.actionId,
        });
      }

      // Max 3 buttons per row
      if (currentRow.length >= 3) {
        buttons.push(currentRow);
        currentRow = [];
      }
    }

    if (currentRow.length > 0) {
      buttons.push(currentRow);
    }

    return { inline_keyboard: buttons };
  }

  // ----- Internal: Rate Limiting -----

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than 1 second
    this.messageTimestamps = this.messageTimestamps.filter(
      (t) => now - t < 1000
    );

    if (this.messageTimestamps.length >= this.rateLimitPerSecond) {
      const oldestInWindow = this.messageTimestamps[0];
      const waitMs = 1000 - (now - oldestInWindow);
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
    }

    this.messageTimestamps.push(Date.now());
  }

  // ----- Internal: API Calls -----

  /**
   * Call the Telegram Bot API.
   */
  private async callApi<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.apiBase}/${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
    });

    const data = (await response.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
      error_code?: number;
    };

    if (!data.ok) {
      throw new Error(
        `Telegram API error (${data.error_code}): ${data.description}`
      );
    }

    return data.result as T;
  }

  /**
   * Get a file download URL from Telegram.
   */
  async getFileUrl(fileId: string): Promise<string> {
    const file = await this.callApi<{ file_path: string }>('getFile', {
      file_id: fileId,
    });
    return `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
  }

  // ----- Utility -----

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
