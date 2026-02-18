/**
 * CLI Command: agentforge channel:telegram
 *
 * Configure and start a Telegram bot that routes messages through
 * the AgentForge agent execution pipeline.
 *
 * Usage:
 *   agentforge channel:telegram start --agent <id> [--token <bot-token>]
 *   agentforge channel:telegram configure
 *   agentforge channel:telegram status
 */

import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, success, error, info, dim, warn, details, colors } from '../lib/display.js';
import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline';

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

/**
 * Read a value from .env files in the current directory.
 */
function readEnvValue(key: string): string | undefined {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env', '.env.production'];
  for (const envFile of envFiles) {
    const envPath = path.join(cwd, envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (match) return match[1].trim().replace(/["']/g, '');
    }
  }
  return undefined;
}

/**
 * Write a value to .env.local in the current directory.
 */
function writeEnvValue(key: string, value: string, envFile: string = '.env.local'): void {
  const envPath = path.join(process.cwd(), envFile);
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  const lines = content.split('\n');
  const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (idx >= 0) {
    lines[idx] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envPath, lines.join('\n'));
}

export function registerChannelTelegramCommand(program: Command) {
  const channel = program
    .command('channel:telegram')
    .description('Manage the Telegram messaging channel');

  // ─── Start ─────────────────────────────────────────────────────────
  channel
    .command('start')
    .description('Start the Telegram bot and begin routing messages to an agent')
    .option('-a, --agent <id>', 'Agent ID to route messages to')
    .option('-t, --token <token>', 'Telegram Bot Token (overrides .env)')
    .option('--webhook-url <url>', 'Use webhook mode with this URL')
    .option('--webhook-secret <secret>', 'Webhook verification secret')
    .option('--bot-username <username>', 'Bot username for @mention detection')
    .option('--polling-interval <ms>', 'Polling interval in milliseconds', '1000')
    .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
    .option('--group-mention-only', 'Only respond to @mentions in groups', true)
    .action(async (opts) => {
      header('Telegram Channel');

      // Resolve bot token
      const botToken = opts.token || readEnvValue('TELEGRAM_BOT_TOKEN') || process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        error('Telegram Bot Token not found.');
        info('Set it with: agentforge channel:telegram configure');
        info('Or pass it with: --token <bot-token>');
        info('Or set TELEGRAM_BOT_TOKEN in your .env.local file');
        process.exit(1);
      }

      // Resolve Convex URL
      const convexUrl = readEnvValue('CONVEX_URL') || process.env.CONVEX_URL;
      if (!convexUrl) {
        error('CONVEX_URL not found. Run `npx convex dev` first.');
        process.exit(1);
      }

      // Resolve agent ID
      let agentId = opts.agent;
      if (!agentId) {
        // Try to get from env
        agentId = readEnvValue('AGENTFORGE_AGENT_ID') || process.env.AGENTFORGE_AGENT_ID;
      }

      if (!agentId) {
        // List agents and let user pick
        info('No agent specified. Fetching available agents...');
        const client = await createClient();
        const agents = await safeCall(
          () => client.query('agents:list' as any, {}),
          'Failed to list agents'
        );

        if (!agents || (agents as any[]).length === 0) {
          error('No agents found. Create one first: agentforge agents create');
          process.exit(1);
        }

        console.log();
        (agents as any[]).forEach((a: any, i: number) => {
          console.log(
            `  ${colors.cyan}${i + 1}.${colors.reset} ${a.name} ${colors.dim}(${a.id})${colors.reset} — ${a.model}`
          );
        });
        console.log();

        const choice = await prompt('Select agent (number or ID): ');
        const idx = parseInt(choice) - 1;
        agentId = idx >= 0 && idx < (agents as any[]).length
          ? (agents as any[])[idx].id
          : choice;
      }

      // Display configuration
      info(`Agent:    ${agentId}`);
      info(`Convex:   ${convexUrl}`);
      info(`Mode:     ${opts.webhookUrl ? 'Webhook' : 'Long-polling'}`);
      info(`Log:      ${opts.logLevel}`);
      console.log();

      // Dynamically import the TelegramChannel from core
      // We use dynamic import because the core package may not be installed
      // in all environments, and we want to give a helpful error message.
      let TelegramChannel: any;
      try {
        // Use string variable to avoid TS2307 — this is a dynamic import for an optional peer
        const corePkg = '@agentforge-ai/core/channels/telegram';
        const mod = await import(/* @vite-ignore */ corePkg);
        TelegramChannel = mod.TelegramChannel;
      } catch (importError: any) {
        // Fallback: try to use the Convex HTTP API directly with a minimal implementation
        error('Could not import @agentforge-ai/core. Using built-in Telegram runner.');
        dim(`  Error: ${importError.message}`);
        console.log();

        // Use the built-in minimal runner
        await runMinimalTelegramBot({
          botToken,
          agentId,
          convexUrl,
          logLevel: opts.logLevel,
          pollingIntervalMs: parseInt(opts.pollingInterval),
        });
        return;
      }

      // Start the Telegram channel
      try {
        const channel = new TelegramChannel({
          botToken,
          agentId,
          convexUrl,
          useWebhook: !!opts.webhookUrl,
          webhookUrl: opts.webhookUrl,
          webhookSecret: opts.webhookSecret,
          botUsername: opts.botUsername,
          groupMentionOnly: opts.groupMentionOnly,
          pollingIntervalMs: parseInt(opts.pollingInterval),
          logLevel: opts.logLevel,
        });

        await channel.start();
        success('Telegram bot is running!');
        dim('  Press Ctrl+C to stop.');

        // Keep the process alive
        await new Promise(() => {});
      } catch (startError: any) {
        error(`Failed to start Telegram bot: ${startError.message}`);
        process.exit(1);
      }
    });

  // ─── Configure ─────────────────────────────────────────────────────
  channel
    .command('configure')
    .description('Configure the Telegram bot token and settings')
    .action(async () => {
      header('Configure Telegram Channel');

      const currentToken = readEnvValue('TELEGRAM_BOT_TOKEN');
      if (currentToken) {
        const masked = currentToken.slice(0, 6) + '****' + currentToken.slice(-4);
        info(`Current token: ${masked}`);
      }

      console.log();
      info('To get a bot token:');
      dim('  1. Open Telegram and search for @BotFather');
      dim('  2. Send /newbot and follow the instructions');
      dim('  3. Copy the token provided');
      console.log();

      const token = await prompt('Telegram Bot Token: ');
      if (!token) {
        error('Bot token is required.');
        process.exit(1);
      }

      // Validate the token by calling getMe
      info('Validating token...');
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const data = await response.json() as { ok: boolean; result?: { username: string; first_name: string } };
        if (!data.ok) {
          error('Invalid bot token. Please check and try again.');
          process.exit(1);
        }
        success(`Bot verified: @${data.result?.username} (${data.result?.first_name})`);

        // Save bot username too
        if (data.result?.username) {
          writeEnvValue('TELEGRAM_BOT_USERNAME', data.result.username);
        }
      } catch (fetchError: any) {
        warn(`Could not validate token (network error): ${fetchError.message}`);
        info('Saving token anyway. You can validate later with: agentforge channel:telegram status');
      }

      writeEnvValue('TELEGRAM_BOT_TOKEN', token);
      success('Token saved to .env.local');

      // Ask for default agent
      console.log();
      const defaultAgent = await prompt('Default agent ID (optional, press Enter to skip): ');
      if (defaultAgent) {
        writeEnvValue('AGENTFORGE_AGENT_ID', defaultAgent);
        success(`Default agent set to: ${defaultAgent}`);
      }

      console.log();
      success('Configuration complete!');
      info('Start the bot with: agentforge channel:telegram start');
    });

  // ─── Status ────────────────────────────────────────────────────────
  channel
    .command('status')
    .description('Check the Telegram bot configuration and connectivity')
    .action(async () => {
      header('Telegram Channel Status');

      const token = readEnvValue('TELEGRAM_BOT_TOKEN');
      const agentId = readEnvValue('AGENTFORGE_AGENT_ID');
      const convexUrl = readEnvValue('CONVEX_URL');
      const botUsername = readEnvValue('TELEGRAM_BOT_USERNAME');

      const statusData: Record<string, string> = {
        'Bot Token': token ? `${token.slice(0, 6)}****${token.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
        'Bot Username': botUsername ? `@${botUsername}` : `${colors.dim}Unknown${colors.reset}`,
        'Default Agent': agentId || `${colors.dim}Not set${colors.reset}`,
        'Convex URL': convexUrl || `${colors.red}Not configured${colors.reset}`,
      };

      details(statusData);

      // Validate token if present
      if (token) {
        info('Checking bot connectivity...');
        try {
          const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
          const data = await response.json() as { ok: boolean; result?: { username: string; first_name: string; id: number } };
          if (data.ok) {
            success(`Bot online: @${data.result?.username} (ID: ${data.result?.id})`);
          } else {
            error('Bot token is invalid or expired.');
          }
        } catch {
          warn('Could not reach Telegram API (network error).');
        }
      }

      // Check Convex connectivity
      if (convexUrl) {
        info('Checking Convex connectivity...');
        try {
          const client = await createClient();
          const agents = await client.query('agents:list' as any, {});
          success(`Convex connected. ${(agents as any[]).length} agents available.`);
        } catch {
          warn('Could not reach Convex deployment.');
        }
      }
    });
}

// =====================================================
// Minimal Built-in Telegram Bot Runner
// =====================================================

/**
 * A minimal Telegram bot runner that works without the @agentforge-ai/core
 * package. Uses the Telegram Bot API and Convex HTTP API directly.
 *
 * This is a fallback for when the core package isn't available
 * (e.g., in a fresh project before building).
 */
async function runMinimalTelegramBot(config: {
  botToken: string;
  agentId: string;
  convexUrl: string;
  logLevel?: string;
  pollingIntervalMs?: number;
}): Promise<void> {
  const { botToken, agentId, convexUrl } = config;
  const apiBase = `https://api.telegram.org/bot${botToken}`;
  const convexBase = convexUrl.replace(/\/$/, '');
  const threadMap = new Map<string, string>();
  let lastUpdateId = 0;

  // Verify bot
  info('Verifying bot token...');
  const meRes = await fetch(`${apiBase}/getMe`);
  const meData = await meRes.json() as { ok: boolean; result?: { username: string } };
  if (!meData.ok) {
    error('Invalid bot token.');
    process.exit(1);
  }
  success(`Bot connected: @${meData.result?.username}`);

  // Delete any existing webhook
  await fetch(`${apiBase}/deleteWebhook`, { method: 'POST' });

  info('Polling for messages...');
  dim('  Press Ctrl+C to stop.');
  console.log();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping...');
    process.exit(0);
  });

  // Convex HTTP helpers
  async function convexMutation(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${convexBase}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fn, args }),
    });
    const data = await res.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') throw new Error(data.errorMessage);
    return data.value;
  }

  async function convexAction(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${convexBase}/api/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fn, args }),
    });
    const data = await res.json() as { value?: unknown; status?: string; errorMessage?: string };
    if (data.status === 'error') throw new Error(data.errorMessage);
    return data.value;
  }

  async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
    await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  async function sendTyping(chatId: string): Promise<void> {
    await fetch(`${apiBase}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    }).catch(() => {});
  }

  async function getOrCreateThread(chatId: string, senderName?: string): Promise<string> {
    const cached = threadMap.get(chatId);
    if (cached) return cached;

    const threadId = await convexMutation('chat:createThread', {
      agentId,
      name: senderName ? `Telegram: ${senderName}` : `Telegram Chat ${chatId}`,
      userId: `telegram:${chatId}`,
    }) as string;

    threadMap.set(chatId, threadId);
    return threadId;
  }

  // Poll loop
  while (true) {
    try {
      const res = await fetch(`${apiBase}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offset: lastUpdateId + 1,
          timeout: 30,
          allowed_updates: ['message'],
        }),
      });

      const data = await res.json() as { ok: boolean; result?: any[] };
      if (!data.ok || !data.result) continue;

      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg?.text) continue;

        const chatId = String(msg.chat.id);
        const senderName = msg.from?.first_name || 'User';
        const text = msg.text.trim();

        // Handle commands
        if (text === '/start') {
          threadMap.delete(chatId);
          await sendTelegramMessage(chatId, `👋 Welcome! I'm powered by AgentForge.\n\nSend me a message and I'll respond using AI.\n\nCommands:\n/new — Start a new conversation\n/help — Show help`);
          continue;
        }
        if (text === '/new') {
          threadMap.delete(chatId);
          await sendTelegramMessage(chatId, '🔄 New conversation started. Send me a message!');
          continue;
        }
        if (text === '/help') {
          await sendTelegramMessage(chatId, '🤖 AgentForge Telegram Bot\n\nJust send me a message and I\'ll respond using AI.\n\nCommands:\n/start — Reset and show welcome\n/new — Start a fresh conversation\n/help — Show this help');
          continue;
        }

        // Route to agent
        console.log(`[${senderName}] ${text}`);
        await sendTyping(chatId);

        try {
          const threadId = await getOrCreateThread(chatId, senderName);
          const result = await convexAction('chat:sendMessage', {
            agentId,
            threadId,
            content: text,
            userId: `telegram:${msg.from?.id || chatId}`,
          }) as { response: string };

          if (result?.response) {
            // Split long messages
            const response = result.response;
            if (response.length <= 4096) {
              await sendTelegramMessage(chatId, response);
            } else {
              const chunks = response.match(/.{1,4096}/gs) || [];
              for (const chunk of chunks) {
                await sendTelegramMessage(chatId, chunk);
              }
            }
            console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
          } else {
            await sendTelegramMessage(chatId, '🤔 I couldn\'t generate a response. Please try again.');
          }
        } catch (routeError: any) {
          console.error(`Error: ${routeError.message}`);
          await sendTelegramMessage(chatId, '⚠️ Sorry, I encountered an error. Please try again.');
        }
      }
    } catch (pollError: any) {
      if (pollError.message?.includes('ECONNREFUSED') || pollError.message?.includes('fetch failed')) {
        warn('Network error. Retrying in 5s...');
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error(`Poll error: ${pollError.message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}
