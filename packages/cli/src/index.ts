import { Command } from 'commander';
import { createProject } from './commands/create.js';
import { runProject } from './commands/run.js';

const program = new Command();

program
  .name('agentforge')
  .description('CLI tool for creating, running, and managing AgentForge projects')
  .version('0.1.0');

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
  .description('Deploy the project (coming soon)')
  .action(() => {
    console.log('Deploy command coming soon. Stay tuned!');
  });

program.parse();
