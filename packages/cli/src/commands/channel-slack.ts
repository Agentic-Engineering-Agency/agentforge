/**
 * CLI Command: agentforge channel:slack
 *
 * Configure and start a Slack bot that routes messages through
 * the AgentForge agent execution pipeline via Slack Bolt.js.
 *
 * Usage:
 *   agentforge channel:slack start --agent <id> [--bot-token <token>]
 *   agentforge channel:slack configure
 *   agentforge channel:slack status
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

export function registerChannelSlackCommand(program: Command) {
  const channel = program
    .command('channel:slack')
    .description('Manage the Slack messaging channel');

  // ─── Start ─────────────────────────────────────────────────────────
  channel
    .command('start')
    .description('Start the Slack bot and begin routing messages to an agent')
    .option('-a, --agent <id>', 'Agent ID to route messages to')
    .option('--bot-token <token>', 'Slack bot token (xoxb-...) (overrides .env)')
    .option('--app-token <token>', 'Slack app-level token (xapp-...) for socket mode (overrides .env)')
    .option('--signing-secret <secret>', 'Slack signing secret (overrides .env)')
    .option('--socket-mode', 'Enable socket mode (default: true)', true)
    .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
    .action(async (opts) => {
      header('Slack Channel');

      // Resolve bot token
      const botToken = opts.botToken || readEnvValue('SLACK_BOT_TOKEN') || process.env.SLACK_BOT_TOKEN;
      if (!botToken) {
        error('Slack Bot Token not found.');
        info('Set it with: agentforge channel:slack configure');
        info('Or pass it with: --bot-token <token>');
        info('Or set SLACK_BOT_TOKEN in your .env.local file');
        process.exit(1);
      }

      // Resolve app token (required for socket mode)
      const appToken = opts.appToken || readEnvValue('SLACK_APP_TOKEN') || process.env.SLACK_APP_TOKEN;
      if (opts.socketMode && !appToken) {
        error('Slack App Token not found (required for socket mode).');
        info('Set it with: agentforge channel:slack configure');
        info('Or pass it with: --app-token <token>');
        info('Or set SLACK_APP_TOKEN in your .env.local file');
        info('Or disable socket mode with: --no-socket-mode');
        process.exit(1);
      }

      // Resolve signing secret
      const signingSecret = opts.signingSecret || readEnvValue('SLACK_SIGNING_SECRET') || process.env.SLACK_SIGNING_SECRET;
      if (!signingSecret) {
        error('Slack Signing Secret not found.');
        info('Set it with: agentforge channel:slack configure');
        info('Or pass it with: --signing-secret <secret>');
        info('Or set SLACK_SIGNING_SECRET in your .env.local file');
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
      info(`Mode:        ${opts.socketMode ? 'Socket Mode' : 'Events API'}`);
      info(`Log:         ${opts.logLevel}`);
      console.log();

      // Dynamically import the SlackChannel from channels-slack
      let startSlackChannel: any;
      try {
        const slackPkg = '@agentforge-ai/core';
        const mod = await import(/* @vite-ignore */ slackPkg);
        startSlackChannel = mod.startSlackChannel;
      } catch (importError: any) {
        // Fallback: use the built-in minimal runner
        error('Could not import @agentforge-ai/core. Using built-in Slack runner.');
        dim(`  Error: ${importError.message}`);
        console.log();

        await runMinimalSlackBot({
          botToken,
          appToken: appToken || '',
          signingSecret,
          agentId,
          convexUrl,
          socketMode: opts.socketMode,
          logLevel: opts.logLevel,
        });
        return;
      }

      // Start the Slack channel
      try {
        await startSlackChannel({
          botToken,
          appToken,
          signingSecret,
          agentId,
          convexUrl,
          socketMode: opts.socketMode,
          logLevel: opts.logLevel,
        });

        success('Slack bot is running!');
        dim('  Press Ctrl+C to stop.');

        // Keep the process alive
        await new Promise(() => {});
      } catch (startError: any) {
        error(`Failed to start Slack bot: ${startError.message}`);
        process.exit(1);
      }
    });

  // ─── Configure ─────────────────────────────────────────────────────
  channel
    .command('configure')
    .description('Configure the Slack bot credentials and settings')
    .action(async () => {
      header('Configure Slack Channel');

      console.log();
      info('To set up a Slack app:');
      dim('  1. Go to https://api.slack.com/apps and create a new app');
      dim('  2. Enable Socket Mode under Settings > Socket Mode');
      dim('  3. Add bot scopes: chat:write, im:history, im:read, channels:history');
      dim('  4. Install the app to your workspace');
      dim('  5. Copy the Bot Token, App-Level Token, and Signing Secret');
      console.log();

      // Bot Token
      const currentBotToken = readEnvValue('SLACK_BOT_TOKEN');
      if (currentBotToken) {
        const masked = currentBotToken.slice(0, 8) + '****' + currentBotToken.slice(-4);
        info(`Current bot token: ${masked}`);
      }

      const botToken = await prompt('Slack Bot Token (xoxb-...): ');
      if (!botToken) {
        error('Bot token is required.');
        process.exit(1);
      }

      if (!botToken.startsWith('xoxb-')) {
        warn('Bot token should start with "xoxb-". Please verify this is correct.');
      }

      // Validate the bot token via auth.test
      info('Validating bot token...');
      try {
        const response = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${botToken}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json() as {
          ok: boolean;
          team?: string;
          user?: string;
          bot_id?: string;
          error?: string;
        };
        if (!data.ok) {
          warn(`Token validation warning: ${data.error}`);
          info('Saving token anyway. You can validate later with: agentforge channel:slack status');
        } else {
          success(`Bot verified: @${data.user} in workspace "${data.team}"`);
        }
      } catch (fetchError: any) {
        warn(`Could not validate token (network error): ${fetchError.message}`);
        info('Saving token anyway.');
      }

      writeEnvValue('SLACK_BOT_TOKEN', botToken);
      success('Bot token saved to .env.local');

      // App Token
      console.log();
      const currentAppToken = readEnvValue('SLACK_APP_TOKEN');
      if (currentAppToken) {
        const masked = currentAppToken.slice(0, 8) + '****' + currentAppToken.slice(-4);
        info(`Current app token: ${masked}`);
      }

      const appToken = await prompt('Slack App-Level Token (xapp-..., for socket mode): ');
      if (!appToken) {
        warn('App-level token not provided. Socket mode will not be available.');
      } else {
        if (!appToken.startsWith('xapp-')) {
          warn('App token should start with "xapp-". Please verify this is correct.');
        }
        writeEnvValue('SLACK_APP_TOKEN', appToken);
        success('App token saved to .env.local');
      }

      // Signing Secret
      console.log();
      const currentSigningSecret = readEnvValue('SLACK_SIGNING_SECRET');
      if (currentSigningSecret) {
        info(`Current signing secret: ${currentSigningSecret.slice(0, 6)}****`);
      }

      const signingSecret = await prompt('Slack Signing Secret: ');
      if (!signingSecret) {
        error('Signing secret is required.');
        process.exit(1);
      }

      if (signingSecret.length < 20) {
        warn('Signing secret looks too short. Please verify this is correct.');
      }

      writeEnvValue('SLACK_SIGNING_SECRET', signingSecret);
      success('Signing secret saved to .env.local');

      // Default agent
      console.log();
      const defaultAgent = await prompt('Default agent ID (optional, press Enter to skip): ');
      if (defaultAgent) {
        writeEnvValue('AGENTFORGE_AGENT_ID', defaultAgent);
        success(`Default agent set to: ${defaultAgent}`);
      }

      console.log();
      success('Configuration complete!');
      info('Start the bot with: agentforge channel:slack start');
    });

  // ─── Status ────────────────────────────────────────────────────────
  channel
    .command('status')
    .description('Check the Slack bot configuration and connectivity')
    .action(async () => {
      header('Slack Channel Status');

      const botToken = readEnvValue('SLACK_BOT_TOKEN');
      const appToken = readEnvValue('SLACK_APP_TOKEN');
      const signingSecret = readEnvValue('SLACK_SIGNING_SECRET');
      const agentId = readEnvValue('AGENTFORGE_AGENT_ID');
      const convexUrl = readEnvValue('CONVEX_URL');

      const statusData: Record<string, string> = {
        'Bot Token': botToken ? `${botToken.slice(0, 8)}****${botToken.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
        'App Token': appToken ? `${appToken.slice(0, 8)}****${appToken.slice(-4)}` : `${colors.dim}Not set${colors.reset}`,
        'Signing Secret': signingSecret ? `${signingSecret.slice(0, 6)}****` : `${colors.red}Not configured${colors.reset}`,
        'Default Agent': agentId || `${colors.dim}Not set${colors.reset}`,
        'Convex URL': convexUrl || `${colors.red}Not configured${colors.reset}`,
      };

      details(statusData);

      // Validate bot token if present
      if (botToken) {
        info('Checking Slack API connectivity...');
        try {
          const response = await fetch('https://slack.com/api/auth.test', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${botToken}`,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json() as {
            ok: boolean;
            team?: string;
            user?: string;
            team_id?: string;
            bot_id?: string;
            error?: string;
          };
          if (data.ok) {
            success(`Slack API connected: @${data.user} in workspace "${data.team}" (${data.team_id})`);
          } else {
            error(`Slack API error: ${data.error}`);
          }
        } catch {
          warn('Could not reach Slack API (network error).');
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
// Minimal Built-in Slack Bot Runner
// =====================================================

/**
 * A minimal Slack bot runner that works without the @agentforge-ai/core
 * package. Uses the Slack Web API and Convex HTTP API directly.
 *
 * This is a fallback for when the channels-slack package isn't available
 * (e.g., in a fresh project before building).
 *
 * Uses Socket Mode via the Slack Events API if an app token is provided,
 * otherwise falls back to a basic HTTP server for the Events API.
 */
export async function runMinimalSlackBot(config: {
  botToken: string;
  appToken: string;
  signingSecret: string;
  agentId: string;
  convexUrl: string;
  socketMode?: boolean;
  logLevel?: string;
}): Promise<void> {
  const { botToken, appToken, signingSecret, agentId, convexUrl } = config;
  const convexBase = convexUrl.replace(/\/$/, '');
  const threadMap = new Map<string, string>();

  // Verify bot token
  info('Verifying Slack bot token...');
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json() as { ok: boolean; team?: string; user?: string; error?: string };
    if (!data.ok) {
      error(`Slack auth error: ${data.error}`);
      process.exit(1);
    }
    success(`Slack bot connected: @${data.user} in "${data.team}"`);
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

  async function sendSlackMessage(channel: string, text: string, threadTs?: string): Promise<void> {
    const body: Record<string, unknown> = { channel, text };
    if (threadTs) body.thread_ts = threadTs;

    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async function getOrCreateThread(channelThreadKey: string, senderName?: string): Promise<string> {
    const cached = threadMap.get(channelThreadKey);
    if (cached) return cached;

    const threadId = await convexMutation('chat:createThread', {
      agentId,
      name: senderName ? `Slack: ${senderName}` : `Slack ${channelThreadKey}`,
      userId: `slack:${channelThreadKey}`,
    }) as string;

    threadMap.set(channelThreadKey, threadId);
    return threadId;
  }

  async function handleSlackMessage(event: any): Promise<void> {
    if (event.bot_id || event.subtype) return;

    const channelId = event.channel;
    const userId = event.user;
    const text = (event.text || '').trim();
    const threadTs = event.thread_ts || event.ts;

    if (!text) return;

    const threadKey = `${channelId}:${userId}`;
    console.log(`[Slack:${channelId}] ${text}`);

    try {
      const convexThreadId = await getOrCreateThread(threadKey, `slack:${userId}`);
      const result = await convexAction('chat:sendMessage', {
        agentId,
        threadId: convexThreadId,
        content: text,
        userId: `slack:${userId}`,
      }) as { response: string };

      if (result?.response) {
        const response = result.response;
        // Split long messages at 4000 chars (Slack's limit)
        if (response.length <= 4000) {
          await sendSlackMessage(channelId, response, threadTs);
        } else {
          const chunks = response.match(/.{1,4000}/gs) || [];
          for (const chunk of chunks) {
            await sendSlackMessage(channelId, chunk, threadTs);
          }
        }
        console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
      } else {
        await sendSlackMessage(channelId, "I couldn't generate a response. Please try again.", threadTs);
      }
    } catch (routeError: any) {
      console.error(`Error: ${routeError.message}`);
      await sendSlackMessage(channelId, 'Sorry, I encountered an error. Please try again.', threadTs);
    }
  }

  // If app token is available, use Socket Mode
  if (appToken && config.socketMode !== false) {
    info('Starting in Socket Mode...');

    try {
      // Attempt to connect via Slack Socket Mode WebSocket
      const wsUrlRes = await fetch('https://slack.com/api/apps.connections.open', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appToken}`,
          'Content-Type': 'application/json',
        },
      });
      const wsData = await wsUrlRes.json() as { ok: boolean; url?: string; error?: string };

      if (!wsData.ok || !wsData.url) {
        throw new Error(`Could not open WebSocket connection: ${wsData.error}`);
      }

      const { default: WebSocket } = await import('ws' as any);
      const ws = new WebSocket(wsData.url);

      ws.on('open', () => {
        success('Socket Mode connected!');
        dim('  Listening for messages. Press Ctrl+C to stop.');
        console.log();
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const payload = JSON.parse(data.toString());

          // Acknowledge the event
          if (payload.envelope_id) {
            ws.send(JSON.stringify({ envelope_id: payload.envelope_id }));
          }

          // Handle events
          if (payload.type === 'events_api' && payload.payload?.event) {
            const event = payload.payload.event;
            if (event.type === 'message') {
              await handleSlackMessage(event);
            }
          }

          // Handle slash commands
          if (payload.type === 'slash_commands' && payload.payload) {
            const slashPayload = payload.payload;
            const command = slashPayload.command;
            const channelId = slashPayload.channel_id;
            const userId = slashPayload.user_id;
            const text = slashPayload.text || '';

            if (command === '/start' || command === '/new') {
              const key = `${channelId}:${userId}`;
              threadMap.delete(key);
              await sendSlackMessage(channelId, 'New conversation started! Send me a message.');
            } else if (command === '/help') {
              await sendSlackMessage(channelId, 'AgentForge Slack Bot\n\nJust send me a message and I\'ll respond using AI.\n\nCommands:\n/start — Reset and start fresh\n/new — Start a fresh conversation\n/help — Show this help\n/ask <question> — Ask a question');
            } else if (command === '/ask') {
              await handleSlackMessage({ channel: channelId, user: userId, text, ts: Date.now().toString() });
            }
          }
        } catch (parseError: any) {
          console.error(`Error processing message: ${parseError.message}`);
        }
      });

      ws.on('close', (code: number) => {
        warn(`Socket Mode disconnected (code: ${code}). Reconnecting in 5s...`);
        setTimeout(() => runMinimalSlackBot(config), 5000);
      });

      ws.on('error', (err: Error) => {
        console.error(`WebSocket error: ${err.message}`);
      });

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\nStopping...');
        ws.close();
        process.exit(0);
      });

      // Keep alive
      await new Promise(() => {});
    } catch (socketError: any) {
      warn(`Socket Mode failed: ${socketError.message}`);
      info('Falling back to HTTP Events API server...');
    }
  }

  // Fallback: HTTP server for Events API
  info('Starting HTTP server for Events API...');
  const port = 3002;
  const path_ = '/slack/events';

  const http = await import('node:http');
  const { createHmac, timingSafeEqual } = await import('node:crypto');

  function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
    const sigBaseString = `v0:${timestamp}:${body}`;
    const hmac = createHmac('sha256', signingSecret);
    hmac.update(sigBaseString);
    const computedSig = `v0=${hmac.digest('hex')}`;
    try {
      return timingSafeEqual(Buffer.from(computedSig), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);

    if (url.pathname !== path_) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks).toString();

      // Verify Slack signature
      const timestamp = req.headers['x-slack-request-timestamp'] as string;
      const signature = req.headers['x-slack-signature'] as string;

      if (timestamp && signature && signingSecret) {
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp)) > 300) {
          res.writeHead(403);
          res.end('Request too old');
          return;
        }

        if (!verifySlackSignature(rawBody, timestamp, signature)) {
          res.writeHead(403);
          res.end('Invalid signature');
          return;
        }
      }

      const body = JSON.parse(rawBody);

      // Handle URL verification challenge
      if (body.type === 'url_verification') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ challenge: body.challenge }));
        return;
      }

      // Acknowledge immediately
      res.writeHead(200);
      res.end('OK');

      // Handle message events
      if (body.type === 'event_callback' && body.event?.type === 'message') {
        await handleSlackMessage(body.event);
      }
    } catch (parseError: any) {
      console.error(`Parse error: ${parseError.message}`);
      if (!res.headersSent) {
        res.writeHead(400);
        res.end('Bad Request');
      }
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping...');
    server.close();
    process.exit(0);
  });

  server.listen(port, () => {
    success(`Events API server listening on port ${port}`);
    info(`Events API URL: http://localhost:${port}${path_}`);
    console.log();
    info('Next steps:');
    dim('  1. Expose this URL publicly (e.g., ngrok http ' + port + ')');
    dim('  2. Configure the Events API URL in your Slack app settings');
    dim('  3. Subscribe to the "message.im" and "message.channels" events');
    dim('  Press Ctrl+C to stop.');
  });

  // Keep alive
  await new Promise(() => {});
}
