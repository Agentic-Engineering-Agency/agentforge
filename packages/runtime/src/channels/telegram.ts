import { Bot, type Context } from 'grammy';
import type { Agent } from '@mastra/core/agent';
import type { ChannelAdapter } from '../daemon/types.js';
import { progressiveStream, splitMessage, generateThreadId } from './shared.js';

export interface TelegramChannelConfig {
  defaultAgentId: string;
  allowedChatIds?: number[]; // Whitelist (empty = allow all)
  editIntervalMs?: number; // Default 2000 (safer for Telegram ~1 edit/sec limit)
}

export class TelegramChannel implements ChannelAdapter {
  name = 'telegram';
  private bot: Bot;
  private config: TelegramChannelConfig;
  private agents = new Map<string, Agent>();
  private daemon: any = null;

  constructor(token: string, config: TelegramChannelConfig) {
    this.config = config;
    this.bot = new Bot(token);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.api.setMyDescription('AgentForge AI Assistant');

    this.bot.command('start', (ctx) => {
      ctx.reply('👋 Hello! I am AgentForge AI. Send me a message and I will respond.');
    });

    this.bot.command('help', (ctx) => {
      ctx.reply('📚 Available commands:\n/start - Start the bot\n/help - Show this help\n\nJust send any message to chat!');
    });

    this.bot.on('message:text', async (ctx: Context) => {
      if (!ctx.chat) return;
      const chatId = ctx.chat.id;

      // Check if agents are loaded
      if (this.agents.size === 0) {
        await ctx.reply('Bot not ready yet. Please try again.');
        return;
      }

      // Check whitelist if configured
      if (this.config.allowedChatIds && this.config.allowedChatIds.length > 0) {
        if (!this.config.allowedChatIds.includes(chatId)) {
          await ctx.reply('Sorry, this bot is not available in this chat.');
          return;
        }
      }

      // Get agent
      const agent = this.agents.get(this.config.defaultAgentId);
      if (!agent) {
        await ctx.reply('Error: Agent not configured.');
        return;
      }

      const content = ctx.message?.text ?? '';
      const threadId = generateThreadId('telegram', chatId.toString());

      // Send "thinking" message
      const thinkingMsg = await ctx.reply('💭 Thinking...');

      try {
        // Progressive streaming
        await progressiveStream(
          agent,
          content,
          { threadId, resourceId: threadId, editIntervalMs: this.config.editIntervalMs ?? 2000 },
          async (text, done) => {
            if (!done && text.length > 0) {
              try {
                // Telegram has 4096 char limit for messages
                await this.bot.api.editMessageText(chatId, thinkingMsg.message_id, text.slice(0, 4096));
              } catch (error) {
                // Edit failed (maybe too fast), log and continue
                const msg = error instanceof Error ? error.message : 'Unknown error';
                console.debug('[TelegramChannel] Edit failed (may retry):', msg);
              }
            } else if (done) {
              // Split long messages
              const chunks = splitMessage(text, 4096);
              if (chunks.length === 1) {
                try {
                  await this.bot.api.editMessageText(chatId, thinkingMsg.message_id, chunks[0]);
                } catch {
                  // Edit failed, delete thinking and send new
                  await this.bot.api.deleteMessage(chatId, thinkingMsg.message_id);
                  await ctx.reply(chunks[0]);
                }
              } else {
                await this.bot.api.deleteMessage(chatId, thinkingMsg.message_id);
                for (const chunk of chunks) {
                  await ctx.reply(chunk);
                }
              }
            }
          },
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[TelegramChannel] Error:', errorMsg);
        try {
          await this.bot.api.editMessageText(chatId, thinkingMsg.message_id, '❌ Error generating response. Please try again.');
        } catch {
          // If edit fails, try sending new message
          await ctx.reply('❌ Error generating response. Please try again.');
        }
      }
    });

    this.bot.catch((err) => {
      console.error('[TelegramChannel] Bot error:', err);
    });
  }

  async start(agents: Map<string, Agent>, daemon: any): Promise<void> {
    this.agents = agents;
    this.daemon = daemon;

    // bot.start() never resolves (long-running polling loop).
    // Use onStart callback to signal readiness, then let polling run in background.
    // .catch() is attached synchronously (before any async task can run), so
    // there is no race with onStart.
    await new Promise<void>((resolve, reject) => {
      let started = false;
      this.bot
        .start({ onStart: () => { started = true; resolve(); } })
        .catch((error) => {
          if (!started) {
            reject(error);
          } else {
            console.error('[TelegramChannel] Bot polling error:', error);
          }
        });
    });
    console.log(`[TelegramChannel] Started with agent: ${this.config.defaultAgentId}`);
  }

  async stop(): Promise<void> {
    await this.bot.stop();
    console.log('[TelegramChannel] Stopped');
  }
}
