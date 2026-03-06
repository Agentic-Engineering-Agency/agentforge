import { Client, GatewayIntentBits, ChannelType, type Message } from 'discord.js';
import type { Agent } from '@mastra/core/agent';
import type { ChannelAdapter } from '../daemon/types.js';
import { progressiveStream, splitMessage, generateThreadId } from './shared.js';

export interface DiscordChannelConfig {
  defaultAgentId: string;
  autoChannels?: string[]; // Channel names where bot responds without @mention
  teamChannel?: string; // Channel for delegation events
  editIntervalMs?: number; // Default 1500
}

export class DiscordChannel implements ChannelAdapter {
  name = 'discord';
  private client: Client;
  private config: DiscordChannelConfig;
  private agents = new Map<string, Agent>();
  private daemon: any = null;
  private token: string;

  constructor(token: string, config: DiscordChannelConfig) {
    this.config = config;
    this.token = token;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.client.once('ready', () => {
      console.log(`[DiscordChannel] Logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', async (message: Message) => {
      // Ignore messages from bots
      if (message.author.bot) return;

      // Check if agents are loaded
      if (this.agents.size === 0) {
        await message.reply('Bot not ready yet. Please try again.');
        return;
      }

      // Check if should respond: @mentioned OR in auto-channel
      const botUser = this.client.user;
      if (!botUser) return;

      const isMentioned = message.mentions.has(botUser) || message.mentions.repliedUser;
      const channelName = message.channel && 'name' in message.channel ? message.channel.name : null;
      const isAutoChannel = channelName !== null && this.config.autoChannels?.includes(channelName);
      const isDM = message.channel.type === ChannelType.DM;

      if (!isMentioned && !isAutoChannel && !isDM) return;

      // Get agent
      const agent = this.agents.get(this.config.defaultAgentId);
      if (!agent) {
        await message.reply('Error: Agent not configured.');
        return;
      }

      // Clean message content (remove bot mention)
      let content = message.content;
      if (isMentioned) {
        content = content.replace(new RegExp(`<@!?${botUser.id}>`), '').trim();
      }

      // Generate thread ID per user
      const threadId = generateThreadId('discord', message.author.id);

      // Send "thinking" message
      const thinkingMsg = await message.reply('💭 Thinking...');

      try {
        // Progressive streaming
        await progressiveStream(
          agent,
          content,
          { threadId, resourceId: threadId },
          async (text, done) => {
            if (!done && text.length > 0) {
              await thinkingMsg.edit(text.slice(0, 2000)); // Discord limit
            } else if (done) {
              // Split long messages
              const chunks = splitMessage(text, 2000);
              if (chunks.length === 1) {
                await thinkingMsg.edit(chunks[0]);
              } else {
                await thinkingMsg.delete();
                for (const chunk of chunks) {
                  await message.reply(chunk);
                }
              }
            }
          },
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[DiscordChannel] Error:', errorMsg);
        await thinkingMsg.edit('❌ Error generating response. Please try again.');
      }
    });
  }

  async start(agents: Map<string, Agent>, daemon: any): Promise<void> {
    this.agents = agents;
    this.daemon = daemon;

    // Login and wait for ready
    try {
      await this.client.login(this.token);
      await new Promise<void>((resolve, reject) => {
        if (this.client.isReady()) {
          resolve();
        } else {
          this.client.once('ready', () => resolve());
          this.client.once('error', reject);
        }
      });
    } catch (error) {
      console.error('[DiscordChannel] Login failed:', error);
      throw error;
    }

    console.log(`[DiscordChannel] Started with agent: ${this.config.defaultAgentId}`);
  }

  async stop(): Promise<void> {
    await this.client.destroy();
    console.log('[DiscordChannel] Stopped');
  }
}
