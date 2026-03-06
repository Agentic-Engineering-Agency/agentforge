import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, details, success, error, info, dim, colors } from '../lib/display.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';
import readline from 'node:readline';

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show system health and connection status')
    .action(async () => {
      header('AgentForge Status');

      const cwd = process.cwd();
      const checks: Record<string, string> = {};

      checks['Project Root'] = fs.existsSync(path.join(cwd, 'package.json')) ? '✔ Found' : '✖ Not found';
      checks['Convex Dir'] = fs.existsSync(path.join(cwd, 'convex')) ? '✔ Found' : '✖ Not found';
      checks['Skills Dir'] = fs.existsSync(path.join(cwd, 'skills')) ? '✔ Found' : '✖ Not configured';
      checks['Dashboard Dir'] = fs.existsSync(path.join(cwd, 'dashboard')) ? '✔ Found' : '✖ Not found';
      checks['Env Config'] = fs.existsSync(path.join(cwd, '.env.local')) || fs.existsSync(path.join(cwd, '.env'))
        ? '✔ Found' : '✖ Not found';

      // Check Convex connection
      try {
        const client = await createClient();
        const agents = await client.query('agents:list' as any, {});
        checks['Convex Connection'] = `✔ Connected (${(agents as any[])?.length || 0} agents)`;
      } catch {
        checks['Convex Connection'] = '✖ Not connected (run `npx convex dev`)';
      }

      // Check runtime daemon
      try {
        const healthResponse = await fetch('http://localhost:3001/health', {
          signal: AbortSignal.timeout(1000),
        });
        if (healthResponse.ok) {
          const health = await healthResponse.json() as { agents: number; agentIds: string[] };
          checks['Runtime Daemon'] = `✔ Running on :3001 (${health.agents} agent${health.agents !== 1 ? 's' : ''})`;
        } else {
          checks['Runtime Daemon'] = '✗ Not responding';
        }
      } catch {
        checks['Runtime Daemon'] = '✗ Not running (run `agentforge start`)';
      }

      // Check LLM provider
      let providerStatus = 'Not configured';
      let storedKeysCount = 0;

      // Check environment variables first
      const envFiles = ['.env.local', '.env'];
      for (const envFile of envFiles) {
        const envPath = path.join(cwd, envFile);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          const match = content.match(/LLM_PROVIDER=(.+)/);
          if (match) { providerStatus = match[1].trim(); break; }
          if (content.includes('OPENAI_API_KEY=')) { providerStatus = 'openai'; break; }
          if (content.includes('OPENROUTER_API_KEY=')) { providerStatus = 'openrouter'; break; }
        }
      }

      // Also check stored keys in Convex
      try {
        const client = await createClient();
        const keys = await client.query('apiKeys:list' as any, {}) as any[] || [];
        const activeKeys = keys.filter((k: any) => k.isActive);
        storedKeysCount = activeKeys.length;
        if (storedKeysCount > 0) {
          const providers = [...new Set(activeKeys.map((k: any) => k.provider))];
          providerStatus = `Configured (${storedKeysCount} key${storedKeysCount > 1 ? 's' : ''}: ${providers.join(', ')})`;
        }
      } catch {
        // Fall back to env check if Convex query fails
      }

      checks['LLM Provider'] = storedKeysCount > 0 || providerStatus !== 'Not configured'
        ? `✔ ${providerStatus}`
        : '✖ Not configured';

      details(checks);
    });

  program
    .command('dashboard')
    .description('Launch the web dashboard')
    .option('-p, --port <port>', 'Port for the dashboard', '3000')
    .option('-d, --dir <path>', 'Project directory (defaults to current directory)')
    .option('--install', 'Install dashboard dependencies before starting')
    .action(async (opts) => {
      // Safely resolve CWD — process.cwd() throws ENOENT if the shell's working
      // directory was deleted or is otherwise inaccessible (common with mise/nvm envs)
      let cwd: string;
      try {
        cwd = opts.dir ? path.resolve(opts.dir) : process.cwd();
      } catch {
        error('Cannot determine the current directory.');
        console.log();
        info('Your shell\'s working directory may no longer exist.');
        info('Run the command from inside your project directory:');
        console.log();
        console.log('  cd /path/to/your/agentforge-project');
        console.log('  agentforge dashboard');
        console.log();
        info('Or specify the directory explicitly:');
        console.log('  agentforge dashboard --dir /path/to/your/agentforge-project');
        process.exit(1);
      }

      // Search for the dashboard in multiple locations (in priority order)
      const searchPaths = [
        path.join(cwd, 'dashboard'),                                    // 1. Bundled in project (agentforge create)
        path.join(cwd, 'packages', 'web'),                              // 2. Monorepo structure
        path.join(cwd, 'node_modules', '@agentforge-ai', 'web'),        // 3. Installed as dependency
      ];

      let dashDir = '';
      for (const p of searchPaths) {
        if (fs.existsSync(path.join(p, 'package.json'))) {
          dashDir = p;
          break;
        }
      }

      if (!dashDir) {
        error('Dashboard not found!');
        console.log();
        info('The dashboard should be in your project\'s ./dashboard/ directory.');
        info('If you created this project with an older version of AgentForge,');
        info('you can add it manually:');
        console.log();
        console.log(`  ${colors.cyan}# Option 1: Recreate the project${colors.reset}`);
        console.log(`  agentforge create my-project`);
        console.log();
        console.log(`  ${colors.cyan}# Option 2: Clone the dashboard from the repo${colors.reset}`);
        console.log(`  git clone https://github.com/Agentic-Engineering-Agency/agentforge /tmp/af`);
        console.log(`  cp -r /tmp/af/packages/web ./dashboard`);
        console.log(`  cd dashboard && pnpm install`);
        console.log();
        return;
      }

      // Check if node_modules exists, if not install
      const nodeModulesExists = fs.existsSync(path.join(dashDir, 'node_modules'));
      if (!nodeModulesExists || opts.install) {
        header('AgentForge Dashboard — Installing Dependencies');
        info(`Installing in ${path.relative(cwd, dashDir) || '.'}...`);
        console.log();

        const installChild = spawn('pnpm', ['install'], {
          cwd: dashDir,
          stdio: 'inherit',
          shell: true,
        });

        await new Promise<void>((resolve, reject) => {
          installChild.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`pnpm install exited with code ${code}`));
          });
          installChild.on('error', reject);
        });

        console.log();
        success('Dependencies installed.');
        console.log();
      }

      // Read the Convex URL from .env.local and inject it into the dashboard
      const envPath = path.join(cwd, '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const convexUrlMatch = envContent.match(/CONVEX_URL=(.+)/);
        if (convexUrlMatch) {
          const dashEnvPath = path.join(dashDir, '.env.local');
          const dashEnvContent = `VITE_CONVEX_URL=${convexUrlMatch[1].trim()}\n`;
          fs.writeFileSync(dashEnvPath, dashEnvContent);
        }
      }

      header('AgentForge Dashboard');
      info(`Starting dashboard on port ${opts.port}...`);
      info(`Open ${colors.cyan}http://localhost:${opts.port}${colors.reset} in your browser.`);
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
      const client = await createClient();
      const args: Record<string, any> = {
        paginationOpts: { cursor: null, numItems: parseInt(opts.lines, 10) }
      };
      if (opts.agent) args.agentId = opts.agent;

      const result = await safeCall(
        () => client.query('usage:list' as any, args),
        'Failed to fetch logs'
      );

      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('Activity Logs');
      const items = (result as any)?.page || [];
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
      const client = await createClient();
      header('Heartbeat Check');

      const args: Record<string, any> = {};
      if (opts.agent) args.agentId = opts.agent;

      const result = await safeCall(
        () => client.query('heartbeat:listActive' as any, args),
        'Failed to check heartbeat'
      );

      const items = (result as any[]) || [];
      if (items.length === 0) {
        success('All tasks complete. No pending work.');
        return;
      }

      info(`Found ${items.length} active heartbeat(s):`);
      items.forEach((task: any, i: number) => {
        console.log(`  ${colors.yellow}${i + 1}.${colors.reset} [${task.agentId}] ${task.currentTask || 'No current task'}`);
        console.log(`     ${colors.dim}Status: ${task.status} | Pending: ${(task.pendingTasks || []).length} task(s)${colors.reset}`);
      });
      console.log();

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise<string>((r) => rl.question('Reset stalled heartbeats? (y/N): ', (a) => { rl.close(); r(a.trim()); }));
      if (answer.toLowerCase() === 'y') {
        for (const task of items) {
          info(`Resetting heartbeat for agent "${task.agentId}"...`);
          await safeCall(
            () => client.mutation('heartbeat:updateStatus' as any, { agentId: task.agentId, status: 'active', currentTask: undefined }),
            'Failed to reset heartbeat'
          );
        }
        success('All heartbeats reset.');
      }
    });
}
