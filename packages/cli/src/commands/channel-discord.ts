/**
 * CLI Command: agentforge channel:discord
 *
 * Configure and start a Discord bot that routes messages through
 * the AgentForge agent execution pipeline using discord.js.
 *
 * Usage:
 *   agentforge channel:discord start --agent <id> [--token <bot-token>]
 *   agentforge channel:discord configure
 *   agentforge channel:discord status
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

export function registerChannelDiscordCommand(program: Command) {
  const channel = program
    .command('channel:discord')
    .description('Manage the Discord messaging channel');

  // ─── Start ─────────────────────────────────────────────────────────
  channel
    .command('start')
    .description('Start the Discord bot and begin routing messages to an agent')
    .option('-a, --agent <id>', 'Agent ID to route messages to')
    .option('-t, --token <token>', 'Discord Bot Token (overrides .env)')
    .option('--client-id <id>', 'Discord Client ID (for slash commands)')
    .option('--guild-id <id>', 'Discord Guild ID for guild-specific commands')
    .option('--mention-only', 'Only respond to @mentions in servers', false)
    .option('--no-dms', 'Disable DM responses')
    .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
    .action(async (opts) => {
      header('Discord Channel');

      // Resolve bot token
      const botToken = opts.token || readEnvValue('DISCORD_BOT_TOKEN') || process.env.DISCORD_BOT_TOKEN;
      if (!botToken) {
        error('Discord Bot Token not found.');
        info('Set it with: agentforge channel:discord configure');
        info('Or pass it with: --token <bot-token>');
        info('Or set DISCORD_BOT_TOKEN in your .env.local file');
        process.exit(1);
      }

      // Validate bot token format
      if (!botToken.startsWith('Bot ')) {
        warn('Bot token should start with "Bot ". Attempting to continue...');
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
      info(`Agent:       ${agentId}`);
      info(`Convex:      ${convexUrl}`);
      info(`Mention Only:${opts.mentionOnly ? ' Yes' : ' No'}`);
      info(`DMs:         ${opts.dms ? ' Disabled' : ' Enabled'}`);
      info(`Log:         ${opts.logLevel}`);
      console.log();

      // Dynamically import the DiscordChannel from channels-discord
      let startDiscordChannel: any;
      try {
        const discordPkg = '@agentforge-ai/core';
        const mod = await import(/* @vite-ignore */ discordPkg);
        startDiscordChannel = mod.startDiscordChannel;
      } catch (importError: any) {
        // Fallback: use the built-in minimal runner
        error('Could not import @agentforge-ai/core. Using built-in Discord runner.');
        dim(`  Error: ${importError.message}`);
        console.log();

        await runMinimalDiscordBot({
          botToken,
          clientId: opts.clientId || readEnvValue('DISCORD_CLIENT_ID') || '',
          guildId: opts.guildId || readEnvValue('DISCORD_GUILD_ID') || '',
          agentId,
          convexUrl,
          mentionOnly: opts.mentionOnly,
          respondToDMs: !opts.noDms,
          logLevel: opts.logLevel,
        });
        return;
      }

      // Start the Discord channel
      try {
        await startDiscordChannel({
          botToken,
          clientId: opts.clientId,
          guildId: opts.guildId,
          agentId,
          convexUrl,
          mentionOnly: opts.mentionOnly,
          respondToDMs: !opts.noDms,
          logLevel: opts.logLevel,
        });

        success('Discord bot is running!');
        dim('  Press Ctrl+C to stop.');

        // Keep the process alive
        await new Promise(() => {});
      } catch (startError: any) {
        error(`Failed to start Discord bot: ${startError.message}`);
        process.exit(1);
      }
    });

  // ─── Configure ─────────────────────────────────────────────────────
  channel
    .command('configure')
    .description('Configure the Discord bot credentials and settings')
    .action(async () => {
      header('Configure Discord Channel');

      console.log();
      info('To set up a Discord bot:');
      dim('  1. Go to https://discord.com/developers/applications and create a new application');
      dim('  2. Create a bot user under the "Bot" section');
      dim('  3. Enable "MESSAGE CONTENT INTENT" under Privileged Gateway Intents');
      dim('  4. Copy the bot token');
      dim('  5. (Optional) Copy the Client ID for slash commands');
      console.log();

      // Bot Token
      const currentBotToken = readEnvValue('DISCORD_BOT_TOKEN');
      if (currentBotToken) {
        const masked = currentBotToken.slice(0, 10) + '****' + currentBotToken.slice(-4);
        info(`Current bot token: ${masked}`);
      }

      const botToken = await prompt('Discord Bot Token: ');
      if (!botToken) {
        error('Bot token is required.');
        process.exit(1);
      }

      // Validate the bot token via Discord API
      info('Validating bot token...');
      try {
        const response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json() as { username: string; id: string };
          success(`Bot verified: ${data.username} (${data.id})`);
        } else if (response.status === 401) {
          error('Invalid bot token. Please check and try again.');
          process.exit(1);
        } else {
          warn(`Token validation returned status ${response.status}. Saving anyway.`);
        }
      } catch (fetchError: any) {
        warn(`Could not validate token (network error): ${fetchError.message}`);
        info('Saving token anyway.');
      }

      // Add "Bot " prefix if not present
      const formattedToken = botToken.startsWith('Bot ') ? botToken : `Bot ${botToken}`;
      writeEnvValue('DISCORD_BOT_TOKEN', formattedToken);
      success('Bot token saved to .env.local');

      // Client ID (optional)
      console.log();
      const currentClientId = readEnvValue('DISCORD_CLIENT_ID');
      if (currentClientId) {
        info(`Current client ID: ${currentClientId}`);
      }

      const clientId = await prompt('Discord Client ID (optional, for slash commands, press Enter to skip): ');
      if (clientId) {
        writeEnvValue('DISCORD_CLIENT_ID', clientId);
        success('Client ID saved to .env.local');
      }

      // Guild ID (optional)
      console.log();
      const guildId = await prompt('Discord Guild ID (optional, for guild-specific commands, press Enter to skip): ');
      if (guildId) {
        writeEnvValue('DISCORD_GUILD_ID', guildId);
        success('Guild ID saved to .env.local');
      }

      // Default agent
      console.log();
      const defaultAgent = await prompt('Default agent ID (optional, press Enter to skip): ');
      if (defaultAgent) {
        writeEnvValue('AGENTFORGE_AGENT_ID', defaultAgent);
        success(`Default agent set to: ${defaultAgent}`);
      }

      console.log();
      success('Configuration complete!');
      info('Start the bot with: agentforge channel:discord start');
    });

  // ─── Status ────────────────────────────────────────────────────────
  channel
    .command('status')
    .description('Check the Discord bot configuration and connectivity')
    .action(async () => {
      header('Discord Channel Status');

      const botToken = readEnvValue('DISCORD_BOT_TOKEN');
      const clientId = readEnvValue('DISCORD_CLIENT_ID');
      const guildId = readEnvValue('DISCORD_GUILD_ID');
      const agentId = readEnvValue('AGENTFORGE_AGENT_ID');
      const convexUrl = readEnvValue('CONVEX_URL');

      const statusData: Record<string, string> = {
        'Bot Token': botToken ? `${botToken.slice(0, 10)}****${botToken.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
        'Client ID': clientId || `${colors.dim}Not set${colors.reset}`,
        'Guild ID': guildId || `${colors.dim}Not set${colors.reset}`,
        'Default Agent': agentId || `${colors.dim}Not set${colors.reset}`,
        'Convex URL': convexUrl || `${colors.red}Not configured${colors.reset}`,
      };

      details(statusData);

      // Validate bot token if present
      if (botToken) {
        info('Checking Discord API connectivity...');
        try {
          const response = await fetch('https://discord.com/api/v10/users/@me', {
            headers: {
              Authorization: botToken.startsWith('Bot ') ? botToken : `Bot ${botToken}`,
              'Content-Type': 'application/json',
            },
          });
          if (response.ok) {
            const data = await response.json() as { username: string; id: string; discriminator: string };
            success(`Discord API connected: ${data.username}${data.discriminator !== '0' ? `#${data.discriminator}` : ''} (${data.id})`);
          } else if (response.status === 401) {
            error('Invalid bot token.');
          } else {
            error(`Discord API error: ${response.status}`);
          }
        } catch {
          warn('Could not reach Discord API (network error).');
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
// Minimal Built-in Discord Bot Runner
// =====================================================

/**
 * A minimal Discord bot runner that works without the @agentforge-ai/core
 * package. Uses Discord.js and Convex HTTP API directly.
 *
 * This is a fallback for when the channels-discord package isn't available.
 */
export async function runMinimalDiscordBot(config: {
  botToken: string;
  clientId: string;
  guildId: string;
  agentId: string;
  convexUrl: string;
  mentionOnly?: boolean;
  respondToDMs?: boolean;
  logLevel?: string;
}): Promise<void> {
  const { botToken, agentId, convexUrl, mentionOnly, respondToDMs } = config;
  const convexBase = convexUrl.replace(/\/$/, '');
  const threadMap = new Map<string, string>();

  // Verify bot token
  info('Verifying Discord bot token...');
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: botToken.startsWith('Bot ') ? botToken : `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json() as { username: string; id: string; error?: string };
    if (data.error) {
      error(`Discord auth error: ${data.error}`);
      process.exit(1);
    }
    success(`Discord bot connected: ${data.username} (${data.id})`);
  } catch (fetchError: any) {
    warn(`Could not verify bot token: ${fetchError.message}`);
    info('Continuing anyway...');
  }

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

  async function sendDiscordMessage(channelId: string, text: string): Promise<void> {
    // Discord has a 2000 character limit
    const messages = text.match(/.{1,1900}/gs) || [''];
    for (const msg of messages) {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: botToken.startsWith('Bot ') ? botToken : `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: msg }),
      });
    }
  }

  async function getOrCreateThread(channelThreadKey: string, senderName?: string): Promise<string> {
    const cached = threadMap.get(channelThreadKey);
    if (cached) return cached;

    const threadId = await convexMutation('chat:createThread', {
      agentId,
      name: senderName ? `Discord: ${senderName}` : `Discord ${channelThreadKey}`,
      userId: `discord:${channelThreadKey}`,
    }) as string;

    threadMap.set(channelThreadKey, threadId);
    return threadId;
  }

  async function handleDiscordMessage(message: any): Promise<void> {
    // Skip bot messages
    if (message.author.bot) return;

    // Check mention filter for guild messages
    if (mentionOnly && message.guild) {
      const botMentioned = message.mentions?.users?.some((u: any) => u.bot === true);
      if (!botMentioned) {
        return; // Skip if not mentioned
      }
      // Strip bot mention from content
      if (message.content) {
        const mentionRegex = /<@!?[\d]+>/g;
        message.content = message.content.replace(mentionRegex, '').trim();
      }
    }

    // Skip DMs if disabled
    if (!respondToDMs && !message.guild) {
      return;
    }

    const channelId = message.channel_id;
    const userId = message.author.id;
    const username = message.author.username;
    const content = (message.content || '').trim();

    if (!content) return;

    const threadKey = `${channelId}:${userId}`;
    console.log(`[Discord:${channelId}] ${username}: ${content}`);

    try {
      const convexThreadId = await getOrCreateThread(threadKey, username);
      const result = await convexAction('chat:sendMessage', {
        agentId,
        threadId: convexThreadId,
        content,
        userId: `discord:${userId}`,
      }) as { response: string };

      if (result?.response) {
        const response = result.response;
        await sendDiscordMessage(channelId, response);
        console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
      } else {
        await sendDiscordMessage(channelId, "I couldn't generate a response. Please try again.");
      }
    } catch (routeError: any) {
      console.error(`Error: ${routeError.message}`);
      await sendDiscordMessage(channelId, 'Sorry, I encountered an error. Please try again.');
    }
  }

  // Discord uses Gateway WebSocket protocol - we need a proper client
  // For this minimal runner, we'll use a simple polling approach
  // or recommend the user install the full discord.js package

  info('Starting Discord bot polling mode...');
  info('Note: For production use, install discord.js for full WebSocket support.');
  dim('  npm install discord.js');

  warn('Polling mode has limitations. Consider installing discord.js for full features.');
  info('Starting minimal HTTP-based bot (limited functionality)...');

  // Since we can't easily implement Discord Gateway without discord.js,
  // we'll provide instructions and use a simpler approach
  error('Discord bot requires discord.js package for full functionality.');
  info('Install it with: npm install discord.js');
  info('Then restart: agentforge channel:discord start');
  process.exit(1);
}
