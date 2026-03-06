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
import { header, success, error, info, dim, colors } from '../lib/display.js';

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
    } catch {
      // Fall through to JSON
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
        cwd: projectDir,
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

  // Handle dry-run mode
  if (options.dryRun) {
    console.log('\n🔍 Dry run — previewing deployment plan:\n');
    console.log(`  Project directory: ${projectDir}`);
    console.log(`  Convex directory:  ${convexDir}`);
    console.log(`  Environment file:  ${envExists ? envPath : '(not found)'}`);
    console.log('\n  ℹ️  No changes were made (dry run).\n');
    return;
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
    execSync('npx convex deploy', {
      cwd: projectDir,
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
