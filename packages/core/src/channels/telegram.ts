/**
 * Telegram Channel for AgentForge.
 *
 * Bridges the TelegramAdapter with the AgentForge Convex chat pipeline.
 * This module:
 * - Starts the Telegram bot (long-polling or webhook)
 * - Routes incoming messages through the agent execution pipeline
 * - Creates/reuses Convex threads per Telegram chat
 * - Stores all messages in the Convex messages table
 * - Sends agent responses back to the Telegram user
 *
 * @packageDocumentation
 */

import { TelegramAdapter } from '../adapters/telegram-adapter.js';
import type {
  ChannelConfig,
  InboundMessage,
  ChannelEvent,
} from '../channel-adapter.js';

// =====================================================
// Types
// =====================================================

/**
 * Configuration for the Telegram channel runner.
 */
export interface TelegramChannelConfig {
  /** Telegram Bot Token from BotFather */
  botToken: string;
  /** Agent ID to route messages to */
  agentId: string;
  /** Convex deployment URL */
  convexUrl: string;
  /** Whether to use webhook mode (default: false = long-polling) */
  useWebhook?: boolean;
  /** Webhook URL (required if useWebhook is true) */
  webhookUrl?: string;
  /** Webhook secret for verification */
  webhookSecret?: string;
  /** Bot username for @mention detection in groups */
  botUsername?: string;
  /** Whether to respond only to @mentions in groups (default: true) */
  groupMentionOnly?: boolean;
  /** Polling interval in ms (default: 1000) */
  pollingIntervalMs?: number;
  /** User ID for Convex operations (default: 'telegram') */
  userId?: string;
  /** Log level: 'debug' | 'info' | 'warn' | 'error' (default: 'info') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Thread mapping: Telegram chatId → Convex threadId.
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
  const prefix = '[agentforge:telegram]';

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
    // Convert deployment URL to HTTP API URL
    // e.g., https://hip-cardinal-943.convex.cloud → same
    this.baseUrl = deploymentUrl.replace(/\/$/, '');
  }

  /**
   * Call a Convex query function.
   */
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

    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') {
      throw new Error(`Convex query ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }

  /**
   * Call a Convex mutation function.
   */
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

    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') {
      throw new Error(`Convex mutation ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }

  /**
   * Call a Convex action function.
   */
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

    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') {
      throw new Error(`Convex action ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }
}

// =====================================================
// Telegram Channel Runner
// =====================================================

/**
 * Runs a Telegram bot that routes messages through the AgentForge
 * Convex chat pipeline.
 *
 * @example
 * ```typescript
 * import { TelegramChannel } from '@agentforge-ai/core/channels/telegram';
 *
 * const channel = new TelegramChannel({
 *   botToken: process.env.TELEGRAM_BOT_TOKEN!,
 *   agentId: 'my-agent',
 *   convexUrl: process.env.CONVEX_URL!,
 * });
 *
 * await channel.start();
 * ```
 */
export class TelegramChannel {
  private adapter: TelegramAdapter;
  private convex: ConvexHttpApi;
  private config: TelegramChannelConfig;
  private threadMap: ThreadMap = new Map();
  private logger: Logger;
  private processingMessages: Set<string> = new Set();
  private isRunning: boolean = false;

  constructor(config: TelegramChannelConfig) {
    this.config = config;
    this.adapter = new TelegramAdapter();
    this.convex = new ConvexHttpApi(config.convexUrl);
    this.logger = createLogger(config.logLevel);
  }

  /**
   * Start the Telegram channel bot.
   * Connects to Telegram and begins listening for messages.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Telegram channel is already running');
      return;
    }

    this.logger.info('Starting Telegram channel...');
    this.logger.info(`Agent ID: ${this.config.agentId}`);
    this.logger.info(`Convex URL: ${this.config.convexUrl}`);

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
      this.logger.info(`Agent: ${agentData.name} (${agentData.model} via ${agentData.provider})`);
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
      id: `telegram-${this.config.agentId}`,
      platform: 'telegram',
      orgId: 'default',
      agentId: this.config.agentId,
      enabled: true,
      credentials: {
        botToken: this.config.botToken,
      },
      settings: {
        botUsername: this.config.botUsername,
        groupMentionOnly: this.config.groupMentionOnly ?? true,
        pollingIntervalMs: this.config.pollingIntervalMs ?? 1000,
        useWebhook: this.config.useWebhook ?? false,
        webhookUrl: this.config.webhookUrl,
        webhookSecret: this.config.webhookSecret,
      },
      autoReconnect: true,
      reconnectIntervalMs: 5000,
      maxReconnectAttempts: 20,
    };

    // Start the adapter
    await this.adapter.start(channelConfig);
    this.isRunning = true;

    this.logger.info('Telegram channel started successfully!');
    this.logger.info('Bot is listening for messages...');
    this.logger.info('Press Ctrl+C to stop.');
  }

  /**
   * Stop the Telegram channel bot.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping Telegram channel...');
    await this.adapter.stop();
    this.isRunning = false;
    this.threadMap.clear();
    this.processingMessages.clear();
    this.logger.info('Telegram channel stopped.');
  }

  /**
   * Get the current thread map (for debugging).
   */
  getThreadMap(): ReadonlyMap<string, string> {
    return this.threadMap;
  }

  /**
   * Get the underlying TelegramAdapter instance.
   */
  getAdapter(): TelegramAdapter {
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

      case 'connection_state':
        this.logger.debug('Connection state:', (event.data as { state: string }).state);
        break;

      case 'error':
        this.logger.error('Adapter error:', (event.data as { error: Error }).error.message);
        break;

      default:
        this.logger.debug('Unhandled event type:', event.type);
    }
  }

  private async handleInboundMessage(message: InboundMessage): Promise<void> {
    // Handle voice notes: transcribe via STT and process as text
    if (message.media?.some(m => m.type === 'voice_note') && !message.text?.trim()) {
      await this.handleVoiceMessage(message);
      return;
    }

    // Skip empty messages
    if (!message.text?.trim()) {
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

    const senderName = message.sender.displayName || message.sender.username || 'Unknown';
    this.logger.info(`Message from ${senderName} (chat ${message.chatId}): ${message.text}`);

    try {
      // Handle /start command
      if (message.text.startsWith('/start')) {
        await this.handleStartCommand(message);
        return;
      }

      // Handle /new command — create a new thread
      if (message.text.startsWith('/new')) {
        this.threadMap.delete(message.chatId);
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: '🔄 New conversation started. Send me a message!',
        });
        return;
      }

      // Handle /help command
      if (message.text.startsWith('/help')) {
        await this.handleHelpCommand(message);
        return;
      }

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

  // ----- Internal: Voice Message Handling -----

  /**
   * Handle voice note messages by transcribing them via STT,
   * then routing the transcribed text through the normal agent pipeline.
   */
  private async handleVoiceMessage(message: InboundMessage): Promise<void> {
    const voiceMedia = message.media?.find(m => m.type === 'voice_note');
    if (!voiceMedia?.url) {
      this.logger.warn('Voice message has no audio URL');
      return;
    }

    const dedupKey = `${message.chatId}:${message.platformMessageId}`;
    if (this.processingMessages.has(dedupKey)) return;
    this.processingMessages.add(dedupKey);

    const senderName = message.sender.displayName || message.sender.username || 'Unknown';
    this.logger.info(`Voice message from ${senderName} (chat ${message.chatId})`);

    try {
      await this.adapter.sendTypingIndicator(message.chatId);

      // Download the voice note audio
      const audioResponse = await fetch(voiceMedia.url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download voice note: ${audioResponse.status}`);
      }

      const audioBuffer = await audioResponse.arrayBuffer();

      // Transcribe via OpenAI Whisper STT
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: 'Voice transcription is not available (OPENAI_API_KEY not configured).',
        });
        return;
      }

      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
      formData.append('file', blob, 'voice.ogg');
      formData.append('model', 'whisper-1');

      const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
      });

      if (!sttResponse.ok) {
        const errText = await sttResponse.text().catch(() => 'Unknown error');
        throw new Error(`Whisper STT error (${sttResponse.status}): ${errText}`);
      }

      const sttResult = await sttResponse.json() as { text: string };
      const transcribedText = sttResult.text?.trim();

      if (!transcribedText) {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: 'Could not transcribe your voice message. Please try again or send text.',
        });
        return;
      }

      this.logger.info(`Transcribed voice: "${transcribedText.substring(0, 100)}..."`);

      // Route the transcribed text through the normal agent pipeline
      const textMessage: InboundMessage = {
        ...message,
        text: transcribedText,
      };
      await this.routeToAgent(textMessage);
    } catch (error) {
      this.logger.error('Error handling voice message:', error);
      try {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: 'Sorry, I could not process your voice message. Please try sending text instead.',
        });
      } catch {
        this.logger.error('Failed to send voice error message');
      }
    } finally {
      setTimeout(() => this.processingMessages.delete(dedupKey), 30000);
    }
  }

  // ----- Internal: Agent Routing -----

  /**
   * Route a message through the AgentForge chat pipeline:
   * 1. Get or create a Convex thread for this Telegram chat
   * 2. Call chat.sendMessage action (stores user msg, calls LLM, stores response)
   * 3. Send the agent response back to Telegram
   */
  private async routeToAgent(message: InboundMessage): Promise<void> {
    // Show typing indicator while processing
    await this.adapter.sendTypingIndicator(message.chatId);

    // Get or create thread for this chat
    const threadId = await this.getOrCreateThread(message.chatId, message.sender.displayName);

    // Call the Convex chat.sendMessage action
    // This handles: store user msg → call LLM → store assistant msg → record usage
    const userId = this.config.userId || `telegram:${message.sender.platformUserId}`;

    this.logger.debug(`Sending to agent ${this.config.agentId}, thread ${threadId}`);

    const result = await this.convex.action('chat:sendMessage', {
      agentId: this.config.agentId,
      threadId,
      content: message.text!,
      userId,
    }) as { success: boolean; response: string; usage?: { totalTokens: number } };

    if (result?.response) {
      // Split long messages for Telegram's 4096 char limit
      const chunks = this.splitMessage(result.response, 4096);
      for (const chunk of chunks) {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: chunk,
          replyToMessageId: chunks.length === 1 ? message.platformMessageId : undefined,
        });
      }

      if (result.usage) {
        this.logger.debug(`Tokens used: ${result.usage.totalTokens}`);
      }
    } else {
      await this.adapter.sendMessage({
        chatId: message.chatId,
        text: '🤔 I received your message but couldn\'t generate a response. Please try again.',
      });
    }
  }

  // ----- Internal: Thread Management -----

  /**
   * Get or create a Convex thread for a Telegram chat.
   * Threads are cached in memory and created lazily.
   */
  private async getOrCreateThread(chatId: string, senderName?: string): Promise<string> {
    // Check in-memory cache first
    const cached = this.threadMap.get(chatId);
    if (cached) return cached;

    // Create a new thread in Convex
    const threadName = senderName
      ? `Telegram: ${senderName}`
      : `Telegram Chat ${chatId}`;

    const userId = this.config.userId || `telegram:${chatId}`;

    const threadId = await this.convex.mutation('chat:createThread', {
      agentId: this.config.agentId,
      name: threadName,
      userId,
    }) as string;

    this.threadMap.set(chatId, threadId);
    this.logger.info(`Created new thread ${threadId} for chat ${chatId}`);

    // Log the channel connection
    try {
      await this.convex.mutation('logs:add', {
        level: 'info',
        source: 'telegram',
        message: `New Telegram conversation started by ${senderName || chatId}`,
        metadata: { chatId, threadId, agentId: this.config.agentId },
        userId,
      });
    } catch (error) {
      console.debug('[TelegramChannel.getOrCreateThread] Failed to log conversation start:', error instanceof Error ? error.message : error);
    }

    return threadId;
  }

  // ----- Internal: Command Handlers -----

  private async handleStartCommand(message: InboundMessage): Promise<void> {
    // Reset thread for this chat
    this.threadMap.delete(message.chatId);

    let agentName = 'AI Assistant';
    try {
      const agent = await this.convex.query('agents:get', { id: this.config.agentId });
      if (agent) {
        agentName = (agent as { name: string }).name;
      }
    } catch (error) {
      console.debug('[TelegramChannel.handleStartCommand] Failed to fetch agent name:', error instanceof Error ? error.message : error);
    }

    await this.adapter.sendMessage({
      chatId: message.chatId,
      text:
        `👋 Welcome! I'm *${agentName}*, powered by AgentForge.\n\n` +
        `Send me a message and I'll respond using AI.\n\n` +
        `Commands:\n` +
        `/new — Start a new conversation\n` +
        `/help — Show help information`,
      markdown: true,
      platformOptions: {
        parse_mode: 'Markdown',
      },
    });
  }

  private async handleHelpCommand(message: InboundMessage): Promise<void> {
    await this.adapter.sendMessage({
      chatId: message.chatId,
      text:
        `🤖 *AgentForge Telegram Bot*\n\n` +
        `Just send me a message and I'll respond using AI.\n\n` +
        `*Commands:*\n` +
        `/start — Reset and show welcome message\n` +
        `/new — Start a fresh conversation thread\n` +
        `/help — Show this help message\n\n` +
        `_Powered by AgentForge — agentforge.dev_`,
      markdown: true,
      platformOptions: {
        parse_mode: 'Markdown',
      },
    });
  }

  // ----- Internal: Utilities -----

  /**
   * Split a long message into chunks that fit Telegram's character limit.
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
 * Create and start a Telegram channel from environment variables.
 *
 * Required env vars:
 * - TELEGRAM_BOT_TOKEN
 * - CONVEX_URL
 *
 * Optional env vars:
 * - AGENTFORGE_AGENT_ID (default: first active agent)
 * - TELEGRAM_WEBHOOK_URL
 * - TELEGRAM_WEBHOOK_SECRET
 * - TELEGRAM_BOT_USERNAME
 *
 * @example
 * ```typescript
 * import { startTelegramChannel } from '@agentforge-ai/core/channels/telegram';
 *
 * await startTelegramChannel({
 *   agentId: 'my-agent',
 * });
 * ```
 */
export async function startTelegramChannel(
  overrides: Partial<TelegramChannelConfig> = {}
): Promise<TelegramChannel> {
  const botToken = overrides.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const convexUrl = overrides.convexUrl || process.env.CONVEX_URL;
  const agentId = overrides.agentId || process.env.AGENTFORGE_AGENT_ID;

  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is required. ' +
      'Set it in your .env file or pass it as botToken in the config.'
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

  const channel = new TelegramChannel({
    botToken,
    convexUrl,
    agentId,
    useWebhook: overrides.useWebhook ?? !!process.env.TELEGRAM_WEBHOOK_URL,
    webhookUrl: overrides.webhookUrl || process.env.TELEGRAM_WEBHOOK_URL,
    webhookSecret: overrides.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET,
    botUsername: overrides.botUsername || process.env.TELEGRAM_BOT_USERNAME,
    groupMentionOnly: overrides.groupMentionOnly,
    pollingIntervalMs: overrides.pollingIntervalMs,
    userId: overrides.userId,
    logLevel: overrides.logLevel,
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down Telegram channel...');
    await channel.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await channel.start();
  return channel;
}
