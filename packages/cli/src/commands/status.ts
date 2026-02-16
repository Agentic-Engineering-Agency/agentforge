import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, details, success, error, info, dim, colors } from '../lib/display.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show system health and connection status')
    .action(async () => {
      header('AgentForge Status');

      // Check project structure
      const cwd = process.cwd();
      const checks: Record<string, string> = {};

      checks['Project Root'] = fs.existsSync(path.join(cwd, 'package.json')) ? '✔ Found' : '✖ Not found';
      checks['Convex Dir'] = fs.existsSync(path.join(cwd, 'convex')) ? '✔ Found' : '✖ Not found';
      checks['Skills Dir'] = fs.existsSync(path.join(cwd, 'skills')) ? '✔ Found' : '✖ Not configured';
      checks['Env Config'] = fs.existsSync(path.join(cwd, '.env.local')) || fs.existsSync(path.join(cwd, '.env'))
        ? '✔ Found' : '✖ Not found';

      // Check Convex connection
      try {
        const client = createClient();
        const agents = await client.query('agents:list' as any, {});
        checks['Convex Connection'] = `✔ Connected (${(agents as any[])?.length || 0} agents)`;
      } catch {
        checks['Convex Connection'] = '✖ Not connected (run `npx convex dev`)';
      }

      // Check LLM provider
      const envFiles = ['.env.local', '.env'];
      let provider = 'Not configured';
      for (const envFile of envFiles) {
        const envPath = path.join(cwd, envFile);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          const match = content.match(/LLM_PROVIDER=(.+)/);
          if (match) { provider = match[1].trim(); break; }
          if (content.includes('OPENAI_API_KEY=')) { provider = 'openai'; break; }
          if (content.includes('OPENROUTER_API_KEY=')) { provider = 'openrouter'; break; }
        }
      }
      checks['LLM Provider'] = provider !== 'Not configured' ? `✔ ${provider}` : '✖ Not configured';

      details(checks);
    });

  program
    .command('dashboard')
    .description('Launch the web dashboard')
    .option('-p, --port <port>', 'Port for the dashboard', '3000')
    .action(async (opts) => {
      const cwd = process.cwd();
      const webDir = path.join(cwd, 'node_modules', '@agentforge-ai', 'web');
      const localWebDir = path.join(cwd, 'packages', 'web');

      let dashDir = '';
      if (fs.existsSync(localWebDir)) {
        dashDir = localWebDir;
      } else if (fs.existsSync(webDir)) {
        dashDir = webDir;
      } else {
        info('Dashboard not found locally. Starting from the built-in dashboard...');
        info('Install the dashboard: pnpm add @agentforge-ai/web');
        info('Or clone the repo: git clone https://github.com/Agentic-Engineering-Agency/agentforge');
        return;
      }

      header('AgentForge Dashboard');
      info(`Starting dashboard on port ${opts.port}...`);
      info(`Open http://localhost:${opts.port} in your browser.`);
      console.log();

      const child = spawn('pnpm', ['dev', '--port', opts.port], {
        cwd: dashDir,
        stdio: 'inherit',
        shell: true,
      });

      child.on('error', (err) => {
        error(`Failed to start dashboard: ${err.message}`);
      });
    });

  program
    .command('logs')
    .description('Show recent activity logs')
    .option('-n, --lines <count>', 'Number of log entries', '20')
    .option('--agent <id>', 'Filter by agent ID')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = createClient();
      const args: Record<string, any> = {};
      if (opts.agent) args.agentId = opts.agent;

      const result = await safeCall(
        () => client.query('usage:list' as any, args),
        'Failed to fetch logs'
      );

      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Activity Logs');
      const items = ((result as any[]) || []).slice(0, parseInt(opts.lines));
      if (items.length === 0) { info('No activity logs found.'); return; }

      items.forEach((log: any) => {
        const time = new Date(log.timestamp || log.createdAt).toLocaleString();
        const agent = log.agentId || 'system';
        const action = log.action || log.type || 'unknown';
        const tokens = log.tokensUsed ? `${log.tokensUsed} tokens` : '';
        console.log(`  ${colors.dim}${time}${colors.reset}  ${colors.cyan}${agent}${colors.reset}  ${action}  ${tokens}`);
      });
      console.log();
    });

  program
    .command('heartbeat')
    .description('Check and resume pending agent tasks')
    .option('--agent <id>', 'Check specific agent')
    .action(async (opts) => {
      const client = createClient();
      header('Heartbeat Check');

      const args: Record<string, any> = {};
      if (opts.agent) args.agentId = opts.agent;

      const result = await safeCall(
        () => client.query('heartbeat:listPending' as any, args),
        'Failed to check heartbeat'
      );

      const items = (result as any[]) || [];
      if (items.length === 0) {
        success('All tasks complete. No pending work.');
        return;
      }

      info(`Found ${items.length} pending task(s):`);
      items.forEach((task: any, i: number) => {
        console.log(`  ${colors.yellow}${i + 1}.${colors.reset} [${task.agentId}] ${task.taskDescription || 'Unnamed task'}`);
        console.log(`     ${colors.dim}Status: ${task.status} | Thread: ${task.threadId || 'N/A'}${colors.reset}`);
      });
      console.log();

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const { createInterface } = await import('node:readline');
      const answer = await new Promise<string>((r) => rl.question('Resume pending tasks? (y/N): ', (a) => { rl.close(); r(a.trim()); }));
      if (answer.toLowerCase() === 'y') {
        for (const task of items) {
          info(`Resuming task for agent "${task.agentId}"...`);
          await safeCall(
            () => client.mutation('heartbeat:resume' as any, { _id: task._id }),
            'Failed to resume task'
          );
        }
        success('All pending tasks resumed.');
      }
    });
}

import readline from 'node:readline';
