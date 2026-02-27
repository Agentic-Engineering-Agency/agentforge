import { Command } from 'commander';
import { createProject } from './commands/create.js';
import { runProject } from './commands/run.js';
import { deployProject } from './commands/deploy.js';
import { registerAgentsCommand } from './commands/agents.js';
import { registerChatCommand } from './commands/chat.js';
import { registerSessionsCommand, registerThreadsCommand } from './commands/sessions.js';
import { registerSkillsCommand } from './commands/skills.js';
import { registerSkillCommand } from './commands/skill.js';
import { registerCronCommand } from './commands/cron.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerFilesCommand } from './commands/files.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerConfigCommand } from './commands/config.js';
import { registerVaultCommand } from './commands/vault.js';
import { registerKeysCommand } from './commands/keys.js';
import { registerStatusCommand } from './commands/status.js';
import { registerLoginCommand } from './commands/login.js';
import { registerModelsCommand } from './commands/models.js';
import { registerWorkspaceCommand } from './commands/workspace.js';
import { registerTokensCommand } from './commands/tokens.js';
import { registerChannelTelegramCommand } from './commands/channel-telegram.js';
import { registerChannelWhatsAppCommand } from './commands/channel-whatsapp.js';
import { registerChannelSlackCommand } from './commands/channel-slack.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('agentforge')
  .description('AgentForge — NanoClaw: A minimalist agent framework powered by Mastra + Convex')
  .version(pkg.version);

// ─── Project Lifecycle ───────────────────────────────────────────
program
  .command('create')
  .argument('<project-name>', 'Name of the project to create')
  .description('Create a new AgentForge project')
  .option('-t, --template <template>', 'Project template to use', 'default')
  .action(async (projectName: string, options: { template: string }) => {
    await createProject(projectName, options);
  });

program
  .command('run')
  .description('Start the local development environment')
  .option('-p, --port <port>', 'Port for the dev server', '3000')
  .option('-s, --sandbox <type>', 'Sandbox provider for agent execution (local, docker, e2b, none)', 'local')
  .action(async (options: { port: string; sandbox: string }) => {
    await runProject(options as import('./commands/run.js').RunOptions);
  });

program
  .command('deploy')
  .description('Deploy the project to production')
  .option('--env <path>', 'Path to environment file', '.env.production')
  .option('--dry-run', 'Preview deployment without executing', false)
  .option('--rollback', 'Rollback to previous deployment', false)
  .option('--force', 'Skip confirmation prompts', false)
  .option('--provider <provider>', 'Deployment provider (convex or cloud)', 'convex')
  .option('--project <projectId>', 'Project ID for cloud deployments')
  .option('--version <tag>', 'Version tag for the deployment')
  .action(async (options: { 
    env: string; 
    dryRun: boolean; 
    rollback: boolean; 
    force: boolean;
    provider: 'convex' | 'cloud';
    project?: string;
    version?: string;
  }) => {
    await deployProject(options);
  });

// ─── Cloud Authentication ────────────────────────────────────────
registerLoginCommand(program);
  registerModelsCommand(program);
  registerWorkspaceCommand(program);
  registerTokensCommand(program);

// ─── Agent Management ────────────────────────────────────────────
registerAgentsCommand(program);

// ─── Chat ────────────────────────────────────────────────────────
registerChatCommand(program);

// ─── Sessions & Threads ──────────────────────────────────────────
registerSessionsCommand(program);
registerThreadsCommand(program);

// ─── Skills ──────────────────────────────────────────────────────
registerSkillsCommand(program);
registerSkillCommand(program);

// ─── Cron Jobs ───────────────────────────────────────────────────
registerCronCommand(program);

// ─── MCP Connections ─────────────────────────────────────────────
registerMcpCommand(program);

// ─── Files & Folders ─────────────────────────────────────────────
registerFilesCommand(program);

// ─── Projects / Workspaces ───────────────────────────────────────
registerProjectsCommand(program);

// ─── Configuration ───────────────────────────────────────────────
registerConfigCommand(program);

// ─── Vault (Secrets) ─────────────────────────────────────────────
registerVaultCommand(program);

// ─── AI Provider Keys ────────────────────────────────────────────
registerKeysCommand(program);

// ─── Channels ───────────────────────────────────────────────────
registerChannelTelegramCommand(program);
registerChannelWhatsAppCommand(program);
registerChannelSlackCommand(program);

// ─── Status, Dashboard, Logs, Heartbeat ──────────────────────────
registerStatusCommand(program);

program.parse();
