/**
 * WhatsApp Channel Adapter for AgentForge.
 *
 * Implements the ChannelAdapter interface for the WhatsApp Cloud API
 * (Meta Business Platform), supporting webhook-based message reception.
 *
 * Features:
 * - Text messages, images, documents, audio, video, stickers, location
 * - Interactive buttons and list messages
 * - Typing indicators (mark as read)
 * - Webhook verification (GET) and message reception (POST)
 * - Rate limiting per WhatsApp API limits
 * - Media download via WhatsApp Cloud API
 *
 * @packageDocumentation
 */

import {
  ChannelAdapter,
  MessageNormalizer,
  type ChannelConfig,
  type ChannelCapabilities,
  type HealthStatus,
  type OutboundMessage,
  type SendResult,
  type MediaAttachment,
  type ChatType,
  type CallbackAction,
  type InboundMessage,
} from '../channel-adapter.js';

// =====================================================
// WhatsApp-specific Types
// =====================================================

/**
 * A single row inside a WhatsApp list message section.
 */
export interface WhatsAppListRow {
  /** Row ID returned in callback */
  id: string;
  /** Row display title (max 24 chars) */
  title: string;
  /** Optional description (max 72 chars) */
  description?: string;
}

/**
 * A section inside a WhatsApp list message.
 */
export interface WhatsAppListSection {
  /** Section title (max 24 chars) */
  title?: string;
  /** Rows within this section (max 10 per section, 10 total) */
  rows: WhatsAppListRow[];
}

/**
 * Parameters for sending a WhatsApp list message.
 */
export interface WhatsAppListMessageParams {
  /** Target phone number */
  to: string;
  /** Main body text */
  bodyText: string;
  /** Button label that opens the list (max 20 chars) */
  buttonText: string;
  /** List sections */
  sections: WhatsAppListSection[];
  /** Optional header text */
  headerText?: string;
  /** Optional footer text */
  footerText?: string;
  /** Message to reply to */
  replyToMessageId?: string;
}

/**
 * A single component parameter for a WhatsApp template message.
 */
export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

/**
 * A component block in a WhatsApp template message.
 */
export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters: WhatsAppTemplateParameter[];
}

/**
 * Parameters for sending a WhatsApp template message.
 */
export interface WhatsAppTemplateMessageParams {
  /** Target phone number */
  to: string;
  /** Template name (as registered in Meta Business Manager) */
  templateName: string;
  /** Language code (e.g. 'en_US') */
  languageCode: string;
  /** Optional template components with variable substitutions */
  components?: WhatsAppTemplateComponent[];
  /** Message to reply to */
  replyToMessageId?: string;
}

// =====================================================
// WhatsApp Cloud API Types
// =====================================================

/**
 * WhatsApp Cloud API webhook payload.
 */
export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

export interface WhatsAppChangeValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: { body: string };
  image?: WhatsAppMediaObject;
  audio?: WhatsAppMediaObject;
  video?: WhatsAppMediaObject;
  document?: WhatsAppDocumentObject;
  sticker?: WhatsAppMediaObject;
  location?: WhatsAppLocationObject;
  interactive?: WhatsAppInteractiveResponse;
  button?: { text: string; payload: string };
  context?: {
    from: string;
    id: string;
  };
  errors?: Array<{ code: number; title: string; message: string }>;
}

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'reaction'
  | 'order'
  | 'system'
  | 'unknown';

export interface WhatsAppMediaObject {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppDocumentObject extends WhatsAppMediaObject {
  filename?: string;
}

export interface WhatsAppLocationObject {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppInteractiveResponse {
  type: 'button_reply' | 'list_reply';
  button_reply?: { id: string; title: string };
  list_reply?: { id: string; title: string; description?: string };
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message: string }>;
}

/**
 * WhatsApp adapter configuration.
 */
export interface WhatsAppAdapterConfig {
  /** WhatsApp Cloud API access token */
  accessToken: string;
  /** WhatsApp Business Phone Number ID */
  phoneNumberId: string;
  /** Webhook verify token for GET verification */
  verifyToken: string;
  /** WhatsApp Business Account ID (optional) */
  businessAccountId?: string;
  /** API version (default: v21.0) */
  apiVersion?: string;
  /** Rate limit: max messages per second (default: 80) */
  rateLimitPerSecond?: number;
  /** Webhook port for built-in HTTP server (default: 3001) */
  webhookPort?: number;
  /** Webhook path (default: /webhook/whatsapp) */
  webhookPath?: string;
}

// =====================================================
// WhatsApp Adapter
// =====================================================

/**
 * WhatsApp Cloud API channel adapter.
 *
 * @example
 * ```typescript
 * import { ChannelRegistry } from '@agentforge-ai/core';
 * import { WhatsAppAdapter } from '@agentforge-ai/core/adapters/whatsapp';
 *
 * const registry = new ChannelRegistry();
 * registry.registerFactory('whatsapp', () => new WhatsAppAdapter());
 *
 * const adapter = await registry.createAdapter({
 *   id: 'my-whatsapp-bot',
 *   platform: 'whatsapp',
 *   orgId: 'org-1',
 *   agentId: 'agent-1',
 *   enabled: true,
 *   credentials: {
 *     accessToken: 'WHATSAPP_ACCESS_TOKEN',
 *     phoneNumberId: 'PHONE_NUMBER_ID',
 *     verifyToken: 'VERIFY_TOKEN',
 *   },
 * });
 * ```
 */
export class WhatsAppAdapter extends ChannelAdapter {
  readonly platform = 'whatsapp';

  private accessToken: string = '';
  private phoneNumberId: string = '';
  private verifyToken: string = '';
  private apiVersion: string = 'v21.0';
  private adapterConfig: WhatsAppAdapterConfig | null = null;

  // Rate limiting
  private messageTimestamps: number[] = [];
  private rateLimitPerSecond: number = 80;

  // Track last inbound message ID per chat for typing indicator (mark-as-read)
  private lastInboundMessageId: Map<string, string> = new Map();

  // Built-in webhook server
  private httpServer: import('node:http').Server | null = null;

  // Base URL for WhatsApp Cloud API
  private get apiBase(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  // ----- Lifecycle -----

  async connect(config: ChannelConfig): Promise<void> {
    this.accessToken = config.credentials.accessToken;
    this.phoneNumberId = config.credentials.phoneNumberId;
    this.verifyToken = config.credentials.verifyToken;

    if (!this.accessToken) {
      throw new Error('WhatsApp access token is required in credentials.accessToken');
    }
    if (!this.phoneNumberId) {
      throw new Error('WhatsApp phone number ID is required in credentials.phoneNumberId');
    }
    if (!this.verifyToken) {
      throw new Error('WhatsApp verify token is required in credentials.verifyToken');
    }

    this.adapterConfig = {
      accessToken: this.accessToken,
      phoneNumberId: this.phoneNumberId,
      verifyToken: this.verifyToken,
      businessAccountId: config.settings?.businessAccountId as string,
      apiVersion: (config.settings?.apiVersion as string) ?? 'v21.0',
      rateLimitPerSecond: (config.settings?.rateLimitPerSecond as number) ?? 80,
      webhookPort: (config.settings?.webhookPort as number) ?? 3001,
      webhookPath: (config.settings?.webhookPath as string) ?? '/webhook/whatsapp',
    };

    this.apiVersion = this.adapterConfig.apiVersion!;
    this.rateLimitPerSecond = this.adapterConfig.rateLimitPerSecond!;

    // Verify the access token by checking the phone number
    await this.verifyConnection();

    // Start the built-in webhook server if a port is configured
    if (this.adapterConfig.webhookPort) {
      await this.startWebhookServer(
        this.adapterConfig.webhookPort,
        this.adapterConfig.webhookPath!
      );
    }
  }

  async disconnect(): Promise<void> {
    await this.stopWebhookServer();
    this.accessToken = '';
    this.phoneNumberId = '';
    this.verifyToken = '';
    this.adapterConfig = null;
  }

  // ----- Message Sending -----

  async sendMessage(message: OutboundMessage): Promise<SendResult> {
    try {
      // Rate limiting
      await this.enforceRateLimit();

      // Mark previous messages as read (typing indicator equivalent)
      if (message.showTyping && message.replyToMessageId) {
        await this.markAsRead(message.replyToMessageId);
      }

      // Send media if present
      if (message.media && message.media.length > 0) {
        return await this.sendMediaMessage(message);
      }

      // Send interactive message if actions present
      if (message.actions && message.actions.length > 0) {
        return await this.sendInteractiveMessage(message);
      }

      // Send text message
      if (message.text) {
        const body: Record<string, unknown> = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: message.chatId,
          type: 'text',
          text: {
            preview_url: true,
            body: message.text,
          },
        };

        // Add context (reply) if specified
        if (message.replyToMessageId) {
          body.context = { message_id: message.replyToMessageId };
        }

        const result = await this.callApi<{ messages: Array<{ id: string }> }>(
          `${this.phoneNumberId}/messages`,
          'POST',
          body
        );

        return {
          success: true,
          platformMessageId: result.messages?.[0]?.id,
          deliveredAt: new Date(),
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
      supportedMedia: ['image', 'audio', 'video', 'file', 'sticker', 'location'],
      maxTextLength: 4096,
      supportsThreads: false,
      supportsReactions: true,
      supportsEditing: false,
      supportsDeleting: false,
      supportsTypingIndicator: true,
      supportsReadReceipts: true,
      supportsActions: true,
      supportsGroupChat: true,
      supportsMarkdown: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      platformSpecific: {
        supportsInteractiveButtons: true,
        supportsListMessages: true,
        supportsTemplateMessages: true,
        supportsLocationMessages: true,
        supportsContactMessages: true,
        maxInteractiveButtons: 3,
        maxListSections: 10,
        maxListRows: 10,
      },
    };
  }

  // ----- Health Check -----

  async healthCheck(): Promise<{ status: HealthStatus; details?: string }> {
    try {
      const result = await this.callApi<{
        verified_name?: string;
        display_phone_number?: string;
        id?: string;
      }>(
        `${this.phoneNumberId}`,
        'GET'
      );

      if (result && result.id) {
        return {
          status: 'healthy',
          details: `WhatsApp Business: ${result.verified_name || result.display_phone_number || result.id}`,
        };
      }
      return { status: 'degraded', details: 'Phone number check returned unexpected result' };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ----- Optional Overrides -----

  /**
   * WhatsApp has no native typing indicator, but we track the latest inbound
   * message ID per chat so we can issue a mark-as-read when this is called,
   * which surfaces as blue double-ticks to the user — the closest equivalent.
   */
  override async sendTypingIndicator(chatId: string): Promise<void> {
    const lastMsgId = this.lastInboundMessageId.get(chatId);
    if (lastMsgId) {
      await this.markAsRead(lastMsgId);
    }
  }

  override async addReaction(
    platformMessageId: string,
    chatId: string,
    emoji: string
  ): Promise<boolean> {
    try {
      await this.callApi(
        `${this.phoneNumberId}/messages`,
        'POST',
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: chatId,
          type: 'reaction',
          reaction: {
            message_id: platformMessageId,
            emoji,
          },
        }
      );
      return true;
    } catch {
      return false;
    }
  }

  // ----- Webhook Handling -----

  /**
   * Verify a webhook GET request from Meta.
   * Uses constant-time comparison via Web Crypto API to prevent timing attacks.
   * Returns the challenge string if verification succeeds, null otherwise.
   */
  async verifyWebhook(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined
  ): Promise<string | null> {
    if (mode !== 'subscribe' || !token || !challenge) {
      return null;
    }

    const isValid = await timingSafeEqual(token, this.verifyToken);
    if (isValid) {
      return challenge;
    }
    return null;
  }

  /**
   * Handle an incoming webhook POST payload.
   * Call this from your webhook endpoint.
   */
  handleWebhookPayload(payload: WhatsAppWebhookPayload): void {
    if (payload.object !== 'whatsapp_business_account') return;

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const contacts = value.contacts || [];
        const messages = value.messages || [];

        for (const message of messages) {
          const contact = contacts.find((c) => c.wa_id === message.from);
          this.processInboundMessage(message, contact, value.metadata);
        }

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            this.processStatusUpdate(status);
          }
        }
      }
    }
  }

  /**
   * Get a media download URL from WhatsApp Cloud API.
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const result = await this.callApi<{ url: string }>(mediaId, 'GET');
    return result.url;
  }

  /**
   * Download media content from WhatsApp.
   */
  async downloadMedia(mediaUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }

    return response.arrayBuffer();
  }

  // ----- Internal: Message Processing -----

  private processInboundMessage(
    message: WhatsAppMessage,
    contact: WhatsAppContact | undefined,
    metadata: { display_phone_number: string; phone_number_id: string }
  ): void {
    // Track the latest message ID per chat for typing indicator support
    this.lastInboundMessageId.set(message.from, message.id);

    // Handle interactive responses (button/list replies) as callbacks
    if (message.type === 'interactive' && message.interactive) {
      this.processInteractiveResponse(message, contact, metadata);
      return;
    }

    if (message.type === 'button' && message.button) {
      this.processButtonResponse(message, contact, metadata);
      return;
    }

    // Normalize the message
    const normalized = this.normalizeMessage(message, contact, metadata);
    this.emitMessage(normalized);
  }

  private processInteractiveResponse(
    message: WhatsAppMessage,
    contact: WhatsAppContact | undefined,
    metadata: { display_phone_number: string; phone_number_id: string }
  ): void {
    const interactive = message.interactive!;
    let actionId = '';
    let value: string | undefined;

    if (interactive.type === 'button_reply' && interactive.button_reply) {
      actionId = interactive.button_reply.id;
      value = interactive.button_reply.title;
    } else if (interactive.type === 'list_reply' && interactive.list_reply) {
      actionId = interactive.list_reply.id;
      value = interactive.list_reply.title;
    }

    const action: CallbackAction = {
      actionId,
      value,
      sender: {
        platformUserId: message.from,
        displayName: contact?.profile?.name,
      },
      chatId: message.from,
      messageId: message.id,
      platform: 'whatsapp',
      channelId: this.config?.id || '',
      timestamp: new Date(parseInt(message.timestamp) * 1000),
    };

    this.emitCallback(action);
  }

  private processButtonResponse(
    message: WhatsAppMessage,
    contact: WhatsAppContact | undefined,
    _metadata: { display_phone_number: string; phone_number_id: string }
  ): void {
    const action: CallbackAction = {
      actionId: message.button!.payload,
      value: message.button!.text,
      sender: {
        platformUserId: message.from,
        displayName: contact?.profile?.name,
      },
      chatId: message.from,
      messageId: message.id,
      platform: 'whatsapp',
      channelId: this.config?.id || '',
      timestamp: new Date(parseInt(message.timestamp) * 1000),
    };

    this.emitCallback(action);
  }

  private processStatusUpdate(status: WhatsAppStatus): void {
    // Emit status events for tracking delivery/read receipts
    if (status.status === 'failed' && status.errors) {
      this.emit({
        type: 'error',
        data: {
          error: new Error(
            `Message ${status.id} failed: ${status.errors.map((e) => e.title).join(', ')}`
          ),
          recoverable: true,
        },
      });
    }
  }

  private normalizeMessage(
    message: WhatsAppMessage,
    contact: WhatsAppContact | undefined,
    metadata: { display_phone_number: string; phone_number_id: string }
  ): InboundMessage {
    const media = this.extractMedia(message);
    const text = this.extractText(message);

    return MessageNormalizer.normalize({
      platformMessageId: message.id,
      channelId: this.config?.id || '',
      platform: 'whatsapp',
      chatId: message.from,
      chatType: 'dm' as ChatType, // WhatsApp messages are always DM-style
      senderId: message.from,
      senderName: contact?.profile?.name,
      text,
      media,
      replyToId: message.context?.id,
      rawData: {
        message,
        contact,
        metadata,
      } as unknown as Record<string, unknown>,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
    });
  }

  private extractText(message: WhatsAppMessage): string | undefined {
    switch (message.type) {
      case 'text':
        return message.text?.body;
      case 'image':
        return message.image?.caption;
      case 'video':
        return message.video?.caption;
      case 'document':
        return message.document?.caption;
      case 'location':
        return message.location
          ? `📍 ${message.location.name || ''} ${message.location.address || ''} (${message.location.latitude}, ${message.location.longitude})`.trim()
          : undefined;
      default:
        return undefined;
    }
  }

  private extractMedia(message: WhatsAppMessage): MediaAttachment[] | undefined {
    const media: MediaAttachment[] = [];

    if (message.image) {
      media.push({
        type: 'image',
        url: `whatsapp:media:${message.image.id}`,
        mimeType: message.image.mime_type,
        caption: message.image.caption,
      });
    }

    if (message.audio) {
      media.push({
        type: 'audio',
        url: `whatsapp:media:${message.audio.id}`,
        mimeType: message.audio.mime_type,
      });
    }

    if (message.video) {
      media.push({
        type: 'video',
        url: `whatsapp:media:${message.video.id}`,
        mimeType: message.video.mime_type,
        caption: message.video.caption,
      });
    }

    if (message.document) {
      media.push({
        type: 'file',
        url: `whatsapp:media:${message.document.id}`,
        mimeType: message.document.mime_type,
        fileName: message.document.filename,
        caption: message.document.caption,
      });
    }

    if (message.sticker) {
      media.push({
        type: 'sticker',
        url: `whatsapp:media:${message.sticker.id}`,
        mimeType: message.sticker.mime_type,
      });
    }

    if (message.location) {
      media.push({
        type: 'location',
        url: `geo:${message.location.latitude},${message.location.longitude}`,
      });
    }

    return media.length > 0 ? media : undefined;
  }

  // ----- Internal: Media Sending -----

  private async sendMediaMessage(message: OutboundMessage): Promise<SendResult> {
    const media = message.media![0];
    let body: Record<string, unknown>;

    const baseBody: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.chatId,
    };

    if (message.replyToMessageId) {
      baseBody.context = { message_id: message.replyToMessageId };
    }

    switch (media.type) {
      case 'image':
        body = {
          ...baseBody,
          type: 'image',
          image: {
            link: media.url,
            caption: message.text || media.caption,
          },
        };
        break;
      case 'audio':
        body = {
          ...baseBody,
          type: 'audio',
          audio: { link: media.url },
        };
        break;
      case 'video':
        body = {
          ...baseBody,
          type: 'video',
          video: {
            link: media.url,
            caption: message.text || media.caption,
          },
        };
        break;
      case 'sticker':
        body = {
          ...baseBody,
          type: 'sticker',
          sticker: { link: media.url },
        };
        break;
      case 'location':
        // Parse geo: URL
        const geoMatch = media.url.match(/geo:([-\d.]+),([-\d.]+)/);
        if (geoMatch) {
          body = {
            ...baseBody,
            type: 'location',
            location: {
              latitude: parseFloat(geoMatch[1]),
              longitude: parseFloat(geoMatch[2]),
            },
          };
        } else {
          return { success: false, error: 'Invalid location URL format' };
        }
        break;
      default:
        // Send as document
        body = {
          ...baseBody,
          type: 'document',
          document: {
            link: media.url,
            caption: message.text || media.caption,
            filename: media.fileName,
          },
        };
    }

    const result = await this.callApi<{ messages: Array<{ id: string }> }>(
      `${this.phoneNumberId}/messages`,
      'POST',
      body
    );

    return {
      success: true,
      platformMessageId: result.messages?.[0]?.id,
      deliveredAt: new Date(),
    };
  }

  // ----- Internal: Interactive Messages -----

  private async sendInteractiveMessage(message: OutboundMessage): Promise<SendResult> {
    const actions = message.actions!;

    // WhatsApp supports up to 3 buttons in an interactive message
    const buttons = actions
      .filter((a) => a.type === 'button')
      .slice(0, 3)
      .map((a) => ({
        type: 'reply' as const,
        reply: { id: a.actionId, title: a.label.substring(0, 20) },
      }));

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.chatId,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: message.text || 'Please choose an option:' },
        action: { buttons },
      },
    };

    if (message.replyToMessageId) {
      body.context = { message_id: message.replyToMessageId };
    }

    const result = await this.callApi<{ messages: Array<{ id: string }> }>(
      `${this.phoneNumberId}/messages`,
      'POST',
      body
    );

    return {
      success: true,
      platformMessageId: result.messages?.[0]?.id,
      deliveredAt: new Date(),
    };
  }

  // ----- Internal: Mark as Read -----

  private async markAsRead(messageId: string): Promise<void> {
    try {
      await this.callApi(
        `${this.phoneNumberId}/messages`,
        'POST',
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }
      );
    } catch {
      // Non-critical, ignore
    }
  }

  // ----- Internal: Webhook Server -----

  private async startWebhookServer(port: number, path: string): Promise<void> {
    const http = await import('node:http');

    this.httpServer = http.createServer(async (req, res) => {
      // Only handle the webhook path
      const url = new URL(req.url || '/', `http://localhost:${port}`);
      if (url.pathname !== path) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      // GET — Webhook verification
      if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode') || undefined;
        const token = url.searchParams.get('hub.verify_token') || undefined;
        const challenge = url.searchParams.get('hub.challenge') || undefined;

        const result = this.verifyWebhook(mode, token, challenge);
        if (result) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(result);
        } else {
          res.writeHead(403);
          res.end('Forbidden');
        }
        return;
      }

      // POST — Incoming messages
      if (req.method === 'POST') {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body = JSON.parse(Buffer.concat(chunks).toString()) as WhatsAppWebhookPayload;
          this.handleWebhookPayload(body);
          res.writeHead(200);
          res.end('OK');
        } catch (error) {
          this.emit({
            type: 'error',
            data: {
              error: error instanceof Error ? error : new Error(String(error)),
              recoverable: true,
            },
          });
          res.writeHead(400);
          res.end('Bad Request');
        }
        return;
      }

      res.writeHead(405);
      res.end('Method Not Allowed');
    });

    return new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(port, () => {
        resolve();
      });
      this.httpServer!.on('error', reject);
    });
  }

  private async stopWebhookServer(): Promise<void> {
    if (this.httpServer) {
      return new Promise<void>((resolve) => {
        this.httpServer!.close(() => {
          this.httpServer = null;
          resolve();
        });
      });
    }
  }

  // ----- Internal: Connection Verification -----

  private async verifyConnection(): Promise<void> {
    const result = await this.callApi<{
      verified_name?: string;
      display_phone_number?: string;
      id?: string;
    }>(
      `${this.phoneNumberId}`,
      'GET'
    );

    if (!result || !result.id) {
      throw new Error(
        'Failed to verify WhatsApp connection. Check your access token and phone number ID.'
      );
    }
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

  // ----- Internal: API Calls -----

  /**
   * Call the WhatsApp Cloud API.
   */
  private async callApi<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.apiBase}/${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = (await response.json()) as T & {
      error?: { message: string; type: string; code: number; fbtrace_id: string };
    };

    if ((data as any).error) {
      throw new Error(
        `WhatsApp API error (${(data as any).error.code}): ${(data as any).error.message}`
      );
    }

    return data;
  }

  // ----- Public: List Messages -----

  /**
   * Send a WhatsApp interactive list message.
   * Lists can contain up to 10 sections with up to 10 rows each (10 rows total).
   */
  async sendListMessage(params: WhatsAppListMessageParams): Promise<SendResult> {
    try {
      await this.enforceRateLimit();

      const interactive: Record<string, unknown> = {
        type: 'list',
        body: { text: params.bodyText },
        action: {
          button: params.buttonText.substring(0, 20),
          sections: params.sections.map((s) => ({
            title: s.title,
            rows: s.rows.map((r) => ({
              id: r.id,
              title: r.title.substring(0, 24),
              description: r.description?.substring(0, 72),
            })),
          })),
        },
      };

      if (params.headerText) {
        interactive.header = { type: 'text', text: params.headerText };
      }

      if (params.footerText) {
        interactive.footer = { text: params.footerText };
      }

      const body: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'interactive',
        interactive,
      };

      if (params.replyToMessageId) {
        body.context = { message_id: params.replyToMessageId };
      }

      const result = await this.callApi<{ messages: Array<{ id: string }> }>(
        `${this.phoneNumberId}/messages`,
        'POST',
        body
      );

      return {
        success: true,
        platformMessageId: result.messages?.[0]?.id,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ----- Public: Template Messages -----

  /**
   * Send a WhatsApp template message.
   * Templates must be pre-approved in Meta Business Manager.
   */
  async sendTemplateMessage(params: WhatsAppTemplateMessageParams): Promise<SendResult> {
    try {
      await this.enforceRateLimit();

      const template: Record<string, unknown> = {
        name: params.templateName,
        language: { code: params.languageCode },
      };

      if (params.components && params.components.length > 0) {
        template.components = params.components;
      }

      const body: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: params.to,
        type: 'template',
        template,
      };

      if (params.replyToMessageId) {
        body.context = { message_id: params.replyToMessageId };
      }

      const result = await this.callApi<{ messages: Array<{ id: string }> }>(
        `${this.phoneNumberId}/messages`,
        'POST',
        body
      );

      return {
        success: true,
        platformMessageId: result.messages?.[0]?.id,
        deliveredAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ----- Public: Mark as Read -----

  /**
   * Mark a specific message as read.
   * This shows blue double-ticks to the sender.
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    await this.markAsRead(messageId);
  }

  // ----- Utility -----

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =====================================================
// Utility: Constant-Time String Comparison (Web Crypto)
// =====================================================

/**
 * Constant-time string comparison using the Web Crypto API.
 * Prevents timing attacks on webhook token verification.
 * Uses `crypto.subtle` — no `node:crypto` import needed.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // Import both as HMAC keys and sign a fixed message — comparing the signatures
  // ensures constant time regardless of early mismatch.
  // Alternatively, use subtle.digest for simpler approach:
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('webhook-verify'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, aBytes),
    crypto.subtle.sign('HMAC', key, bBytes),
  ]);

  // Compare the HMAC signatures byte-by-byte — both are same length (32 bytes)
  const viewA = new Uint8Array(sigA);
  const viewB = new Uint8Array(sigB);

  if (viewA.length !== viewB.length) return false;

  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= viewA[i] ^ viewB[i];
  }
  return diff === 0;
}
