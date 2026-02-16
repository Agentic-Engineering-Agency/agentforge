import { Command } from 'commander';
import { createProject } from './commands/create.js';
import { runProject } from './commands/run.js';
import { deployProject } from './commands/deploy.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('agentforge')
  .description('CLI tool for creating, running, and managing AgentForge projects')
  .version(pkg.version);

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
  .action(async (options: { port: string }) => {
    await runProject(options);
  });

program
  .command('deploy')
  .description('Deploy the Convex backend to production')
  .option('--env <path>', 'Path to environment file', '.env.production')
  .option('--dry-run', 'Preview deployment without executing', false)
  .option('--rollback', 'Rollback to previous deployment', false)
  .option('--force', 'Skip confirmation prompts', false)
  .action(async (options: { env: string; dryRun: boolean; rollback: boolean; force: boolean }) => {
    await deployProject(options);
  });

program.parse();
