/**
 * WhatsApp Channel for AgentForge.
 *
 * Bridges the WhatsAppAdapter with the AgentForge Convex chat pipeline.
 * This module:
 * - Starts a webhook server to receive WhatsApp messages
 * - Routes incoming messages through the agent execution pipeline
 * - Creates/reuses Convex threads per WhatsApp phone number
 * - Stores all messages in the Convex messages table
 * - Sends agent responses back to the WhatsApp user
 * - Supports text, images, documents, audio, and video
 *
 * @packageDocumentation
 */

import { WhatsAppAdapter } from '../adapters/whatsapp-adapter.js';
import type {
  ChannelConfig,
  InboundMessage,
  ChannelEvent,
} from '../channel-adapter.js';

// =====================================================
// Types
// =====================================================

/**
 * Configuration for the WhatsApp channel runner.
 */
export interface WhatsAppChannelConfig {
  /** WhatsApp Cloud API access token */
  accessToken: string;
  /** WhatsApp Business Phone Number ID */
  phoneNumberId: string;
  /** Webhook verify token for Meta verification */
  verifyToken: string;
  /** Agent ID to route messages to */
  agentId: string;
  /** Convex deployment URL */
  convexUrl: string;
  /** WhatsApp Business Account ID (optional) */
  businessAccountId?: string;
  /** API version (default: v21.0) */
  apiVersion?: string;
  /** Webhook port (default: 3001) */
  webhookPort?: number;
  /** Webhook path (default: /webhook/whatsapp) */
  webhookPath?: string;
  /** User ID for Convex operations (default: 'whatsapp') */
  userId?: string;
  /** Log level: 'debug' | 'info' | 'warn' | 'error' (default: 'info') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Thread mapping: WhatsApp phone → Convex threadId.
 * Persisted in memory for the lifetime of the bot process.
 */
type ThreadMap = Map<string, string>;

/**
 * Logger interface for the channel runner.
 */
interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

// =====================================================
// Logger
// =====================================================

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function createLogger(level: string = 'info'): Logger {
  const threshold = LOG_LEVELS[level] ?? 1;
  const prefix = '[agentforge:whatsapp]';

  return {
    debug: (...args: unknown[]) => {
      if (threshold <= 0) console.log(`${prefix} [DEBUG]`, ...args);
    },
    info: (...args: unknown[]) => {
      if (threshold <= 1) console.log(`${prefix}`, ...args);
    },
    warn: (...args: unknown[]) => {
      if (threshold <= 2) console.warn(`${prefix} [WARN]`, ...args);
    },
    error: (...args: unknown[]) => {
      if (threshold <= 3) console.error(`${prefix} [ERROR]`, ...args);
    },
  };
}

// =====================================================
// Convex HTTP Client Wrapper
// =====================================================

/**
 * Minimal Convex HTTP client for calling queries, mutations, and actions.
 * Uses the Convex HTTP API directly to avoid requiring the full Convex client
 * as a dependency in the core package.
 */
class ConvexHttpApi {
  private baseUrl: string;

  constructor(deploymentUrl: string) {
    this.baseUrl = deploymentUrl.replace(/\/$/, '');
  }

  async query(functionPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${this.baseUrl}/api/query`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex query ${functionPath} failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      value?: unknown;
      status?: string;
      errorMessage?: string;
    };
    if (data.status === 'error') {
      throw new Error(`Convex query ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }

  async mutation(functionPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${this.baseUrl}/api/mutation`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex mutation ${functionPath} failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      value?: unknown;
      status?: string;
      errorMessage?: string;
    };
    if (data.status === 'error') {
      throw new Error(`Convex mutation ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }

  async action(functionPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const url = `${this.baseUrl}/api/action`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex action ${functionPath} failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as {
      value?: unknown;
      status?: string;
      errorMessage?: string;
    };
    if (data.status === 'error') {
      throw new Error(`Convex action ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }
}

// =====================================================
// WhatsApp Channel Runner
// =====================================================

/**
 * Runs a WhatsApp webhook server that routes messages through the
 * AgentForge Convex chat pipeline.
 *
 * @example
 * ```typescript
 * import { WhatsAppChannel } from '@agentforge-ai/core/channels/whatsapp';
 *
 * const channel = new WhatsAppChannel({
 *   accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
 *   phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
 *   verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
 *   agentId: 'my-agent',
 *   convexUrl: process.env.CONVEX_URL!,
 * });
 *
 * await channel.start();
 * ```
 */
export class WhatsAppChannel {
  private adapter: WhatsAppAdapter;
  private convex: ConvexHttpApi;
  private config: WhatsAppChannelConfig;
  private threadMap: ThreadMap = new Map();
  private logger: Logger;
  private processingMessages: Set<string> = new Set();
  private isRunning: boolean = false;

  constructor(config: WhatsAppChannelConfig) {
    this.config = config;
    this.adapter = new WhatsAppAdapter();
    this.convex = new ConvexHttpApi(config.convexUrl);
    this.logger = createLogger(config.logLevel);
  }

  /**
   * Start the WhatsApp channel webhook server.
   * Connects to WhatsApp Cloud API and begins listening for messages.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('WhatsApp channel is already running');
      return;
    }

    this.logger.info('Starting WhatsApp channel...');
    this.logger.info(`Agent ID: ${this.config.agentId}`);
    this.logger.info(`Convex URL: ${this.config.convexUrl}`);
    this.logger.info(`Phone Number ID: ${this.config.phoneNumberId}`);

    // Verify the agent exists in Convex
    try {
      const agent = await this.convex.query('agents:get', { id: this.config.agentId });
      if (!agent) {
        throw new Error(
          `Agent "${this.config.agentId}" not found in Convex. ` +
            `Create it first with: agentforge agents create`
        );
      }
      const agentData = agent as { name: string; model: string; provider: string };
      this.logger.info(
        `Agent: ${agentData.name} (${agentData.model} via ${agentData.provider})`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      this.logger.warn('Could not verify agent (Convex may be unreachable). Continuing...');
    }

    // Wire up message handler
    this.adapter.on(this.handleEvent.bind(this));

    // Build the ChannelConfig for the adapter
    const channelConfig: ChannelConfig = {
      id: `whatsapp-${this.config.agentId}`,
      platform: 'whatsapp',
      orgId: 'default',
      agentId: this.config.agentId,
      enabled: true,
      credentials: {
        accessToken: this.config.accessToken,
        phoneNumberId: this.config.phoneNumberId,
        verifyToken: this.config.verifyToken,
      },
      settings: {
        businessAccountId: this.config.businessAccountId,
        apiVersion: this.config.apiVersion ?? 'v21.0',
        webhookPort: this.config.webhookPort ?? 3001,
        webhookPath: this.config.webhookPath ?? '/webhook/whatsapp',
      },
      autoReconnect: true,
      reconnectIntervalMs: 5000,
      maxReconnectAttempts: 20,
    };

    // Start the adapter
    await this.adapter.start(channelConfig);
    this.isRunning = true;

    const port = this.config.webhookPort ?? 3001;
    const path = this.config.webhookPath ?? '/webhook/whatsapp';

    this.logger.info('WhatsApp channel started successfully!');
    this.logger.info(`Webhook server listening on port ${port}`);
    this.logger.info(`Webhook URL: http://localhost:${port}${path}`);
    this.logger.info('Configure this URL in your Meta App Dashboard.');
    this.logger.info('Press Ctrl+C to stop.');
  }

  /**
   * Stop the WhatsApp channel.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping WhatsApp channel...');
    await this.adapter.stop();
    this.isRunning = false;
    this.threadMap.clear();
    this.processingMessages.clear();
    this.logger.info('WhatsApp channel stopped.');
  }

  /**
   * Get the current thread map (for debugging).
   */
  getThreadMap(): ReadonlyMap<string, string> {
    return this.threadMap;
  }

  /**
   * Get the underlying WhatsAppAdapter instance.
   */
  getAdapter(): WhatsAppAdapter {
    return this.adapter;
  }

  /**
   * Check if the channel is running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  // ----- Internal: Event Handling -----

  private async handleEvent(event: ChannelEvent): Promise<void> {
    switch (event.type) {
      case 'message':
        await this.handleInboundMessage(event.data as InboundMessage);
        break;

      case 'callback':
        this.logger.debug('Callback action received:', event.data);
        break;

      case 'connection_state':
        this.logger.debug(
          'Connection state:',
          (event.data as { state: string }).state
        );
        break;

      case 'error':
        this.logger.error(
          'Adapter error:',
          (event.data as { error: Error }).error.message
        );
        break;

      default:
        this.logger.debug('Unhandled event type:', event.type);
    }
  }

  private async handleInboundMessage(message: InboundMessage): Promise<void> {
    // Skip empty messages (no text and no media)
    if (!message.text?.trim() && (!message.media || message.media.length === 0)) {
      this.logger.debug('Skipping empty message');
      return;
    }

    // Dedup: prevent processing the same message twice
    const dedupKey = `${message.chatId}:${message.platformMessageId}`;
    if (this.processingMessages.has(dedupKey)) {
      this.logger.debug('Skipping duplicate message:', dedupKey);
      return;
    }
    this.processingMessages.add(dedupKey);

    const senderName = message.sender.displayName || message.sender.username || message.chatId;
    this.logger.info(
      `Message from ${senderName} (+${message.chatId}): ${message.text || '[media]'}`
    );

    try {
      // Route through the agent execution pipeline
      await this.routeToAgent(message);
    } catch (error) {
      this.logger.error('Error handling message:', error);
      try {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: '⚠️ Sorry, I encountered an error processing your message. Please try again.',
        });
      } catch {
        this.logger.error('Failed to send error message to user');
      }
    } finally {
      // Clean up dedup key after a delay
      setTimeout(() => {
        this.processingMessages.delete(dedupKey);
      }, 30000);
    }
  }

  // ----- Internal: Agent Routing -----

  /**
   * Route a message through the AgentForge chat pipeline:
   * 1. Get or create a Convex thread for this WhatsApp phone number
   * 2. Call chat.sendMessage action (stores user msg, calls LLM, stores response)
   * 3. Send the agent response back to WhatsApp
   */
  private async routeToAgent(message: InboundMessage): Promise<void> {
    // Mark message as read (WhatsApp's equivalent of typing indicator)
    try {
      await this.adapter.addReaction(message.platformMessageId, message.chatId, '👀');
    } catch (error) {
      console.debug('[WhatsAppChannel.routeToAgent] Failed to add read reaction:', error instanceof Error ? error.message : error);
    }

    // Get or create thread for this chat
    const threadId = await this.getOrCreateThread(
      message.chatId,
      message.sender.displayName
    );

    // Build the content to send to the agent
    let content = message.text || '';
    if (message.media && message.media.length > 0) {
      const mediaDescriptions = message.media.map((m) => {
        const parts = [`[${m.type}`];
        if (m.fileName) parts.push(`: ${m.fileName}`);
        if (m.mimeType) parts.push(` (${m.mimeType})`);
        parts.push(']');
        if (m.caption) parts.push(` ${m.caption}`);
        return parts.join('');
      });
      if (content) {
        content += '\n' + mediaDescriptions.join('\n');
      } else {
        content = mediaDescriptions.join('\n');
      }
    }

    const userId = this.config.userId || `whatsapp:${message.sender.platformUserId}`;

    this.logger.debug(`Sending to agent ${this.config.agentId}, thread ${threadId}`);

    const result = (await this.convex.action('chat:sendMessage', {
      agentId: this.config.agentId,
      threadId,
      content,
      userId,
    })) as { success: boolean; response: string; usage?: { totalTokens: number } };

    if (result?.response) {
      // Split long messages for WhatsApp's 4096 char limit
      const chunks = this.splitMessage(result.response, 4096);
      for (const chunk of chunks) {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: chunk,
          replyToMessageId:
            chunks.length === 1 ? message.platformMessageId : undefined,
        });
      }

      if (result.usage) {
        this.logger.debug(`Tokens used: ${result.usage.totalTokens}`);
      }
    } else {
      await this.adapter.sendMessage({
        chatId: message.chatId,
        text: "🤔 I received your message but couldn't generate a response. Please try again.",
      });
    }
  }

  // ----- Internal: Thread Management -----

  /**
   * Get or create a Convex thread for a WhatsApp phone number.
   * Threads are cached in memory and created lazily.
   */
  private async getOrCreateThread(
    phoneNumber: string,
    senderName?: string
  ): Promise<string> {
    // Check in-memory cache first
    const cached = this.threadMap.get(phoneNumber);
    if (cached) return cached;

    // Create a new thread in Convex
    const threadName = senderName
      ? `WhatsApp: ${senderName}`
      : `WhatsApp +${phoneNumber}`;

    const userId = this.config.userId || `whatsapp:${phoneNumber}`;

    const threadId = (await this.convex.mutation('chat:createThread', {
      agentId: this.config.agentId,
      name: threadName,
      userId,
    })) as string;

    this.threadMap.set(phoneNumber, threadId);
    this.logger.info(`Created new thread ${threadId} for +${phoneNumber}`);

    // Log the channel connection
    try {
      await this.convex.mutation('logs:add', {
        level: 'info',
        source: 'whatsapp',
        message: `New WhatsApp conversation started by ${senderName || phoneNumber}`,
        metadata: { phoneNumber, threadId, agentId: this.config.agentId },
        userId,
      });
    } catch (error) {
      console.debug('[WhatsAppChannel.getOrCreateThread] Failed to log conversation start:', error instanceof Error ? error.message : error);
    }

    return threadId;
  }

  // ----- Internal: Utilities -----

  /**
   * Split a long message into chunks that fit WhatsApp's character limit.
   */
  private splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a paragraph break
      let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
      if (splitIdx === -1 || splitIdx < maxLength / 2) {
        // Try to split at a line break
        splitIdx = remaining.lastIndexOf('\n', maxLength);
      }
      if (splitIdx === -1 || splitIdx < maxLength / 2) {
        // Try to split at a space
        splitIdx = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitIdx === -1 || splitIdx < maxLength / 2) {
        // Hard split
        splitIdx = maxLength;
      }

      chunks.push(remaining.substring(0, splitIdx));
      remaining = remaining.substring(splitIdx).trimStart();
    }

    return chunks;
  }
}

// =====================================================
// Convenience Factory
// =====================================================

/**
 * Create and start a WhatsApp channel from environment variables.
 *
 * Required env vars:
 * - WHATSAPP_ACCESS_TOKEN
 * - WHATSAPP_PHONE_NUMBER_ID
 * - WHATSAPP_VERIFY_TOKEN
 * - CONVEX_URL
 *
 * Optional env vars:
 * - AGENTFORGE_AGENT_ID (default: first active agent)
 * - WHATSAPP_BUSINESS_ACCOUNT_ID
 * - WHATSAPP_API_VERSION (default: v21.0)
 * - WHATSAPP_WEBHOOK_PORT (default: 3001)
 * - WHATSAPP_WEBHOOK_PATH (default: /webhook/whatsapp)
 *
 * @example
 * ```typescript
 * import { startWhatsAppChannel } from '@agentforge-ai/core/channels/whatsapp';
 *
 * await startWhatsAppChannel({
 *   agentId: 'my-agent',
 * });
 * ```
 */
export async function startWhatsAppChannel(
  overrides: Partial<WhatsAppChannelConfig> = {}
): Promise<WhatsAppChannel> {
  const accessToken = overrides.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = overrides.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = overrides.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
  const convexUrl = overrides.convexUrl || process.env.CONVEX_URL;
  const agentId = overrides.agentId || process.env.AGENTFORGE_AGENT_ID;

  if (!accessToken) {
    throw new Error(
      'WHATSAPP_ACCESS_TOKEN is required. ' +
        'Set it in your .env file or pass it as accessToken in the config.'
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      'WHATSAPP_PHONE_NUMBER_ID is required. ' +
        'Set it in your .env file or pass it as phoneNumberId in the config.'
    );
  }

  if (!verifyToken) {
    throw new Error(
      'WHATSAPP_VERIFY_TOKEN is required. ' +
        'Set it in your .env file or pass it as verifyToken in the config.'
    );
  }

  if (!convexUrl) {
    throw new Error(
      'CONVEX_URL is required. ' +
        'Set it in your .env file or pass it as convexUrl in the config.'
    );
  }

  if (!agentId) {
    throw new Error(
      'Agent ID is required. ' +
        'Pass it as agentId in the config or set AGENTFORGE_AGENT_ID env var.'
    );
  }

  const channel = new WhatsAppChannel({
    accessToken,
    phoneNumberId,
    verifyToken,
    convexUrl,
    agentId,
    businessAccountId:
      overrides.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    apiVersion: overrides.apiVersion || process.env.WHATSAPP_API_VERSION,
    webhookPort: overrides.webhookPort || parseInt(process.env.WHATSAPP_WEBHOOK_PORT || '3001'),
    webhookPath: overrides.webhookPath || process.env.WHATSAPP_WEBHOOK_PATH,
    userId: overrides.userId,
    logLevel: overrides.logLevel,
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down WhatsApp channel...');
    await channel.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await channel.start();
  return channel;
}
