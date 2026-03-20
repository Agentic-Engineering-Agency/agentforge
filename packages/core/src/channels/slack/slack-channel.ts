/**
 * Slack Channel for AgentForge.
 *
 * Bridges the SlackAdapter with the AgentForge Convex chat pipeline.
 * This module:
 * - Starts the Slack bot (Socket Mode or Events API)
 * - Routes incoming messages through the agent execution pipeline
 * - Creates/reuses Convex threads per Slack channel+user
 * - Stores all messages in the Convex messages table
 * - Sends agent responses back to the Slack user
 *
 * @packageDocumentation
 */

import { SlackAdapter } from './slack-adapter.js';
import type {
  ChannelConfig,
  InboundMessage,
  ChannelEvent,
} from '../../channel-adapter.js';

// =====================================================
// Types
// =====================================================

interface SlackChannelConfig {
  /** Slack Bot Token (xoxb-...) */
  botToken: string;
  /** Slack App-Level Token (xapp-...) for Socket Mode */
  appToken: string;
  /** Slack Signing Secret */
  signingSecret: string;
  /** Agent ID to route messages to */
  agentId: string;
  /** Convex deployment URL */
  convexUrl: string;
  /** Whether to use Socket Mode (default: true) */
  socketMode?: boolean;
  /** HTTP port for Events API mode (default: 3002) */
  port?: number;
  /** User ID for Convex operations (default: 'slack') */
  userId?: string;
  /** Log level: 'debug' | 'info' | 'warn' | 'error' (default: 'info') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

type ThreadMap = Map<string, string>;

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
  const prefix = '[agentforge:slack]';

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

class ConvexHttpApi {
  private baseUrl: string;

  constructor(deploymentUrl: string) {
    this.baseUrl = deploymentUrl.replace(/\/$/, '');
  }

  async query(functionPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex query ${functionPath} failed: ${response.status} ${text}`);
    }
    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') throw new Error(`Convex query ${functionPath} error: ${data.errorMessage}`);
    return data.value;
  }

  async mutation(functionPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex mutation ${functionPath} failed: ${response.status} ${text}`);
    }
    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') throw new Error(`Convex mutation ${functionPath} error: ${data.errorMessage}`);
    return data.value;
  }

  async action(functionPath: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: functionPath, args }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex action ${functionPath} failed: ${response.status} ${text}`);
    }
    const data = await response.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') throw new Error(`Convex action ${functionPath} error: ${data.errorMessage}`);
    return data.value;
  }
}

// =====================================================
// Slack Channel Runner
// =====================================================

export class SlackChannel {
  private adapter: SlackAdapter;
  private convex: ConvexHttpApi;
  private config: SlackChannelConfig;
  private threadMap: ThreadMap = new Map();
  private logger: Logger;
  private processingMessages: Set<string> = new Set();
  private isRunning: boolean = false;

  constructor(config: SlackChannelConfig) {
    this.config = config;
    this.adapter = new SlackAdapter();
    this.convex = new ConvexHttpApi(config.convexUrl);
    this.logger = createLogger(config.logLevel);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Slack channel is already running');
      return;
    }

    this.logger.info('Starting Slack channel...');
    this.logger.info(`Agent ID: ${this.config.agentId}`);
    this.logger.info(`Convex URL: ${this.config.convexUrl}`);
    this.logger.info(`Mode: ${this.config.socketMode !== false ? 'Socket Mode' : 'Events API'}`);

    // Verify the agent exists
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

    const channelConfig: ChannelConfig = {
      id: `slack-${this.config.agentId}`,
      platform: 'slack',
      orgId: 'default',
      agentId: this.config.agentId,
      enabled: true,
      credentials: {
        botToken: this.config.botToken,
        appToken: this.config.appToken,
        signingSecret: this.config.signingSecret,
      },
      settings: {
        socketMode: this.config.socketMode ?? true,
        port: this.config.port ?? 3002,
      },
      autoReconnect: true,
      reconnectIntervalMs: 5000,
      maxReconnectAttempts: 20,
    };

    await this.adapter.start(channelConfig);
    this.isRunning = true;

    this.logger.info('Slack channel started successfully!');
    this.logger.info('Bot is listening for messages...');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.logger.info('Stopping Slack channel...');
    await this.adapter.stop();
    this.isRunning = false;
    this.threadMap.clear();
    this.processingMessages.clear();
    this.logger.info('Slack channel stopped.');
  }

  getThreadMap(): ReadonlyMap<string, string> {
    return this.threadMap;
  }

  getAdapter(): SlackAdapter {
    return this.adapter;
  }

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

    // Dedup
    const dedupKey = `${message.chatId}:${message.platformMessageId}`;
    if (this.processingMessages.has(dedupKey)) {
      this.logger.debug('Skipping duplicate message:', dedupKey);
      return;
    }
    this.processingMessages.add(dedupKey);

    const senderName = message.sender.displayName || message.sender.username || 'Unknown';
    this.logger.info(`Message from ${senderName} (channel ${message.chatId}): ${message.text}`);

    try {
      await this.routeToAgent(message);
    } catch (error) {
      this.logger.error('Error handling message:', error);
      try {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: 'Sorry, I encountered an error processing your message. Please try again.',
          threadId: message.threadId,
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

  private async routeToAgent(message: InboundMessage): Promise<void> {
    const threadKey = `${message.chatId}:${message.sender.platformUserId}`;
    const threadId = await this.getOrCreateThread(threadKey, message.sender.displayName);
    const userId = this.config.userId || `slack:${message.sender.platformUserId}`;

    this.logger.debug(`Sending to agent ${this.config.agentId}, thread ${threadId}`);

    const result = await this.convex.action('chat:sendMessage', {
      agentId: this.config.agentId,
      threadId,
      content: message.text!,
      userId,
    }) as { success: boolean; response: string; usage?: { totalTokens: number } };

    if (result?.response) {
      const chunks = this.splitMessage(result.response, 4000);
      for (const chunk of chunks) {
        await this.adapter.sendMessage({
          chatId: message.chatId,
          text: chunk,
          threadId: message.threadId,
        });
      }

      if (result.usage) {
        this.logger.debug(`Tokens used: ${result.usage.totalTokens}`);
      }
    } else {
      await this.adapter.sendMessage({
        chatId: message.chatId,
        text: "I received your message but couldn't generate a response. Please try again.",
        threadId: message.threadId,
      });
    }
  }

  // ----- Internal: Thread Management -----

  private async getOrCreateThread(threadKey: string, senderName?: string): Promise<string> {
    const cached = this.threadMap.get(threadKey);
    if (cached) return cached;

    const threadName = senderName
      ? `Slack: ${senderName}`
      : `Slack ${threadKey}`;

    const userId = this.config.userId || `slack:${threadKey}`;

    const threadId = await this.convex.mutation('chat:createThread', {
      agentId: this.config.agentId,
      name: threadName,
      userId,
    }) as string;

    this.threadMap.set(threadKey, threadId);
    this.logger.info(`Created new thread ${threadId} for ${threadKey}`);

    return threadId;
  }

  // ----- Internal: Utilities -----

  private splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

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

export async function startSlackChannel(
  overrides: Partial<SlackChannelConfig> = {}
): Promise<SlackChannel> {
  const botToken = overrides.botToken || process.env.SLACK_BOT_TOKEN;
  const appToken = overrides.appToken || process.env.SLACK_APP_TOKEN;
  const signingSecret = overrides.signingSecret || process.env.SLACK_SIGNING_SECRET;
  const convexUrl = overrides.convexUrl || process.env.CONVEX_URL;
  const agentId = overrides.agentId || process.env.AGENTFORGE_AGENT_ID;

  if (!botToken) {
    throw new Error(
      'SLACK_BOT_TOKEN is required. Set it in your .env file or pass it as botToken in the config.'
    );
  }
  if (!appToken) {
    throw new Error(
      'SLACK_APP_TOKEN is required for Socket Mode. Set it in your .env file or pass it as appToken in the config.'
    );
  }
  if (!signingSecret) {
    throw new Error(
      'SLACK_SIGNING_SECRET is required. Set it in your .env file or pass it as signingSecret in the config.'
    );
  }
  if (!convexUrl) {
    throw new Error(
      'CONVEX_URL is required. Set it in your .env file or pass it as convexUrl in the config.'
    );
  }
  if (!agentId) {
    throw new Error(
      'Agent ID is required. Pass it as agentId in the config or set AGENTFORGE_AGENT_ID env var.'
    );
  }

  const channel = new SlackChannel({
    botToken,
    appToken,
    signingSecret,
    convexUrl,
    agentId,
    socketMode: overrides.socketMode,
    port: overrides.port,
    userId: overrides.userId,
    logLevel: overrides.logLevel,
  });

  const shutdown = async () => {
    console.log('\nShutting down Slack channel...');
    await channel.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await channel.start();
  return channel;
}
