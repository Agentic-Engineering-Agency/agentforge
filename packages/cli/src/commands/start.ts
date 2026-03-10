import { Command } from 'commander';
import fs from 'fs-extra';
import net from 'node:net';
import path from 'node:path';
import type { AgentDefinition } from '@agentforge-ai/runtime';
import { createClient, safeCall } from '../lib/convex-client.js';
import { createDaemonWorkflowExecutor } from '../lib/workflow-executor.js';
import type { AgentForgeProjectConfig } from '../lib/project-config.js';
import { loadProjectConfig, loadProjectEnv } from '../lib/project-config.js';
import { resolveWorkspaceSkillsBasePath } from '../lib/runtime-workspace.js';
import { header, success, error, info, dim } from '../lib/display.js';
import {
  getAgentProviders,
  getProviderEnvKey,
  hydrateProviderEnvVars,
} from '../lib/provider-keys.js';
import { resolveConvexAdminAuthFromLogin } from '../lib/convex-auth.js';

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
      const requestedAgents: string[] = opts.agent;

      if (!fs.existsSync(path.join(cwd, 'package.json'))) {
        error('Not an AgentForge project directory.');
        info('Run this command from inside an AgentForge project.');
        process.exit(1);
      }

      loadProjectEnv(cwd);
      const projectConfig = await loadProjectConfig(cwd);

      const convexUrl = process.env.CONVEX_URL ?? projectConfig?.daemon?.dbUrl;
      if (!convexUrl) {
        error('CONVEX_URL not found. Make sure you have run: npx convex dev');
        process.exit(1);
      }

      const runtime = await import('@agentforge-ai/runtime');
      const core = await import('@agentforge-ai/core');
      const client = await createClient();
      const agents = await fetchAgents(client, requestedAgents);
      const workspace = await createRuntimeWorkspace(core.createWorkspace, projectConfig?.workspace, cwd, opts.dev);
      const runtimeWorkspace = workspace as unknown as AgentDefinition['workspace'];
      const workspaceSkillTools = workspace
        ? await core.loadExecutableSkillTools(resolveWorkspaceSkillsBasePath(cwd))
        : undefined;

      const enabledChannels = getEnabledChannels(opts, projectConfig);
      runtime.validateEnv({ channels: enabledChannels });

      if (process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_API_KEY;
      }

      let adminKey = process.env.CONVEX_DEPLOY_KEY ?? process.env.CONVEX_ADMIN_KEY;
      if (!adminKey) {
        try {
          const resolvedAuth = await resolveConvexAdminAuthFromLogin({ projectDir: cwd });
          if (resolvedAuth?.adminKey) {
            adminKey = resolvedAuth.adminKey;
            process.env.CONVEX_DEPLOY_KEY = resolvedAuth.adminKey;
            if (opts.dev) {
              info(`Resolved Convex admin auth from local Convex login for ${resolvedAuth.deploymentName}.`);
            }
          }
        } catch (authError) {
          if (opts.dev) {
            info(`Convex admin auth auto-resolution failed: ${authError instanceof Error ? authError.message : String(authError)}`);
          }
        }
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
        } catch (hydrationError) {
          if (opts.dev) {
            info(`Stored API key hydration failed: ${hydrationError instanceof Error ? hydrationError.message : String(hydrationError)}`);
          }
        }
      } else {
        const missingEnvProviders = providers.filter((provider) => !process.env[getProviderEnvKey(provider)]);
        if (missingEnvProviders.length > 0 && opts.dev) {
          info(
            `Missing local env vars for provider keys: ${missingEnvProviders.join(', ')}. ` +
            'Stored Convex API keys require either CONVEX_DEPLOY_KEY or a logged-in local Convex CLI session.',
          );
        }
      }

      const runtimeDataClient = {
        query: (functionName: string, args: Record<string, unknown>) => client.query(functionName as never, args as never),
        mutation: (functionName: string, args: Record<string, unknown>) => client.mutation(functionName as never, args as never),
      };
      const daemon = new runtime.AgentForgeDaemon({
        deploymentUrl: convexUrl,
        adminAuthToken: adminKey,
        defaultModel: projectConfig?.daemon?.defaultModel,
        agentLoader: async (id: string) => {
          const agentConfig = await safeCall(
            () => client.query('agents:get' as never, { id } as never),
            `Failed to fetch agent '${id}' from Convex`,
          ) as any;

          if (!agentConfig) {
            return null;
          }

          return buildAgentDefinition(agentConfig, {
            defaultModel: projectConfig?.daemon?.defaultModel,
            tools: workspaceSkillTools,
            disableMemory: !adminKey,
            workspace: runtimeWorkspace,
          });
        },
      });
      const agentDefinitions = agents.map((agentConfig: any) =>
        buildAgentDefinition(agentConfig, {
          defaultModel: projectConfig?.daemon?.defaultModel,
          tools: workspaceSkillTools,
          disableMemory: !adminKey,
          workspace: runtimeWorkspace,
        }),
      );

      await daemon.loadAgents(agentDefinitions);
      daemon.setWorkflowExecutor(createDaemonWorkflowExecutor(client, daemon));

      if (!opts.noHttp) {
        const configuredPort = projectConfig?.channels?.http?.port ?? port;
        if (await isPortInUse(configuredPort)) {
          error(`Port ${configuredPort} is already in use.`);
          info('Another process may be running. Use --port to use a different port.');
          process.exit(1);
        }

        daemon.addChannel(new runtime.HttpChannel({
          port: configuredPort,
          apiKey: process.env.AGENTFORGE_API_KEY,
          dataClient: runtimeDataClient,
        }));
      }

      if (opts.discord || projectConfig?.channels?.discord?.enabled) {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
          error('DISCORD_BOT_TOKEN not set. Set it in .env.local');
          process.exit(1);
        }

        daemon.addChannel(new runtime.DiscordChannel(token, {
          defaultAgentId: projectConfig?.channels?.discord?.defaultAgentId ?? agentDefinitions[0]!.id,
          autoChannels: projectConfig?.channels?.discord?.autoChannels,
          teamChannel: projectConfig?.channels?.discord?.teamChannel,
          editIntervalMs: projectConfig?.channels?.discord?.editIntervalMs,
        }));
      }

      if (opts.telegram || projectConfig?.channels?.telegram?.enabled) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          error('TELEGRAM_BOT_TOKEN not set. Set it in .env.local');
          process.exit(1);
        }

        daemon.addChannel(new runtime.TelegramChannel(token, {
          defaultAgentId: projectConfig?.channels?.telegram?.defaultAgentId ?? agentDefinitions[0]!.id,
          allowedChatIds: projectConfig?.channels?.telegram?.allowedChatIds,
          editIntervalMs: projectConfig?.channels?.telegram?.editIntervalMs,
        }));
      }

      await daemon.start();

      success(`Loaded ${agentDefinitions.length} agent config(s): ${agentDefinitions.map((agent) => agent.name).join(', ')}`);
      success('AgentForge daemon started!');
      if (!opts.noHttp) {
        dim(`  HTTP: http://localhost:${projectConfig?.channels?.http?.port ?? port}`);
      }
      dim('  Press Ctrl+C to stop');
      console.log();

      await keepAlive();
      await daemon.stop();
    });
}

async function fetchAgents(client: Awaited<ReturnType<typeof createClient>>, requestedAgents: string[]) {
  let agents = await safeCall(
    () => client.query('agents:list' as never, {} as never),
    'Failed to fetch agents from Convex',
  ) as any[];

  if (requestedAgents.length > 0) {
    agents = agents.filter((agent) => requestedAgents.includes(agent.id));
    if (agents.length === 0) {
      error(`No agents found matching: ${requestedAgents.join(', ')}`);
      process.exit(1);
    }
  }

  if (agents.length === 0) {
    error('No agents found in Convex.');
    info('Create an agent first: agentforge agents create');
    process.exit(1);
  }

  return agents;
}

async function createRuntimeWorkspace(
  createWorkspace: typeof import('@agentforge-ai/core').createWorkspace,
  workspaceConfig: AgentForgeProjectConfig['workspace'] | undefined,
  cwd: string,
  verbose: boolean,
) {
  if (!workspaceConfig) {
    return undefined;
  }

  const skillsBasePath = resolveWorkspaceSkillsBasePath(cwd);
  const workspace = createWorkspace({
    storage: 'local',
    name: 'agentforge-workspace',
    basePath: path.resolve(cwd, workspaceConfig.basePath ?? './workspace'),
    skillsBasePath,
    skillsPath: workspaceConfig.skills ?? ['/skills'],
    bm25: workspaceConfig.search ?? true,
    autoIndexPaths: workspaceConfig.autoIndexPaths ?? workspaceConfig.skills ?? ['/skills'],
  });

  await workspace.init();
  if (verbose) {
    info(`Workspace initialized at ${path.relative(cwd, workspaceConfig.basePath ?? './workspace') || '.'}`);
    info(`Workspace skills loaded from ${path.relative(cwd, skillsBasePath) || '.'}`);
  }
  return workspace;
}

function getEnabledChannels(
  opts: { noHttp?: boolean; discord?: boolean; telegram?: boolean },
  config: AgentForgeProjectConfig | null,
) {
  const channels: string[] = [];
  if (!opts.noHttp) channels.push('http');
  if (opts.discord || config?.channels?.discord?.enabled) channels.push('discord');
  if (opts.telegram || config?.channels?.telegram?.enabled) channels.push('telegram');
  return channels;
}

function buildModelString(agentConfig: any, defaultModel?: string): string {
  const normalizeOpenAIModel = (modelId: string) => {
    if (modelId === 'gpt-5-chat') return 'gpt-5-chat-latest';
    if (modelId === 'gpt-5.1-chat') return 'gpt-5.1-chat-latest';
    if (modelId === 'gpt-5.2-chat') return 'gpt-5.2-chat-latest';
    if (modelId === 'gpt-5.3-chat') return 'gpt-5.3-chat-latest';
    return modelId;
  };

  if (
    agentConfig.provider === 'openrouter' &&
    agentConfig.model &&
    String(agentConfig.model).includes('/') &&
    !String(agentConfig.model).startsWith('openrouter/')
  ) {
    return `openrouter/${agentConfig.model}`;
  }

  if (agentConfig.provider && agentConfig.model && !String(agentConfig.model).includes('/')) {
    const modelId = agentConfig.provider === 'openai'
      ? normalizeOpenAIModel(String(agentConfig.model))
      : String(agentConfig.model);
    return `${agentConfig.provider}/${modelId}`;
  }

  const directModel = agentConfig.provider === 'openai' && typeof agentConfig.model === 'string'
    ? `openai/${normalizeOpenAIModel(String(agentConfig.model).replace(/^openai\//, ''))}`
    : agentConfig.model;

  return directModel ?? defaultModel ?? 'moonshotai/kimi-k2.5';
}

function buildAgentDefinition(
  agentConfig: any,
  options: {
    defaultModel?: string;
    tools?: AgentDefinition['tools'];
    disableMemory: boolean;
    workspace?: AgentDefinition['workspace'];
  },
): AgentDefinition {
  return {
    id: agentConfig.id ?? agentConfig._id,
    name: agentConfig.name ?? 'Agent',
    description: agentConfig.description,
    instructions: agentConfig.instructions ?? 'You are a helpful assistant.',
    model: buildModelString(agentConfig, options.defaultModel),
    tools: options.tools,
    workingMemoryTemplate: agentConfig.workingMemoryTemplate,
    disableMemory: options.disableMemory,
    workspace: options.workspace,
  };
}

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve(err.code === 'EADDRINUSE' || err.code === 'EACCES');
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}

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
