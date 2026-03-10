/**
 * AgentForge Start Command
 *
 * Boots the AgentForge daemon with channel adapters.
 * This replaces the broken pattern of running Mastra in Convex actions.
 */

import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, success, error, info, dim, colors } from '../lib/display.js';
import fs from 'fs-extra';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  getAgentProviders,
  getProviderEnvKey,
  hydrateProviderEnvVars,
} from '../lib/provider-keys.js';
import { resolveConvexAdminAuthFromLogin } from '../lib/convex-auth.js';
// Lazy-loaded to avoid pulling in heavy runtime deps (jsdom, etc.) at CLI startup
let _createStandardAgent: typeof import('@agentforge-ai/runtime').createStandardAgent;
let _initStorage: typeof import('@agentforge-ai/runtime').initStorage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerStartCommand(program: Command) {
  program
    .command('start')
    .description('Start the AgentForge daemon with channel adapters')
    .option('-p, --port <n>', 'HTTP channel port (default: 3001)', '3001')
    .option('--discord', 'Enable Discord channel (requires DISCORD_BOT_TOKEN)')
    .option('--telegram', 'Enable Telegram channel (requires TELEGRAM_BOT_TOKEN)')
    .option('--no-http', 'Disable HTTP channel')
    .option('--agent <id>', 'Load specific agent only (repeatable)', (val: string, prev: string[]) => [...prev, val], [] as string[])
    .option('--dev', 'Dev mode: verbose logging, no process.exit on error')
    .action(async (opts) => {
      header('AgentForge Daemon');

      const cwd = process.cwd();
      const port = parseInt(opts.port, 10);
      const agentsFilter: string[] = opts.agent;

      // Check if this is an AgentForge project
      const pkgPath = path.join(cwd, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        error('Not an AgentForge project directory.');
        info('Run this command from inside an AgentForge project.');
        process.exit(1);
      }

      // Check for Convex deployment
      let convexUrl = process.env.CONVEX_URL;
      if (!convexUrl) {
        const envPath = path.join(cwd, '.env.local');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const match = envContent.match(/CONVEX_URL=(.+)/);
          if (match) convexUrl = match[1].trim();
        }
      }

      if (!convexUrl) {
        error('CONVEX_URL not found. Make sure you have run: npx convex dev');
        process.exit(1);
      }

      info(`Connected to Convex: ${convexUrl}`);

      // Fetch agents from Convex
      const client = await createClient();

      let agents: any[] = [];
      try {
        const result = await safeCall(
          () => client.query('agents:list' as any, {}),
          'Failed to fetch agents from Convex'
        );
        agents = (result as any[]) || [];
      } catch (err) {
        error(`Failed to fetch agents: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }

      // Filter agents if specified
      if (agentsFilter.length > 0) {
        agents = agents.filter((a: any) => agentsFilter.includes(a.id));
        if (agents.length === 0) {
          error(`No agents found matching: ${agentsFilter.join(', ')}`);
          process.exit(1);
        }
      }

      if (agents.length === 0) {
        error('No agents found in Convex.');
        info('Create an agent first: agentforge agents create');
        process.exit(1);
      }

      success(`Loaded ${agents.length} agent config(s): ${agents.map((a: any) => a.name).join(', ')}`);

      // Lazy-load runtime to avoid top-level jsdom/node require issues
      try {
        const runtime = await import('@agentforge-ai/runtime');
        _createStandardAgent = runtime.createStandardAgent;
        _initStorage = runtime.initStorage;
      } catch (err) {
        error(`Failed to load @agentforge-ai/runtime: ${err instanceof Error ? err.message : String(err)}`);
        info('Make sure @agentforge-ai/runtime is installed: pnpm add @agentforge-ai/runtime');
        process.exit(1);
      }

      // Load .env.local for provider API keys
      const envLocalPath = path.join(cwd, '.env.local');
      if (fs.existsSync(envLocalPath)) {
        const envContent = fs.readFileSync(envLocalPath, 'utf-8');
        for (const line of envContent.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim();
            if (!process.env[key]) process.env[key] = val;
          }
        }
      }

      if (process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
      }

      let adminKey = process.env.CONVEX_DEPLOY_KEY;
      if (!adminKey && convexUrl) {
        try {
          const resolvedAuth = await resolveConvexAdminAuthFromLogin({ projectDir: cwd });
          if (resolvedAuth?.adminKey) {
            adminKey = resolvedAuth.adminKey;
            process.env.CONVEX_DEPLOY_KEY = resolvedAuth.adminKey;
            if (opts.dev) info(`Resolved Convex admin auth from local Convex login for ${resolvedAuth.deploymentName}.`);
          }
        } catch (err) {
          if (opts.dev) {
            info(`Convex admin auth auto-resolution failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // Initialize Convex storage for agent memory (if admin key available)
      if (convexUrl && adminKey) {
        try {
          _initStorage(convexUrl, adminKey);
          if (opts.dev) info('Convex memory storage initialized.');
        } catch (_) { /* memory will be disabled */ }
      }

      const providers = getAgentProviders(
        agents.map((agentConfig: any) => ({
          provider: agentConfig.provider,
          model: agentConfig.model,
        })),
      );

      if (convexUrl && adminKey && providers.length > 0) {
        try {
          const hydration = await hydrateProviderEnvVars({
            convexUrl,
            deployKey: adminKey,
            projectDir: cwd,
            providers,
          });
          if (opts.dev && hydration.hydrated.length > 0) {
            info(`Loaded stored API keys for: ${hydration.hydrated.join(', ')}`);
          }
        } catch (err) {
          if (opts.dev) {
            info(`Stored API key hydration failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } else {
        const missingEnvProviders = providers.filter((provider) => !process.env[getProviderEnvKey(provider)]);
        if (missingEnvProviders.length > 0) {
          info(
            `Missing local env vars for provider keys: ${missingEnvProviders.join(', ')}. ` +
            'Stored Convex API keys require either CONVEX_DEPLOY_KEY or a logged-in local Convex CLI session.',
          );
        }
      }

      const memoryEnabled = Boolean(adminKey && process.env.GOOGLE_GENERATIVE_AI_API_KEY);
      if (adminKey && !memoryEnabled && opts.dev) {
        info('Disabling agent memory because GOOGLE_GENERATIVE_AI_API_KEY is not configured for the shared embedding/observer models.');
      }

      // Create real Mastra Agent instances from Convex records
      const mastraAgents: any[] = [];
      for (const agentConfig of agents) {
        try {
          // Mastra uses provider/model format (slash separator)
          const modelStr = agentConfig.provider && agentConfig.model
            ? `${agentConfig.provider}/${agentConfig.model}`
            : agentConfig.model || 'openai/gpt-4o-mini';
          const agent = _createStandardAgent({
            id: agentConfig.id ?? agentConfig._id,
            name: agentConfig.name ?? 'Agent',
            instructions: agentConfig.instructions ?? 'You are a helpful assistant.',
            model: modelStr,
            disableMemory: !memoryEnabled,
          });
          // Attach metadata from Convex record for /api/agents
          (agent as any).id = agentConfig.id ?? agentConfig._id;
          (agent as any).model = modelStr;
          mastraAgents.push(agent);
          if (opts.dev) info(`  Agent "${agentConfig.name}" → ${modelStr}`);
        } catch (err) {
          error(`Failed to create agent "${agentConfig.name}": ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (mastraAgents.length === 0) {
        error('No agents could be instantiated. Check your API keys in .env.local');
        process.exit(1);
      }

      success(`${mastraAgents.length} agent(s) ready.`);

      // Check if port is already in use
      const portInUse = await isPortInUse(port);
      if (portInUse) {
        error(`Port ${port} is already in use.`);
        info('Another process may be running. Use --port to use a different port.');
        process.exit(1);
      }

      // Collect shutdown callbacks for all started channels
      const shutdownFns: Array<() => Promise<void>> = [];

      // Start HTTP channel with daemon
      if (!opts.noHttp) {
        info(`Starting HTTP channel on port ${port}...`);

        const httpModulePath = resolve(__dirname, './lib/http-channel.js');

        try {
          const { startHttpChannel } = await import(httpModulePath);
          const agentConfigs = agents.map((a: any) => ({
            id: a.id ?? a._id,
            provider: a.provider ?? 'openai',
            model: a.model ?? 'gpt-4o-mini',
          }));
          const close = await startHttpChannel(port, mastraAgents, convexUrl, opts.dev, agentConfigs);
          shutdownFns.push(close);
        } catch (err) {
          error(`Failed to start HTTP channel: ${err instanceof Error ? err.message : String(err)}`);
          if (!opts.dev) process.exit(1);
        }
      }

      // Start Discord channel if requested
      if (opts.discord) {
        const discordToken = process.env.DISCORD_BOT_TOKEN;
        if (!discordToken) {
          error('DISCORD_BOT_TOKEN not set. Set it in .env.local');
          process.exit(1);
        }
        info('Discord channel not yet implemented.');
      }

      // Start Telegram channel if requested
      if (opts.telegram) {
        const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!telegramToken) {
          error('TELEGRAM_BOT_TOKEN not set. Set it in .env.local');
          process.exit(1);
        }
        info('Telegram channel not yet implemented.');
      }

      success('AgentForge daemon started!');
      dim(`  HTTP: http://localhost:${port}`);
      dim('  Press Ctrl+C to stop');
      console.log();

      // Wait for shutdown signal, then close all channels gracefully
      await keepAlive();
      await Promise.allSettled(shutdownFns.map((fn) => fn()));
    });
}

/**
 * Check if a port is in use
 */
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      // EADDRINUSE = port taken; EACCES = permission denied — both mean unusable
      resolve(err.code === 'EADDRINUSE' || err.code === 'EACCES');
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}

/**
 * Keep the process alive until SIGINT or SIGTERM.
 */
async function keepAlive(): Promise<void> {
  return new Promise((resolve) => {
    const shutdown = () => {
      console.log();
      info('Shutting down AgentForge daemon...');
      resolve();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
