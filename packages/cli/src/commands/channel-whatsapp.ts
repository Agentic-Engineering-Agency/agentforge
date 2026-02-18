/**
 * CLI Command: agentforge channel:whatsapp
 *
 * Configure and start a WhatsApp webhook server that routes messages
 * through the AgentForge agent execution pipeline.
 *
 * Usage:
 *   agentforge channel:whatsapp start --agent <id> [--access-token <token>]
 *   agentforge channel:whatsapp configure
 *   agentforge channel:whatsapp status
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

export function registerChannelWhatsAppCommand(program: Command) {
  const channel = program
    .command('channel:whatsapp')
    .description('Manage the WhatsApp messaging channel');

  // ─── Start ─────────────────────────────────────────────────────────
  channel
    .command('start')
    .description('Start the WhatsApp webhook server and begin routing messages to an agent')
    .option('-a, --agent <id>', 'Agent ID to route messages to')
    .option('--access-token <token>', 'WhatsApp Cloud API access token (overrides .env)')
    .option('--phone-number-id <id>', 'WhatsApp Business Phone Number ID (overrides .env)')
    .option('--verify-token <token>', 'Webhook verify token (overrides .env)')
    .option('--webhook-port <port>', 'Port for the webhook server', '3001')
    .option('--webhook-path <path>', 'Path for the webhook endpoint', '/webhook/whatsapp')
    .option('--api-version <version>', 'WhatsApp Cloud API version', 'v21.0')
    .option('--log-level <level>', 'Log level: debug, info, warn, error', 'info')
    .action(async (opts) => {
      header('WhatsApp Channel');

      // Resolve access token
      const accessToken = opts.accessToken || readEnvValue('WHATSAPP_ACCESS_TOKEN') || process.env.WHATSAPP_ACCESS_TOKEN;
      if (!accessToken) {
        error('WhatsApp Access Token not found.');
        info('Set it with: agentforge channel:whatsapp configure');
        info('Or pass it with: --access-token <token>');
        info('Or set WHATSAPP_ACCESS_TOKEN in your .env.local file');
        process.exit(1);
      }

      // Resolve phone number ID
      const phoneNumberId = opts.phoneNumberId || readEnvValue('WHATSAPP_PHONE_NUMBER_ID') || process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!phoneNumberId) {
        error('WhatsApp Phone Number ID not found.');
        info('Set it with: agentforge channel:whatsapp configure');
        info('Or pass it with: --phone-number-id <id>');
        info('Or set WHATSAPP_PHONE_NUMBER_ID in your .env.local file');
        process.exit(1);
      }

      // Resolve verify token
      const verifyToken = opts.verifyToken || readEnvValue('WHATSAPP_VERIFY_TOKEN') || process.env.WHATSAPP_VERIFY_TOKEN;
      if (!verifyToken) {
        error('WhatsApp Verify Token not found.');
        info('Set it with: agentforge channel:whatsapp configure');
        info('Or pass it with: --verify-token <token>');
        info('Or set WHATSAPP_VERIFY_TOKEN in your .env.local file');
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
      const webhookPort = parseInt(opts.webhookPort);
      const webhookPath = opts.webhookPath;
      info(`Agent:       ${agentId}`);
      info(`Convex:      ${convexUrl}`);
      info(`Webhook:     http://localhost:${webhookPort}${webhookPath}`);
      info(`API Version: ${opts.apiVersion}`);
      info(`Log:         ${opts.logLevel}`);
      console.log();

      // Dynamically import the WhatsAppChannel from core
      let WhatsAppChannel: any;
      try {
        const corePkg = '@agentforge-ai/core/channels/whatsapp';
        const mod = await import(/* @vite-ignore */ corePkg);
        WhatsAppChannel = mod.WhatsAppChannel;
      } catch (importError: any) {
        // Fallback: use the built-in minimal runner
        error('Could not import @agentforge-ai/core. Using built-in WhatsApp runner.');
        dim(`  Error: ${importError.message}`);
        console.log();

        await runMinimalWhatsAppBot({
          accessToken,
          phoneNumberId,
          verifyToken,
          agentId,
          convexUrl,
          webhookPort,
          webhookPath,
          logLevel: opts.logLevel,
        });
        return;
      }

      // Start the WhatsApp channel
      try {
        const channel = new WhatsAppChannel({
          accessToken,
          phoneNumberId,
          verifyToken,
          agentId,
          convexUrl,
          webhookPort,
          webhookPath,
          apiVersion: opts.apiVersion,
          logLevel: opts.logLevel,
        });

        await channel.start();
        success('WhatsApp webhook server is running!');
        dim(`  Webhook URL: http://localhost:${webhookPort}${webhookPath}`);
        dim('  Configure this URL in your Meta App Dashboard.');
        dim('  Press Ctrl+C to stop.');

        // Keep the process alive
        await new Promise(() => {});
      } catch (startError: any) {
        error(`Failed to start WhatsApp channel: ${startError.message}`);
        process.exit(1);
      }
    });

  // ─── Configure ─────────────────────────────────────────────────────
  channel
    .command('configure')
    .description('Configure the WhatsApp Cloud API credentials')
    .action(async () => {
      header('Configure WhatsApp Channel');

      console.log();
      info('To set up WhatsApp Cloud API:');
      dim('  1. Go to https://developers.facebook.com/apps/');
      dim('  2. Create or select a Meta App with WhatsApp product');
      dim('  3. Go to WhatsApp > API Setup');
      dim('  4. Copy the Access Token, Phone Number ID, and set a Verify Token');
      console.log();

      // Access Token
      const currentToken = readEnvValue('WHATSAPP_ACCESS_TOKEN');
      if (currentToken) {
        const masked = currentToken.slice(0, 10) + '****' + currentToken.slice(-4);
        info(`Current access token: ${masked}`);
      }

      const accessToken = await prompt('WhatsApp Access Token: ');
      if (!accessToken) {
        error('Access token is required.');
        process.exit(1);
      }

      // Validate the token
      info('Validating access token...');
      try {
        const response = await fetch('https://graph.facebook.com/v21.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json() as { id?: string; name?: string; error?: { message: string } };
        if (data.error) {
          warn(`Token validation warning: ${data.error.message}`);
          info('Saving token anyway. You can validate later with: agentforge channel:whatsapp status');
        } else {
          success(`Token verified: ${data.name || data.id}`);
        }
      } catch (fetchError: any) {
        warn(`Could not validate token (network error): ${fetchError.message}`);
        info('Saving token anyway.');
      }

      writeEnvValue('WHATSAPP_ACCESS_TOKEN', accessToken);
      success('Access token saved to .env.local');

      // Phone Number ID
      console.log();
      const currentPhoneId = readEnvValue('WHATSAPP_PHONE_NUMBER_ID');
      if (currentPhoneId) {
        info(`Current Phone Number ID: ${currentPhoneId}`);
      }

      const phoneNumberId = await prompt('WhatsApp Phone Number ID: ');
      if (!phoneNumberId) {
        error('Phone Number ID is required.');
        process.exit(1);
      }

      // Validate the phone number ID
      info('Validating phone number...');
      try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json() as {
          display_phone_number?: string;
          verified_name?: string;
          error?: { message: string };
        };
        if (data.error) {
          warn(`Phone number validation warning: ${data.error.message}`);
        } else {
          success(`Phone number verified: ${data.display_phone_number} (${data.verified_name})`);
        }
      } catch {
        warn('Could not validate phone number (network error).');
      }

      writeEnvValue('WHATSAPP_PHONE_NUMBER_ID', phoneNumberId);
      success('Phone Number ID saved to .env.local');

      // Verify Token
      console.log();
      const currentVerifyToken = readEnvValue('WHATSAPP_VERIFY_TOKEN');
      if (currentVerifyToken) {
        info(`Current verify token: ${currentVerifyToken.slice(0, 6)}****`);
      }

      let verifyToken = await prompt('Webhook Verify Token (press Enter to auto-generate): ');
      if (!verifyToken) {
        // Auto-generate a verify token
        verifyToken = `agentforge_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        info(`Generated verify token: ${verifyToken}`);
      }

      writeEnvValue('WHATSAPP_VERIFY_TOKEN', verifyToken);
      success('Verify token saved to .env.local');

      // Default agent
      console.log();
      const defaultAgent = await prompt('Default agent ID (optional, press Enter to skip): ');
      if (defaultAgent) {
        writeEnvValue('AGENTFORGE_AGENT_ID', defaultAgent);
        success(`Default agent set to: ${defaultAgent}`);
      }

      console.log();
      success('Configuration complete!');
      info('Start the webhook server with: agentforge channel:whatsapp start');
      console.log();
      info('Next steps:');
      dim('  1. Start the webhook server: agentforge channel:whatsapp start');
      dim('  2. Expose the webhook URL (e.g., with ngrok or cloudflared)');
      dim('  3. Configure the webhook URL in your Meta App Dashboard');
      dim('  4. Subscribe to "messages" webhook field');
    });

  // ─── Status ────────────────────────────────────────────────────────
  channel
    .command('status')
    .description('Check the WhatsApp channel configuration and connectivity')
    .action(async () => {
      header('WhatsApp Channel Status');

      const accessToken = readEnvValue('WHATSAPP_ACCESS_TOKEN');
      const phoneNumberId = readEnvValue('WHATSAPP_PHONE_NUMBER_ID');
      const verifyToken = readEnvValue('WHATSAPP_VERIFY_TOKEN');
      const agentId = readEnvValue('AGENTFORGE_AGENT_ID');
      const convexUrl = readEnvValue('CONVEX_URL');

      const statusData: Record<string, string> = {
        'Access Token': accessToken ? `${accessToken.slice(0, 10)}****${accessToken.slice(-4)}` : `${colors.red}Not configured${colors.reset}`,
        'Phone Number ID': phoneNumberId || `${colors.red}Not configured${colors.reset}`,
        'Verify Token': verifyToken ? `${verifyToken.slice(0, 6)}****` : `${colors.red}Not configured${colors.reset}`,
        'Default Agent': agentId || `${colors.dim}Not set${colors.reset}`,
        'Convex URL': convexUrl || `${colors.red}Not configured${colors.reset}`,
      };

      details(statusData);

      // Validate access token and phone number if present
      if (accessToken && phoneNumberId) {
        info('Checking WhatsApp Cloud API connectivity...');
        try {
          const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const data = await response.json() as {
            display_phone_number?: string;
            verified_name?: string;
            id?: string;
            error?: { message: string };
          };
          if (data.error) {
            error(`API error: ${data.error.message}`);
          } else {
            success(`WhatsApp Business: ${data.verified_name || data.display_phone_number} (ID: ${data.id})`);
          }
        } catch {
          warn('Could not reach WhatsApp Cloud API (network error).');
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
// Minimal Built-in WhatsApp Bot Runner
// =====================================================

/**
 * A minimal WhatsApp webhook runner that works without the @agentforge-ai/core
 * package. Uses the WhatsApp Cloud API and Convex HTTP API directly.
 *
 * This is a fallback for when the core package isn't available.
 */
async function runMinimalWhatsAppBot(config: {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  agentId: string;
  convexUrl: string;
  webhookPort: number;
  webhookPath: string;
  logLevel?: string;
}): Promise<void> {
  const { accessToken, phoneNumberId, verifyToken, agentId, convexUrl, webhookPort, webhookPath } = config;
  const apiBase = `https://graph.facebook.com/v21.0`;
  const convexBase = convexUrl.replace(/\/$/, '');
  const threadMap = new Map<string, string>();

  // Verify access token
  info('Verifying WhatsApp access token...');
  try {
    const res = await fetch(`${apiBase}/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as { verified_name?: string; display_phone_number?: string; error?: { message: string } };
    if (data.error) {
      error(`API error: ${data.error.message}`);
      process.exit(1);
    }
    success(`WhatsApp Business: ${data.verified_name || data.display_phone_number}`);
  } catch (fetchError: any) {
    warn(`Could not verify token: ${fetchError.message}`);
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

  async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
    await fetch(`${apiBase}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    });
  }

  async function markAsRead(messageId: string): Promise<void> {
    await fetch(`${apiBase}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    }).catch(() => {});
  }

  async function getOrCreateThread(phoneNumber: string, senderName?: string): Promise<string> {
    const cached = threadMap.get(phoneNumber);
    if (cached) return cached;

    const threadId = await convexMutation('chat:createThread', {
      agentId,
      name: senderName ? `WhatsApp: ${senderName}` : `WhatsApp +${phoneNumber}`,
      userId: `whatsapp:${phoneNumber}`,
    }) as string;

    threadMap.set(phoneNumber, threadId);
    return threadId;
  }

  // Start HTTP server for webhook
  const http = await import('node:http');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${webhookPort}`);

    if (url.pathname !== webhookPath) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    // GET — Webhook verification
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === verifyToken) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(challenge);
      } else {
        res.writeHead(403);
        res.end('Forbidden');
      }
      return;
    }

    // POST — Incoming messages
    if (req.method === 'POST') {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());

        // Respond immediately to avoid timeout
        res.writeHead(200);
        res.end('OK');

        // Process messages
        if (body.object !== 'whatsapp_business_account') return;

        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;

            const contacts = change.value.contacts || [];
            const messages = change.value.messages || [];

            for (const msg of messages) {
              if (msg.type !== 'text' || !msg.text?.body) continue;

              const from = msg.from;
              const text = msg.text.body.trim();
              const contact = contacts.find((c: any) => c.wa_id === from);
              const senderName = contact?.profile?.name || from;

              console.log(`[${senderName}] ${text}`);

              // Mark as read
              await markAsRead(msg.id);

              try {
                const threadId = await getOrCreateThread(from, senderName);
                const result = await convexAction('chat:sendMessage', {
                  agentId,
                  threadId,
                  content: text,
                  userId: `whatsapp:${from}`,
                }) as { response: string };

                if (result?.response) {
                  const response = result.response;
                  if (response.length <= 4096) {
                    await sendWhatsAppMessage(from, response);
                  } else {
                    const chunks = response.match(/.{1,4096}/gs) || [];
                    for (const chunk of chunks) {
                      await sendWhatsAppMessage(from, chunk);
                    }
                  }
                  console.log(`[Agent] ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`);
                } else {
                  await sendWhatsAppMessage(from, "🤔 I couldn't generate a response. Please try again.");
                }
              } catch (routeError: any) {
                console.error(`Error: ${routeError.message}`);
                await sendWhatsAppMessage(from, '⚠️ Sorry, I encountered an error. Please try again.');
              }
            }
          }
        }
      } catch (parseError: any) {
        console.error(`Parse error: ${parseError.message}`);
        if (!res.headersSent) {
          res.writeHead(400);
          res.end('Bad Request');
        }
      }
      return;
    }

    res.writeHead(405);
    res.end('Method Not Allowed');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping...');
    server.close();
    process.exit(0);
  });

  server.listen(webhookPort, () => {
    success(`Webhook server listening on port ${webhookPort}`);
    info(`Webhook URL: http://localhost:${webhookPort}${webhookPath}`);
    console.log();
    info('Next steps:');
    dim('  1. Expose this URL publicly (e.g., ngrok http ' + webhookPort + ')');
    dim('  2. Configure the webhook URL in your Meta App Dashboard');
    dim('  3. Subscribe to "messages" webhook field');
    dim('  Press Ctrl+C to stop.');
  });

  // Keep alive
  await new Promise(() => {});
}
