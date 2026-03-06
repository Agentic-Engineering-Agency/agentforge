import { App, type SayFn } from '@slack/bolt';
import { z } from 'zod';
import type { Agent } from '@mastra/core/agent';
import type { ChannelAdapter, DaemonAccess } from '../daemon/types.js';
import { progressiveStream, generateThreadId } from './shared.js';

/**
 * Zod schema for Slack channel configuration.
 * Validates bot token prefix (xoxb-) and app token prefix (xapp-)
 * to catch credential mix-ups at construction time.
 */
export const SlackChannelConfigSchema = z.object({
  defaultAgentId: z.string().min(1, 'defaultAgentId is required'),
  botToken: z
    .string()
    .regex(/^xoxb-/, { message: 'botToken must start with "xoxb-" (bot user OAuth token)' }),
  appToken: z
    .string()
    .regex(/^xapp-/, { message: 'appToken must start with "xapp-" (required for Socket Mode)' })
    .optional(),
  signingSecret: z.string().min(1, 'signingSecret is required'),
  allowedChannelIds: z.array(z.string()).optional(),
  editIntervalMs: z.number().int().min(100).max(10_000).optional(),
});

export type SlackChannelConfig = z.infer<typeof SlackChannelConfigSchema>;

export class SlackChannel implements ChannelAdapter {
  name = 'slack';
  private app: App;
  private config: SlackChannelConfig;
  private agents = new Map<string, Agent>();
  private daemon: DaemonAccess | null = null;

  /**
   * @throws {ZodError} when config fails validation (bad token prefixes, missing fields)
   */
  constructor(config: SlackChannelConfig) {
    // Validate at construction — surfaces credential errors before any network call
    this.config = SlackChannelConfigSchema.parse(config);

    const socketMode = Boolean(this.config.appToken);
    this.app = new App({
      token: this.config.botToken,
      signingSecret: this.config.signingSecret,
      ...(socketMode ? { socketMode: true, appToken: this.config.appToken! } : {}),
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Respond to @mentions in channels
    this.app.event('app_mention', async ({ event, say }) => {
      if (!event.user) return;
      await this.handleMessage(event.channel, event.user, event.text, say);
    });

    // Respond to DMs
    this.app.message(async ({ message, say }) => {
      if (message.subtype) return; // skip bot messages, edits, deletes
      const msg = message as { channel: string; user?: string; text?: string };
      if (!msg.user) return;
      await this.handleMessage(msg.channel, msg.user, msg.text ?? '', say);
    });
  }

  private async handleMessage(
    channelId: string,
    userId: string,
    text: string,
    say: SayFn,
  ): Promise<void> {
    if (this.agents.size === 0) {
      await say({ text: 'Bot not ready yet. Please try again.' });
      return;
    }

    // Enforce channel whitelist if configured
    if (this.config.allowedChannelIds && this.config.allowedChannelIds.length > 0) {
      if (!this.config.allowedChannelIds.includes(channelId)) {
        return; // silently ignore non-whitelisted channels
      }
    }

    const agent = this.agents.get(this.config.defaultAgentId);
    if (!agent) {
      await say({ text: 'Error: Agent not configured.' });
      return;
    }

    // Strip the @mention from the text
    const content = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    const threadId = generateThreadId('slack', userId);

    // Post the "thinking" placeholder
    const thinkingResult = await say({ text: '💭 Thinking...' });
    const thinkingTs = thinkingResult.ts;
    if (!thinkingTs) return; // can't update without a timestamp

    try {
      await progressiveStream(
        agent,
        content,
        { threadId, resourceId: threadId, editIntervalMs: this.config.editIntervalMs ?? 1000 },
        async (responseText, done) => {
          if (!done && responseText.length > 0) {
            // Slack message limit is 40,000 chars; slice to be safe
            await this.app.client.chat.update({
              channel: channelId,
              ts: thinkingTs,
              text: responseText.slice(0, 40_000),
            });
          } else if (done) {
            const final = responseText.slice(0, 40_000);
            await this.app.client.chat.update({
              channel: channelId,
              ts: thinkingTs,
              text: final,
            });
          }
        },
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[SlackChannel] Error:', errorMsg);
      await this.app.client.chat.update({
        channel: channelId,
        ts: thinkingTs,
        text: '❌ Error generating response. Please try again.',
      });
    }
  }

  async start(agents: Map<string, Agent>, daemon: DaemonAccess): Promise<void> {
    this.agents = agents;
    this.daemon = daemon;

    await this.app.start();
    console.log(`[SlackChannel] Started with agent: ${this.config.defaultAgentId}`);
  }

  async stop(): Promise<void> {
    await this.app.stop();
    console.log('[SlackChannel] Stopped');
  }
}
