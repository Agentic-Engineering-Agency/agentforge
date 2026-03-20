/**
 * Discord Channel for AgentForge.
 *
 * Bridges the DiscordAdapter with the AgentForge Convex chat pipeline.
 * This module:
 * - Starts the Discord bot
 * - Routes incoming messages through the agent execution pipeline
 * - Creates/reuses Convex threads per Discord channel
 * - Stores all messages in the Convex messages table
 * - Sends agent responses back to the Discord user
 *
 * @packageDocumentation
 */

import { DiscordAdapter } from './discord-adapter.js';
import type { DiscordChannelConfig } from './types.js';
import type {
  ChannelConfig,
  InboundMessage,
  ChannelEvent,
} from '../../channel-adapter.js';

// =====================================================
// Thread mapping
// =====================================================

/** Map Discord channelId → Convex threadId */
type ThreadMap = Map<string, string>;

// =====================================================
// Logger
// =====================================================

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function createLogger(level: string = 'info'): Logger {
  const threshold = LOG_LEVELS[level] ?? 1;
  const prefix = '[agentforge:discord]';

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
// Convex HTTP Client
// =====================================================

/**
 * Minimal Convex HTTP client for calling queries, mutations, and actions.
 * Matches the pattern used by TelegramChannel.
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

    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
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

    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
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

    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') {
      throw new Error(`Convex action ${functionPath} error: ${data.errorMessage}`);
    }
    return data.value;
  }
}

// =====================================================
// Discord Channel Runner
// =====================================================

/**
 * Runs a Discord bot that routes messages through the AgentForge
 * Convex chat pipeline.
 *
 * @example
 * ```typescript
 * import { DiscordChannel } from '@agentforge-ai/channels-discord';
 *
 * const channel = new DiscordChannel({
 *   botToken: process.env.DISCORD_BOT_TOKEN!,
 *   clientId: process.env.DISCORD_CLIENT_ID!,
 *   agentId: 'my-agent',
 *   convexUrl: process.env.CONVEX_URL!,
 * });
 *
 * await channel.start();
 * ```
 */
export class DiscordChannel {
  private adapter: DiscordAdapter;
  private convex: ConvexHttpApi;
  private config: DiscordChannelConfig;
  private threadMap: ThreadMap = new Map();
  private logger: Logger;
  private processingMessages: Set<string> = new Set();
  private isRunning: boolean = false;

  constructor(config: DiscordChannelConfig) {
    this.config = config;
    this.adapter = new DiscordAdapter();
    this.convex = new ConvexHttpApi(config.convexUrl);
    this.logger = createLogger(config.logLevel);
  }

  /**
   * Start the Discord channel bot.
   * Connects to Discord and begins listening for messages.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Discord channel is already running');
      return;
    }

    this.logger.info('Starting Discord channel...');
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

    // Wire up event handler
    this.adapter.on(this.handleEvent.bind(this));

    // Build the ChannelConfig for the adapter
    const channelConfig: ChannelConfig = {
      id: `discord-${this.config.agentId}`,
      platform: 'discord',
      orgId: 'default',
      agentId: this.config.agentId,
      enabled: true,
      credentials: {
        botToken: this.config.botToken,
        ...(this.config.clientId ? { clientId: this.config.clientId } : {}),
        ...(this.config.guildId ? { guildId: this.config.guildId } : {}),
      },
      settings: {
        mentionOnly: this.config.mentionOnly ?? false,
        respondToDMs: this.config.respondToDMs ?? true,
        registerCommands: true,
      },
      autoReconnect: true,
      reconnectIntervalMs: 5000,
      maxReconnectAttempts: 20,
    };

    // Start the adapter
    await this.adapter.start(channelConfig);
    this.isRunning = true;

    this.logger.info('Discord channel started successfully!');
    this.logger.info('Bot is listening for messages...');
    this.logger.info('Press Ctrl+C to stop.');
  }

  /**
   * Stop the Discord channel bot.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping Discord channel...');
    await this.adapter.stop();
    this.isRunning = false;
    this.threadMap.clear();
    this.processingMessages.clear();
    this.logger.info('Discord channel stopped.');
  }

  /**
   * Get the current thread map (for debugging).
   */
  getThreadMap(): ReadonlyMap<string, string> {
    return this.threadMap;
  }

  /**
   * Get the underlying DiscordAdapter instance.
   */
  getAdapter(): DiscordAdapter {
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

    const senderName = message.sender.displayName ?? message.sender.username ?? 'Unknown';
    this.logger.info(`Message from ${senderName} (channel ${message.chatId}): ${message.text}`);

    try {
      // Handle /start slash command
      if (message.text.startsWith('/start')) {
        await this.handleStartCommand(message);
        return;
      }

      // Handle /new slash command — reset thread
      if (message.text.startsWith('/new')) {
        this.threadMap.delete(message.chatId);
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: 'New conversation started. Send me a message!',
        });
        return;
      }

      // Handle /help slash command
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
          text: 'Sorry, I encountered an error processing your message. Please try again.',
        });
      } catch {
        this.logger.error('Failed to send error message to user');
      }
    } finally {
      setTimeout(() => {
        this.processingMessages.delete(dedupKey);
      }, 30000);
    }
  }

  // ----- Internal: Agent Routing -----

  /**
   * Route a message through the AgentForge chat pipeline:
   * 1. Get or create a Convex thread for this Discord channel
   * 2. Call chat.sendMessage action
   * 3. Send the agent response back to Discord
   */
  private async routeToAgent(message: InboundMessage): Promise<void> {
    await this.adapter.sendTypingIndicator(message.chatId);

    const threadId = await this.getOrCreateThread(
      message.chatId,
      message.sender.displayName
    );

    const userId = this.config.userId ?? `discord:${message.sender.platformUserId}`;

    this.logger.debug(`Sending to agent ${this.config.agentId}, thread ${threadId}`);

    const result = await this.convex.action('chat:sendMessage', {
      agentId: this.config.agentId,
      threadId,
      content: message.text!,
      userId,
    }) as { success: boolean; response: string; usage?: { totalTokens: number } };

    if (result?.response) {
      // Discord max message length is 2000 chars
      const chunks = this.splitMessage(result.response, 2000);
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
        text: "I received your message but couldn't generate a response. Please try again.",
      });
    }
  }

  // ----- Internal: Thread Management -----

  /**
   * Get or create a Convex thread for a Discord channel.
   * Threads are cached in memory and created lazily.
   */
  private async getOrCreateThread(channelId: string, senderName?: string): Promise<string> {
    const cached = this.threadMap.get(channelId);
    if (cached) return cached;

    const threadName = senderName
      ? `Discord: ${senderName}`
      : `Discord Channel ${channelId}`;

    const userId = this.config.userId ?? `discord:${channelId}`;

    const threadId = await this.convex.mutation('chat:createThread', {
      agentId: this.config.agentId,
      name: threadName,
      userId,
    }) as string;

    this.threadMap.set(channelId, threadId);
    this.logger.info(`Created new thread ${threadId} for channel ${channelId}`);

    try {
      await this.convex.mutation('logs:add', {
        level: 'info',
        source: 'discord',
        message: `New Discord conversation started by ${senderName ?? channelId}`,
        metadata: { channelId, threadId, agentId: this.config.agentId },
        userId,
      });
    } catch (error) {
      console.debug('[DiscordChannel.getOrCreateThread] Failed to log conversation start:', error instanceof Error ? error.message : error);
    }

    return threadId;
  }

  // ----- Internal: Command Handlers -----

  private async handleStartCommand(message: InboundMessage): Promise<void> {
    this.threadMap.delete(message.chatId);

    let agentName = 'AI Assistant';
    try {
      const agent = await this.convex.query('agents:get', { id: this.config.agentId });
      if (agent) {
        agentName = (agent as { name: string }).name;
      }
    } catch (error) {
      console.debug('[DiscordChannel.handleStartCommand] Failed to fetch agent name:', error instanceof Error ? error.message : error);
    }

    await this.adapter.sendMessage({
      chatId: message.chatId,
      text:
        `Welcome! I'm **${agentName}**, powered by AgentForge.\n\n` +
        `Send me a message and I'll respond using AI.\n\n` +
        `**Commands:**\n` +
        `/new — Start a new conversation\n` +
        `/help — Show help information`,
    });
  }

  private async handleHelpCommand(message: InboundMessage): Promise<void> {
    await this.adapter.sendMessage({
      chatId: message.chatId,
      text:
        `**AgentForge Discord Bot**\n\n` +
        `Just send me a message and I'll respond using AI.\n\n` +
        `**Commands:**\n` +
        `/start — Reset and show welcome message\n` +
        `/new — Start a fresh conversation thread\n` +
        `/help — Show this help message\n\n` +
        `*Powered by AgentForge — agentforge.dev*`,
    });
  }

  // ----- Internal: Utilities -----

  /**
   * Split a long message into chunks that fit Discord's 2000 char limit.
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
        splitIdx = remaining.lastIndexOf('\n', maxLength);
      }
      if (splitIdx === -1 || splitIdx < maxLength / 2) {
        splitIdx = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitIdx === -1 || splitIdx < maxLength / 2) {
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
 * Create and start a Discord channel from environment variables.
 *
 * Required env vars:
 * - DISCORD_BOT_TOKEN
 * - CONVEX_URL
 *
 * Optional env vars:
 * - DISCORD_CLIENT_ID
 * - DISCORD_GUILD_ID
 * - AGENTFORGE_AGENT_ID
 *
 * @example
 * ```typescript
 * import { startDiscordChannel } from '@agentforge-ai/channels-discord';
 *
 * await startDiscordChannel({ agentId: 'my-agent' });
 * ```
 */
export async function startDiscordChannel(
  overrides: Partial<DiscordChannelConfig> = {}
): Promise<DiscordChannel> {
  const botToken = overrides.botToken ?? process.env.DISCORD_BOT_TOKEN;
  const convexUrl = overrides.convexUrl ?? process.env.CONVEX_URL;
  const agentId = overrides.agentId ?? process.env.AGENTFORGE_AGENT_ID;

  if (!botToken) {
    throw new Error(
      'DISCORD_BOT_TOKEN is required. ' +
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

  const channel = new DiscordChannel({
    botToken,
    convexUrl,
    agentId,
    clientId: overrides.clientId ?? process.env.DISCORD_CLIENT_ID,
    guildId: overrides.guildId ?? process.env.DISCORD_GUILD_ID,
    mentionOnly: overrides.mentionOnly,
    respondToDMs: overrides.respondToDMs,
    userId: overrides.userId,
    logLevel: overrides.logLevel,
  });

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down Discord channel...');
    await channel.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await channel.start();
  return channel;
}
