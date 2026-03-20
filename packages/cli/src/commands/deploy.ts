/**
 * AgentForge Deploy Command
 *
 * Deploys Convex schema and functions to production.
 * This is a thin wrapper around `npx convex deploy`.
 */

import type { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { header, dim } from '../lib/display.js';

/**
 * Options for the deploy command.
 */
export interface DeployOptions {
  /** Path to the environment file. */
  env: string;
  /** Preview deployment without executing. */
  dryRun: boolean;
  /** Rollback to previous deployment. */
  rollback: boolean;
  /** Skip confirmation prompts. */
  force: boolean;
}

function maskEnvValue(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(Math.max(4, value.length));
  }
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
}

export function parseEnvFile(envPath: string): Record<string, string> {
  const content = fs.readFileSync(envPath, 'utf-8');
  const envVars: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      envVars[key] = value;
    }
  }

  return envVars;
}

/**
 * Read agentforge configuration from agentforge.config.ts or agentforge.json
 */
export async function readAgentForgeConfig(projectDir: string): Promise<any | null> {
  // Try agentforge.config.ts first
  const tsConfigPath = path.join(projectDir, 'agentforge.config.ts');
  if (await fs.pathExists(tsConfigPath)) {
    try {
      const content = await fs.readFile(tsConfigPath, 'utf-8');
      // Simple extraction of agent IDs
      const agentMatches = content.matchAll(/id:\s*["']([^"']+)["']/g);
      const agents = Array.from(agentMatches).map(m => ({ id: m[1] }));
      return { agents };
    } catch (error) {
      console.debug('[readAgentForgeConfig] Failed to parse TS config, falling through to JSON:', error instanceof Error ? error.message : error);
    }
  }

  // Try agentforge.json
  const jsonConfigPath = path.join(projectDir, 'agentforge.json');
  if (await fs.pathExists(jsonConfigPath)) {
    try {
      const content = await fs.readFile(jsonConfigPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Deploys Convex schema and functions to production.
 *
 * @param options - Options for the deploy command.
 */
export async function deployProject(options: DeployOptions): Promise<void> {
  const projectDir = process.cwd();
  const realProjectDir = fs.realpathSync(projectDir);

  // Validate project structure
  const pkgPath = path.join(projectDir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) {
    console.error('Error: No package.json found. Are you in an AgentForge project directory?');
    process.exit(1);
  }

  const convexDir = path.join(projectDir, 'convex');
  if (!(await fs.pathExists(convexDir))) {
    console.error('Error: No convex/ directory found. Are you in an AgentForge project directory?');
    process.exit(1);
  }

  header('AgentForge Deploy');
  dim('Deploys Convex schema and functions to production');

  // Handle rollback mode
  if (options.rollback) {
    console.log('\n🔄 Rolling back to previous Convex deployment...\n');
    try {
      execSync('npx convex deploy --rollback', {
        cwd: realProjectDir,
        stdio: 'inherit',
      });
      console.log('\n  ✅ Rollback completed successfully.');
    } catch {
      console.error('\n  ❌ Rollback failed.');
      process.exit(1);
    }
    return;
  }

  // Resolve and validate env file
  const envPath = path.resolve(projectDir, options.env);
  const envExists = await fs.pathExists(envPath);
  const envVars = envExists ? parseEnvFile(envPath) : {};

  // Handle dry-run mode
  if (options.dryRun) {
    console.log('\n🔍 Dry run — previewing deployment plan:\n');
    console.log(`  Project directory: ${projectDir}`);
    console.log(`  Convex directory:  ${convexDir}`);
    console.log(`  Environment file:  ${envExists ? envPath : '(not found)'}`);
    if (Object.keys(envVars).length > 0) {
      console.log('  Environment variables:');
      for (const [key, value] of Object.entries(envVars)) {
        console.log(`    ${key}=${maskEnvValue(value)}`);
      }
    } else {
      console.log('  No environment variables found in env file.');
    }
    console.log('\n  ℹ️  No changes were made (dry run).\n');
    return;
  }

  if (!envExists) {
    console.error(`Error: Environment file not found: ${options.env}`);
    process.exit(1);
  }

  // Confirmation prompt (unless --force)
  if (!options.force) {
    console.log('\n🚀 Ready to deploy Convex backend to production.\n');
    console.log(`  Project: ${projectDir}`);
    console.log(`  Env file: ${envPath}`);
    console.log('\n  Use --force to skip this confirmation.\n');
  }

  console.log('📦 Deploying Convex backend...\n');

  try {
    for (const [key, value] of Object.entries(envVars)) {
      try {
        execSync(`npx convex env set ${key} "${value.replace(/"/g, '\\"')}"`, {
          cwd: realProjectDir,
          stdio: 'inherit',
        });
      } catch (setError) {
        const message = setError instanceof Error ? setError.message : String(setError);
        console.error(`Failed to set ${key}: ${message}`);
      }
    }

    execSync('npx convex deploy', {
      cwd: realProjectDir,
      stdio: 'inherit',
    });
    console.log('\n  ✅ Deployment completed successfully!');
    console.log('  Use "agentforge deploy --rollback" to revert if needed.\n');
  } catch {
    console.error('\n  ❌ Deployment failed.');
    console.error('  Check the Convex dashboard for details.');
    process.exit(1);
  }
}

export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Deploy Convex schema and functions to production')
    .option('--env <path>', 'Path to environment file', '.env.production')
    .option('--dry-run', 'Preview deployment without executing', false)
    .option('--rollback', 'Rollback to previous deployment', false)
    .option('--force', 'Skip confirmation prompts', false)
    .action(async (options) => {
      await deployProject(options);
    });
}
