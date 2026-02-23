/**
 * Slack Channel Adapter for AgentForge.
 *
 * Implements the ChannelAdapter interface using Slack Bolt.js with
 * Socket Mode and Events API support.
 *
 * Features:
 * - Socket Mode (WebSocket) and HTTP Events API
 * - Block Kit rich messages
 * - Slash command handling
 * - app_mention event handling
 * - Signature verification (HMAC-SHA256 via crypto.subtle)
 * - Rate limiting with queue and delay
 * - Zod config validation
 *
 * @packageDocumentation
 */

import { App } from '@slack/bolt';
import {
  ChannelAdapter,
  MessageNormalizer,
  type ChannelConfig,
  type ChannelCapabilities,
  type HealthStatus,
  type OutboundMessage,
  type SendResult,
  type ChatType,
} from '@agentforge-ai/core';
import { slackConfigSchema, type SlackConfig, type SlackBlock } from './types.js';

// =====================================================
// Slack Adapter
// =====================================================

export class SlackAdapter extends ChannelAdapter {
  readonly platform = 'slack';

  private app: App | null = null;
  private slackConfig: SlackConfig | null = null;

  // Rate limiting
  private messageTimestamps: number[] = [];
  private readonly rateLimitPerSecond: number = 50; // Slack tier 3 limit
  private sendQueue: Array<{ fn: () => Promise<void>; resolve: () => void; reject: (e: Error) => void }> = [];
  private processingQueue = false;

  // Event handlers registered by consumers
  private mentionHandler: ((event: { channel: string; user: string; text: string; ts: string; thread_ts?: string }) => void | Promise<void>) | null = null;
  private slashCommandHandlers: Map<string, (payload: { channel_id: string; user_id: string; text: string; trigger_id: string }) => void | Promise<void>> = new Map();

  // ----- Lifecycle -----

  async connect(config: ChannelConfig): Promise<void> {
    const parsed = slackConfigSchema.safeParse({
      botToken: config.credentials.botToken,
      appToken: config.credentials.appToken,
      signingSecret: config.credentials.signingSecret,
      socketMode: config.settings?.socketMode ?? true,
      port: config.settings?.port ?? 3002,
    });

    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid Slack config: ${issues}`);
    }

    this.slackConfig = parsed.data;

    this.app = new App({
      token: this.slackConfig.botToken,
      appToken: this.slackConfig.appToken,
      signingSecret: this.slackConfig.signingSecret,
      socketMode: this.slackConfig.socketMode,
      port: this.slackConfig.port,
    });

    // Wire up message events
    this.app.message(async ({ message, say }) => {
      // Skip bot messages and subtypes (edits, deletes, etc.)
      const msg = message as any;
      if (msg.bot_id || msg.subtype) return;

      const normalized = MessageNormalizer.normalize({
        platformMessageId: msg.ts,
        channelId: this.config?.id || '',
        platform: 'slack',
        chatId: msg.channel,
        chatType: this.getChatType(msg.channel_type),
        senderId: msg.user || '',
        text: msg.text || '',
        threadId: msg.thread_ts,
        rawData: msg,
        timestamp: new Date(parseFloat(msg.ts) * 1000),
      });

      this.emitMessage(normalized);
    });

    // Wire up app_mention events
    this.app.event('app_mention', async ({ event }) => {
      const normalized = MessageNormalizer.normalize({
        platformMessageId: event.ts,
        channelId: this.config?.id || '',
        platform: 'slack',
        chatId: event.channel,
        chatType: 'channel',
        senderId: event.user || '',
        text: event.text || '',
        threadId: (event as any).thread_ts,
        rawData: event as unknown as Record<string, unknown>,
        timestamp: new Date(parseFloat(event.ts) * 1000),
      });

      this.emitMessage(normalized);

      if (this.mentionHandler) {
        await this.mentionHandler({
          channel: event.channel,
          user: event.user || '',
          text: event.text || '',
          ts: event.ts,
          thread_ts: (event as any).thread_ts,
        });
      }
    });

    // Register any deferred slash commands
    for (const [command, handler] of this.slashCommandHandlers) {
      this.app.command(command, async ({ command: cmd, ack }) => {
        await ack();
        await handler({
          channel_id: cmd.channel_id,
          user_id: cmd.user_id,
          text: cmd.text,
          trigger_id: cmd.trigger_id,
        });
      });
    }

    await this.app.start();
  }

  async disconnect(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.app = null;
    }
    this.slackConfig = null;
    this.sendQueue = [];
    this.messageTimestamps = [];
  }

  // ----- Message Sending -----

  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    if (!this.app) {
      return { success: false, error: 'Slack app not connected' };
    }

    try {
      await this.enqueueRateLimited(async () => {
        // noop — actual send below
      });

      const result = await this.app.client.chat.postMessage({
        channel: message.chatId,
        text: message.text || '',
        thread_ts: message.threadId,
        mrkdwn: message.markdown ?? true,
      });

      return {
        success: result.ok ?? false,
        platformMessageId: result.ts,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a message with Block Kit blocks.
   */
  async sendBlocks(channelId: string, blocks: SlackBlock[], text?: string): Promise<SendResult> {
    if (!this.app) {
      return { success: false, error: 'Slack app not connected' };
    }

    try {
      await this.enforceRateLimit();

      const result = await this.app.client.chat.postMessage({
        channel: channelId,
        blocks: blocks as any[],
        text: text || '',
      });

      return {
        success: result.ok ?? false,
        platformMessageId: result.ts,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ----- Delete Message -----

  override async deleteMessage(platformMessageId: string, chatId: string): Promise<boolean> {
    if (!this.app) return false;

    try {
      const result = await this.app.client.chat.delete({
        channel: chatId,
        ts: platformMessageId,
      });
      return result.ok ?? false;
    } catch {
      return false;
    }
  }

  // ----- Capabilities -----

  getCapabilities(): ChannelCapabilities {
    return {
      supportedMedia: ['image', 'audio', 'video', 'file'],
      maxTextLength: 40000,
      supportsThreads: true,
      supportsReactions: true,
      supportsEditing: true,
      supportsDeleting: true,
      supportsTypingIndicator: false,
      supportsReadReceipts: false,
      supportsActions: true,
      supportsGroupChat: true,
      supportsMarkdown: true,
      maxFileSize: 1024 * 1024 * 1024, // 1GB
      platformSpecific: {
        supportsBlockKit: true,
        supportsSlashCommands: true,
        supportsSocketMode: true,
        supportsAppMention: true,
        supportsThreadReplies: true,
      },
    };
  }

  // ----- Health Check -----

  async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
    if (!this.app) {
      return { status: 'disconnected', details: 'Slack app not initialized' };
    }

    try {
      const result = await this.app.client.auth.test();
      if (result.ok) {
        return {
          status: 'healthy',
          details: `Slack bot: @${result.user} in ${result.team}`,
        };
      }
      return { status: 'degraded', details: `auth.test returned ok=false` };
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
    if (!this.app) {
      return { success: false, error: 'Slack app not connected' };
    }

    try {
      const result = await this.app.client.chat.update({
        channel: message.chatId || '',
        ts: platformMessageId,
        text: message.text || '',
      });

      return {
        success: result.ok ?? false,
        platformMessageId: result.ts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  override async addReaction(
    platformMessageId: string,
    chatId: string,
    emoji: string
  ): Promise<boolean> {
    if (!this.app) return false;

    try {
      const result = await this.app.client.reactions.add({
        channel: chatId,
        timestamp: platformMessageId,
        name: emoji.replace(/:/g, ''),
      });
      return result.ok ?? false;
    } catch {
      return false;
    }
  }

  // ----- Slash Command Registration -----

  onSlashCommand(
    command: string,
    handler: (payload: { channel_id: string; user_id: string; text: string; trigger_id: string }) => void | Promise<void>
  ): void {
    this.slashCommandHandlers.set(command, handler);

    if (this.app) {
      this.app.command(command, async ({ command: cmd, ack }) => {
        await ack();
        await handler({
          channel_id: cmd.channel_id,
          user_id: cmd.user_id,
          text: cmd.text,
          trigger_id: cmd.trigger_id,
        });
      });
    }
  }

  // ----- Mention Handler Registration -----

  onMention(
    handler: (event: { channel: string; user: string; text: string; ts: string; thread_ts?: string }) => void | Promise<void>
  ): void {
    this.mentionHandler = handler;
  }

  // ----- Signature Verification -----

  /**
   * Verify Slack request signature using HMAC-SHA256 via crypto.subtle.
   * Used for HTTP Events API mode (not needed for Socket Mode).
   */
  static async verifySignature(
    signingSecret: string,
    body: string,
    timestamp: string,
    signature: string
  ): Promise<boolean> {
    // Check timestamp freshness (5 min window)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      return false;
    }

    const encoder = new TextEncoder();
    const sigBaseString = `v0:${timestamp}:${body}`;

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(sigBaseString));
    const computedHex = `v0=${Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;

    // Constant-time comparison
    const computedBytes = encoder.encode(computedHex);
    const expectedBytes = encoder.encode(signature);

    if (computedBytes.length !== expectedBytes.length) return false;

    let diff = 0;
    for (let i = 0; i < computedBytes.length; i++) {
      diff |= computedBytes[i] ^ expectedBytes[i];
    }
    return diff === 0;
  }

  // ----- Internal: Rate Limiting -----

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    this.messageTimestamps = this.messageTimestamps.filter((t) => now - t < 1000);

    if (this.messageTimestamps.length >= this.rateLimitPerSecond) {
      const oldestInWindow = this.messageTimestamps[0];
      const waitMs = 1000 - (now - oldestInWindow);
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
    }

    this.messageTimestamps.push(Date.now());
  }

  private async enqueueRateLimited(fn: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.sendQueue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    while (this.sendQueue.length > 0) {
      const item = this.sendQueue.shift()!;
      try {
        await this.enforceRateLimit();
        await item.fn();
        item.resolve();
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.processingQueue = false;
  }

  // ----- Internal: Chat Type Mapping -----

  private getChatType(channelType?: string): ChatType {
    switch (channelType) {
      case 'im':
        return 'dm';
      case 'mpim':
        return 'group';
      case 'channel':
      case 'group':
        return 'channel';
      default:
        return 'channel';
    }
  }
}
