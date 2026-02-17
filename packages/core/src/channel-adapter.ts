/**
 * Channel Adapter Architecture for AgentForge.
 *
 * Defines the plugin interface for connecting agents to external
 * messaging platforms (Telegram, Discord, WhatsApp, Slack, etc.).
 *
 * Architecture:
 * - `ChannelAdapter` — Abstract base class for all channel adapters
 * - `ChannelRegistry` — Registry for managing adapter lifecycle
 * - `MessageNormalizer` — Converts platform-specific messages to internal format
 * - Event-driven architecture (not polling)
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// =====================================================
// Core Types
// =====================================================

/**
 * Supported media types for channel messages.
 */
export type MediaType =
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'voice_note'
  | 'sticker'
  | 'location'
  | 'contact';

/**
 * Health status of a channel adapter.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';

/**
 * Connection state of a channel adapter.
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Chat type for routing messages.
 */
export type ChatType = 'dm' | 'group' | 'channel' | 'thread';

/**
 * Media attachment in a message.
 */
export interface MediaAttachment {
  /** Type of media */
  type: MediaType;
  /** URL or path to the media */
  url: string;
  /** MIME type */
  mimeType?: string;
  /** File name */
  fileName?: string;
  /** File size in bytes */
  sizeBytes?: number;
  /** Duration in seconds (for audio/video) */
  durationSeconds?: number;
  /** Width in pixels (for images/video) */
  width?: number;
  /** Height in pixels (for images/video) */
  height?: number;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Caption text */
  caption?: string;
}

/**
 * Normalized inbound message from any channel.
 */
export interface InboundMessage {
  /** Unique message ID from the platform */
  platformMessageId: string;
  /** Channel adapter ID that received this message */
  channelId: string;
  /** Platform name (e.g., 'telegram', 'discord') */
  platform: string;
  /** Chat/conversation ID */
  chatId: string;
  /** Chat type */
  chatType: ChatType;
  /** Sender information */
  sender: {
    /** Platform-specific user ID */
    platformUserId: string;
    /** Display name */
    displayName?: string;
    /** Username/handle */
    username?: string;
    /** Avatar URL */
    avatarUrl?: string;
  };
  /** Text content of the message */
  text?: string;
  /** Media attachments */
  media?: MediaAttachment[];
  /** Message being replied to */
  replyTo?: {
    platformMessageId: string;
    text?: string;
  };
  /** Thread ID if in a thread */
  threadId?: string;
  /** Raw platform-specific data */
  rawData?: Record<string, unknown>;
  /** Timestamp of the message */
  timestamp: Date;
  /** Whether this is an edit of a previous message */
  isEdit?: boolean;
}

/**
 * Outbound message to send via a channel.
 */
export interface OutboundMessage {
  /** Target chat/conversation ID */
  chatId: string;
  /** Text content */
  text?: string;
  /** Media attachments to send */
  media?: MediaAttachment[];
  /** Message to reply to */
  replyToMessageId?: string;
  /** Thread ID to send in */
  threadId?: string;
  /** Markdown formatting (adapter converts to platform-specific) */
  markdown?: boolean;
  /** Typing indicator before sending */
  showTyping?: boolean;
  /** Typing duration in ms before sending */
  typingDurationMs?: number;
  /** Interactive elements (buttons, menus) */
  actions?: MessageAction[];
  /** Platform-specific options */
  platformOptions?: Record<string, unknown>;
}

/**
 * Interactive action (button, menu item) in a message.
 */
export interface MessageAction {
  /** Action type */
  type: 'button' | 'url_button' | 'menu';
  /** Display label */
  label: string;
  /** Action ID for callback */
  actionId: string;
  /** URL for url_button type */
  url?: string;
  /** Menu options for menu type */
  options?: Array<{ label: string; value: string }>;
}

/**
 * Result of sending a message.
 */
export interface SendResult {
  /** Whether the send was successful */
  success: boolean;
  /** Platform message ID of the sent message */
  platformMessageId?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamp when delivered */
  deliveredAt?: Date;
}

/**
 * Callback action from interactive elements.
 */
export interface CallbackAction {
  /** The action ID that was triggered */
  actionId: string;
  /** The value selected (for menus) */
  value?: string;
  /** The user who triggered the action */
  sender: InboundMessage['sender'];
  /** Chat where the action occurred */
  chatId: string;
  /** Original message ID */
  messageId: string;
  /** Platform name */
  platform: string;
  /** Channel adapter ID */
  channelId: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Capabilities of a channel adapter.
 */
export interface ChannelCapabilities {
  /** Supported media types */
  supportedMedia: MediaType[];
  /** Maximum text length */
  maxTextLength: number;
  /** Whether the channel supports threads */
  supportsThreads: boolean;
  /** Whether the channel supports reactions */
  supportsReactions: boolean;
  /** Whether the channel supports editing messages */
  supportsEditing: boolean;
  /** Whether the channel supports deleting messages */
  supportsDeleting: boolean;
  /** Whether the channel supports typing indicators */
  supportsTypingIndicator: boolean;
  /** Whether the channel supports read receipts */
  supportsReadReceipts: boolean;
  /** Whether the channel supports interactive actions (buttons, menus) */
  supportsActions: boolean;
  /** Whether the channel supports group chats */
  supportsGroupChat: boolean;
  /** Whether the channel supports markdown formatting */
  supportsMarkdown: boolean;
  /** Maximum file upload size in bytes */
  maxFileSize?: number;
  /** Platform-specific capabilities */
  platformSpecific?: Record<string, unknown>;
}

/**
 * Configuration for a channel adapter instance.
 */
export interface ChannelConfig {
  /** Unique adapter instance ID */
  id: string;
  /** Platform name */
  platform: string;
  /** Organization ID this adapter belongs to */
  orgId: string;
  /** Agent ID to route messages to */
  agentId: string;
  /** Whether the adapter is enabled */
  enabled: boolean;
  /** Platform-specific credentials and settings */
  credentials: Record<string, string>;
  /** Platform-specific configuration */
  settings?: Record<string, unknown>;
  /** Webhook URL for receiving events (if applicable) */
  webhookUrl?: string;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in ms */
  reconnectIntervalMs?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

// =====================================================
// Channel Adapter Events
// =====================================================

/**
 * Events emitted by channel adapters.
 */
export type ChannelEvent =
  | { type: 'message'; data: InboundMessage }
  | { type: 'callback'; data: CallbackAction }
  | { type: 'connection_state'; data: { state: ConnectionState; error?: string } }
  | { type: 'health'; data: { status: HealthStatus; details?: string } }
  | { type: 'error'; data: { error: Error; recoverable: boolean } }
  | { type: 'message_edited'; data: InboundMessage }
  | { type: 'message_deleted'; data: { platformMessageId: string; chatId: string } }
  | { type: 'reaction'; data: { messageId: string; emoji: string; userId: string; added: boolean } };

/**
 * Event handler type.
 */
export type ChannelEventHandler = (event: ChannelEvent) => void | Promise<void>;

// =====================================================
// Abstract Channel Adapter
// =====================================================

/**
 * Abstract base class for all channel adapters.
 *
 * Implement this class to create a new channel adapter for a
 * messaging platform. The adapter handles:
 * - Connection lifecycle (connect, disconnect, reconnect)
 * - Inbound message reception and normalization
 * - Outbound message sending
 * - Health monitoring
 *
 * @example
 * ```typescript
 * class TelegramAdapter extends ChannelAdapter {
 *   readonly platform = 'telegram';
 *
 *   async connect(config: ChannelConfig): Promise<void> {
 *     // Initialize Telegram Bot API
 *   }
 *
 *   async disconnect(): Promise<void> {
 *     // Stop polling/webhook
 *   }
 *
 *   async sendMessage(message: OutboundMessage): Promise<SendResult> {
 *     // Send via Telegram Bot API
 *   }
 *
 *   getCapabilities(): ChannelCapabilities {
 *     return {
 *       supportedMedia: ['image', 'audio', 'video', 'file', 'voice_note', 'sticker', 'location'],
 *       maxTextLength: 4096,
 *       supportsThreads: true,
 *       // ...
 *     };
 *   }
 *
 *   async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
 *     // Check Telegram API connectivity
 *   }
 * }
 * ```
 */
export abstract class ChannelAdapter {
  /** Platform identifier (e.g., 'telegram', 'discord') */
  abstract readonly platform: string;

  /** Current connection state */
  protected connectionState: ConnectionState = 'disconnected';

  /** Configuration for this adapter instance */
  protected config: ChannelConfig | null = null;

  /** Event handlers */
  private eventHandlers: Set<ChannelEventHandler> = new Set();

  /** Reconnect timer */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Current reconnect attempt count */
  private reconnectAttempts: number = 0;

  // ----- Abstract Methods (must implement) -----

  /**
   * Connect to the messaging platform.
   * Called when the adapter is started or restarted.
   */
  abstract connect(config: ChannelConfig): Promise<void>;

  /**
   * Disconnect from the messaging platform.
   * Clean up resources, stop polling/webhooks.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Send a message to the platform.
   */
  abstract sendMessage(message: OutboundMessage): Promise<SendResult>;

  /**
   * Get the capabilities of this channel adapter.
   */
  abstract getCapabilities(): ChannelCapabilities;

  /**
   * Perform a health check on the adapter.
   */
  abstract healthCheck(): Promise<{ status: HealthStatus; details?: string }>;

  // ----- Optional Override Methods -----

  /**
   * Edit a previously sent message.
   * Override if the platform supports editing.
   */
  async editMessage(
    _platformMessageId: string,
    _message: Partial<OutboundMessage>
  ): Promise<SendResult> {
    return {
      success: false,
      error: `${this.platform} adapter does not support message editing`,
    };
  }

  /**
   * Delete a previously sent message.
   * Override if the platform supports deletion.
   */
  async deleteMessage(_platformMessageId: string, _chatId: string): Promise<boolean> {
    return false;
  }

  /**
   * Send a typing indicator.
   * Override if the platform supports typing indicators.
   */
  async sendTypingIndicator(_chatId: string): Promise<void> {
    // No-op by default
  }

  /**
   * React to a message with an emoji.
   * Override if the platform supports reactions.
   */
  async addReaction(
    _platformMessageId: string,
    _chatId: string,
    _emoji: string
  ): Promise<boolean> {
    return false;
  }

  // ----- Event System -----

  /**
   * Register an event handler.
   */
  on(handler: ChannelEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all registered handlers.
   * Call this from your adapter implementation when events occur.
   */
  protected emit(event: ChannelEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[${this.platform}] Event handler error:`, err);
          });
        }
      } catch (err) {
        console.error(`[${this.platform}] Event handler error:`, err);
      }
    }
  }

  /**
   * Convenience method: emit an inbound message event.
   */
  protected emitMessage(message: InboundMessage): void {
    this.emit({ type: 'message', data: message });
  }

  /**
   * Convenience method: emit a callback action event.
   */
  protected emitCallback(action: CallbackAction): void {
    this.emit({ type: 'callback', data: action });
  }

  // ----- Connection State Management -----

  /**
   * Get the current connection state.
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): ChannelConfig | null {
    return this.config;
  }

  /**
   * Update the connection state and emit event.
   */
  protected setConnectionState(state: ConnectionState, error?: string): void {
    this.connectionState = state;
    this.emit({
      type: 'connection_state',
      data: { state, error },
    });
  }

  // ----- Auto-Reconnect -----

  /**
   * Start the adapter with auto-reconnect support.
   */
  async start(config: ChannelConfig): Promise<void> {
    this.config = config;
    this.reconnectAttempts = 0;

    try {
      this.setConnectionState('connecting');
      await this.connect(config);
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
    } catch (error) {
      this.setConnectionState('error', error instanceof Error ? error.message : String(error));
      if (config.autoReconnect !== false) {
        this.scheduleReconnect();
      } else {
        throw error;
      }
    }
  }

  /**
   * Stop the adapter and cancel reconnection.
   */
  async stop(): Promise<void> {
    this.cancelReconnect();
    try {
      await this.disconnect();
    } finally {
      this.setConnectionState('disconnected');
      this.config = null;
    }
  }

  /**
   * Trigger a reconnection attempt.
   * Call this from your adapter if the connection drops.
   */
  protected async triggerReconnect(): Promise<void> {
    if (!this.config || this.config.autoReconnect === false) return;
    this.setConnectionState('reconnecting');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.config) return;

    const maxAttempts = this.config.maxReconnectAttempts ?? 10;
    if (this.reconnectAttempts >= maxAttempts) {
      this.emit({
        type: 'error',
        data: {
          error: new Error(`Max reconnect attempts (${maxAttempts}) reached`),
          recoverable: false,
        },
      });
      this.setConnectionState('error', 'Max reconnect attempts reached');
      return;
    }

    const baseInterval = this.config.reconnectIntervalMs ?? 5000;
    // Exponential backoff with jitter
    const delay = Math.min(
      baseInterval * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      60000 // Max 60s
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        this.setConnectionState('reconnecting');
        await this.connect(this.config!);
        this.setConnectionState('connected');
        this.reconnectAttempts = 0;
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// =====================================================
// Channel Registry
// =====================================================

/**
 * Registry for managing channel adapter instances.
 *
 * Provides lifecycle management, hot-reload, and health monitoring
 * for all registered channel adapters.
 *
 * @example
 * ```typescript
 * const registry = new ChannelRegistry();
 *
 * // Register adapter factories
 * registry.registerFactory('telegram', () => new TelegramAdapter());
 * registry.registerFactory('discord', () => new DiscordAdapter());
 *
 * // Create and start an adapter instance
 * const adapter = await registry.createAdapter({
 *   id: 'my-telegram-bot',
 *   platform: 'telegram',
 *   orgId: 'org-123',
 *   agentId: 'agent-456',
 *   enabled: true,
 *   credentials: { botToken: 'xxx' },
 * });
 *
 * // Route messages to agent
 * adapter.on((event) => {
 *   if (event.type === 'message') {
 *     agent.handleMessage(event.data);
 *   }
 * });
 * ```
 */
export class ChannelRegistry {
  /** Adapter factories by platform */
  private factories: Map<string, () => ChannelAdapter> = new Map();

  /** Active adapter instances by ID */
  private adapters: Map<string, ChannelAdapter> = new Map();

  /** Global event handlers */
  private globalHandlers: Set<ChannelEventHandler> = new Set();

  /**
   * Register an adapter factory for a platform.
   */
  registerFactory(platform: string, factory: () => ChannelAdapter): void {
    if (this.factories.has(platform)) {
      throw new Error(`Factory for platform '${platform}' is already registered`);
    }
    this.factories.set(platform, factory);
  }

  /**
   * Unregister an adapter factory.
   */
  unregisterFactory(platform: string): void {
    this.factories.delete(platform);
  }

  /**
   * Get all registered platform names.
   */
  getRegisteredPlatforms(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Create and start an adapter instance.
   */
  async createAdapter(config: ChannelConfig): Promise<ChannelAdapter> {
    const factory = this.factories.get(config.platform);
    if (!factory) {
      throw new Error(
        `No factory registered for platform '${config.platform}'. ` +
        `Available: ${this.getRegisteredPlatforms().join(', ')}`
      );
    }

    if (this.adapters.has(config.id)) {
      throw new Error(`Adapter with ID '${config.id}' already exists`);
    }

    const adapter = factory();

    // Wire up global event handlers
    adapter.on((event) => {
      for (const handler of this.globalHandlers) {
        try {
          handler(event);
        } catch (err) {
          console.error('[ChannelRegistry] Global handler error:', err);
        }
      }
    });

    if (config.enabled) {
      await adapter.start(config);
    }

    this.adapters.set(config.id, adapter);
    return adapter;
  }

  /**
   * Get an adapter by ID.
   */
  getAdapter(id: string): ChannelAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get all active adapter instances.
   */
  getAllAdapters(): Map<string, ChannelAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Stop and remove an adapter.
   */
  async removeAdapter(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (adapter) {
      await adapter.stop();
      this.adapters.delete(id);
    }
  }

  /**
   * Hot-reload an adapter with new configuration.
   * Stops the old instance and starts a new one.
   */
  async reloadAdapter(config: ChannelConfig): Promise<ChannelAdapter> {
    await this.removeAdapter(config.id);
    return this.createAdapter(config);
  }

  /**
   * Register a global event handler for all adapters.
   */
  onGlobal(handler: ChannelEventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Health check all adapters.
   */
  async healthCheckAll(): Promise<
    Map<string, { status: HealthStatus; details?: string; platform: string }>
  > {
    const results = new Map<
      string,
      { status: HealthStatus; details?: string; platform: string }
    >();

    for (const [id, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        results.set(id, { ...health, platform: adapter.platform });
      } catch (error) {
        results.set(id, {
          status: 'unhealthy',
          details: error instanceof Error ? error.message : String(error),
          platform: adapter.platform,
        });
      }
    }

    return results;
  }

  /**
   * Shutdown all adapters.
   */
  async shutdown(): Promise<void> {
    const stopPromises = Array.from(this.adapters.keys()).map((id) =>
      this.removeAdapter(id)
    );
    await Promise.allSettled(stopPromises);
  }
}

// =====================================================
// Message Normalizer
// =====================================================

/**
 * Normalizes platform-specific messages to the internal format.
 *
 * Each adapter should use this to convert raw platform data
 * into `InboundMessage` objects.
 */
export class MessageNormalizer {
  /**
   * Create an InboundMessage from raw platform data.
   */
  static normalize(params: {
    platformMessageId: string;
    channelId: string;
    platform: string;
    chatId: string;
    chatType: ChatType;
    senderId: string;
    senderName?: string;
    senderUsername?: string;
    senderAvatar?: string;
    text?: string;
    media?: MediaAttachment[];
    replyToId?: string;
    replyToText?: string;
    threadId?: string;
    rawData?: Record<string, unknown>;
    timestamp?: Date;
    isEdit?: boolean;
  }): InboundMessage {
    return {
      platformMessageId: params.platformMessageId,
      channelId: params.channelId,
      platform: params.platform,
      chatId: params.chatId,
      chatType: params.chatType,
      sender: {
        platformUserId: params.senderId,
        displayName: params.senderName,
        username: params.senderUsername,
        avatarUrl: params.senderAvatar,
      },
      text: params.text,
      media: params.media,
      replyTo: params.replyToId
        ? {
            platformMessageId: params.replyToId,
            text: params.replyToText,
          }
        : undefined,
      threadId: params.threadId,
      rawData: params.rawData,
      timestamp: params.timestamp ?? new Date(),
      isEdit: params.isEdit,
    };
  }

  /**
   * Truncate text to fit platform limits.
   */
  static truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Convert markdown to platform-specific formatting.
   * Override per-platform for custom formatting rules.
   */
  static markdownToPlainText(markdown: string): string {
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Code
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .replace(/^#+\s/gm, '') // Headers
      .replace(/^[-*]\s/gm, '• '); // Lists
  }
}

// =====================================================
// Zod Schemas for Validation
// =====================================================

/**
 * Zod schema for channel configuration.
 */
export const channelConfigSchema = z.object({
  id: z.string(),
  platform: z.string(),
  orgId: z.string(),
  agentId: z.string(),
  enabled: z.boolean(),
  credentials: z.record(z.string()),
  settings: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().optional(),
  autoReconnect: z.boolean().optional(),
  reconnectIntervalMs: z.number().positive().optional(),
  maxReconnectAttempts: z.number().int().positive().optional(),
});

/**
 * Zod schema for outbound messages.
 */
export const outboundMessageSchema = z.object({
  chatId: z.string(),
  text: z.string().optional(),
  replyToMessageId: z.string().optional(),
  threadId: z.string().optional(),
  markdown: z.boolean().optional(),
  showTyping: z.boolean().optional(),
  typingDurationMs: z.number().optional(),
  platformOptions: z.record(z.unknown()).optional(),
});
