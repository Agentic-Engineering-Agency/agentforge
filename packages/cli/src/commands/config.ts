import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, success, error, info, details, colors } from '../lib/display.js';
import fs from 'fs-extra';
import path from 'node:path';
import readline from 'node:readline';

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

export function registerConfigCommand(program: Command) {
  const config = program.command('config').description('Manage configuration');

  config
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      header('Configuration');

      // Check local .env files
      const cwd = process.cwd();
      const envFiles = ['.env', '.env.local', '.env.production'];
      for (const envFile of envFiles) {
        const envPath = path.join(cwd, envFile);
        if (fs.existsSync(envPath)) {
          console.log(`  ${colors.cyan}${envFile}${colors.reset}`);
          const content = fs.readFileSync(envPath, 'utf-8');
          content.split('\n').forEach((line) => {
            if (line.trim() && !line.startsWith('#')) {
              const [key, ...rest] = line.split('=');
              const value = rest.join('=').trim();
              const masked = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')
                ? value.slice(0, 4) + '****' + value.slice(-4)
                : value;
              console.log(`    ${colors.dim}${key.trim()}${colors.reset} = ${masked}`);
            }
          });
          console.log();
        }
      }

      // Check Convex config
      const convexDir = path.join(cwd, '.convex');
      if (fs.existsSync(convexDir)) {
        info('Convex: Configured');
      } else {
        info('Convex: Not configured (run `npx convex dev`)');
      }

      // Check skills directory
      const skillsDir = path.join(cwd, 'skills');
      if (fs.existsSync(skillsDir)) {
        const skills = fs.readdirSync(skillsDir).filter((d: string) => fs.statSync(path.join(skillsDir, d)).isDirectory());
        info(`Skills: ${skills.length} installed (${skills.join(', ')})`);
      } else {
        info('Skills: None installed');
      }
    });

  config
    .command('set')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .option('--env <file>', 'Environment file to update', '.env.local')
    .description('Set a configuration value')
    .action(async (key, value, opts) => {
      const envPath = path.join(process.cwd(), opts.env);
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
      success(`Set ${key} in ${opts.env}`);
    });

  config
    .command('get')
    .argument('<key>', 'Configuration key')
    .description('Get a configuration value')
    .action(async (key) => {
      const cwd = process.cwd();
      const envFiles = ['.env.local', '.env', '.env.production'];
      for (const envFile of envFiles) {
        const envPath = path.join(cwd, envFile);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf-8');
          const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
          if (match) {
            console.log(match[1].trim());
            return;
          }
        }
      }
      error(`Key "${key}" not found in any .env file.`);
    });

  config
    .command('init')
    .description('Initialize configuration for a new project')
    .action(async () => {
      header('Project Configuration');
      const convexUrl = await prompt('Convex URL (from `npx convex dev`): ');
      const provider = await prompt('LLM Provider (openai/openrouter/anthropic/google): ') || 'openai';
      const apiKey = await prompt(`${provider.toUpperCase()} API Key: `);

      const envContent = [
        `# AgentForge Configuration`,
        `CONVEX_URL=${convexUrl}`,
        ``,
        `# LLM Provider`,
        `LLM_PROVIDER=${provider}`,
      ];

      if (provider === 'openai') envContent.push(`OPENAI_API_KEY=${apiKey}`);
      else if (provider === 'openrouter') envContent.push(`OPENROUTER_API_KEY=${apiKey}`);
      else if (provider === 'anthropic') envContent.push(`ANTHROPIC_API_KEY=${apiKey}`);
      else if (provider === 'google') envContent.push(`GOOGLE_API_KEY=${apiKey}`);

      fs.writeFileSync(path.join(process.cwd(), '.env.local'), envContent.join('\n') + '\n');
      success('Configuration saved to .env.local');
      info('Run `npx convex dev` to start the Convex backend.');
    });

  config
    .command('provider')
    .argument('<provider>', 'LLM provider to configure (openai, openrouter, anthropic, google, xai)')
    .description('Configure an LLM provider')
    .action(async (provider) => {
      const keyNames: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        openrouter: 'OPENROUTER_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY',
        google: 'GOOGLE_API_KEY',
        xai: 'XAI_API_KEY',
      };
      const keyName = keyNames[provider.toLowerCase()];
      if (!keyName) {
        error(`Unknown provider "${provider}". Supported: ${Object.keys(keyNames).join(', ')}`);
        process.exit(1);
      }
      const apiKey = await prompt(`${keyName}: `);
      if (!apiKey) { error('API key is required.'); process.exit(1); }

      const envPath = path.join(process.cwd(), '.env.local');
      let content = '';
      if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf-8');

      const lines = content.split('\n');
      const idx = lines.findIndex((l) => l.startsWith(`${keyName}=`));
      if (idx >= 0) lines[idx] = `${keyName}=${apiKey}`;
      else lines.push(`${keyName}=${apiKey}`);

      // Also set LLM_PROVIDER
      const provIdx = lines.findIndex((l) => l.startsWith('LLM_PROVIDER='));
      if (provIdx >= 0) lines[provIdx] = `LLM_PROVIDER=${provider}`;
      else lines.push(`LLM_PROVIDER=${provider}`);

      fs.writeFileSync(envPath, lines.join('\n'));
      success(`Provider "${provider}" configured.`);
    });
}
