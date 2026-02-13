import path from 'node:path';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';

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
 * Parses a .env file and returns key-value pairs.
 *
 * @param filePath - Absolute path to the .env file.
 * @returns A record of environment variable key-value pairs.
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const vars: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) {
      vars[key] = value;
    }
  }

  return vars;
}

/**
 * Deploys an AgentForge project's Convex backend to production.
 *
 * Handles environment variable configuration, provides deployment status
 * feedback, and supports rollback capabilities.
 *
 * @param options - Options for the deploy command.
 */
export async function deployProject(options: DeployOptions): Promise<void> {
  const projectDir = process.cwd();

  // Validate project structure
  const pkgPath = path.join(projectDir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) {
    console.error(
      'Error: No package.json found. Are you in an AgentForge project directory?'
    );
    process.exit(1);
  }

  const convexDir = path.join(projectDir, 'convex');
  if (!(await fs.pathExists(convexDir))) {
    console.error(
      'Error: No convex/ directory found. Are you in an AgentForge project directory?'
    );
    process.exit(1);
  }

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

  // Parse env vars if file exists
  let envVars: Record<string, string> = {};
  if (envExists) {
    envVars = parseEnvFile(envPath);
  }

  // Handle dry-run mode
  if (options.dryRun) {
    console.log('\n🔍 Dry run — previewing deployment plan:\n');
    console.log(`  Project directory: ${projectDir}`);
    console.log(`  Convex directory:  ${convexDir}`);
    console.log(`  Environment file:  ${envExists ? envPath : '(not found, skipping env vars)'}`);

    if (Object.keys(envVars).length > 0) {
      console.log(`\n  Environment variables to set (${Object.keys(envVars).length}):`);
      for (const key of Object.keys(envVars)) {
        console.log(`    • ${key}=${envVars[key].slice(0, 4)}${'*'.repeat(Math.max(0, envVars[key].length - 4))}`);
      }
    } else {
      console.log('\n  No environment variables to set.');
    }

    console.log('\n  ℹ️  No changes were made (dry run).\n');
    return;
  }

  // Require env file for actual deployment
  if (!envExists) {
    console.error(
      `Error: Environment file "${options.env}" not found. Create it or use --env to specify a different path.`
    );
    process.exit(1);
  }

  // Confirmation prompt (unless --force)
  if (!options.force) {
    console.log('\n🚀 Deployment plan:\n');
    console.log(`  Project:    ${projectDir}`);
    console.log(`  Env file:   ${envPath}`);
    console.log(`  Env vars:   ${Object.keys(envVars).length} variable(s)`);
    console.log('\n  Use --force to skip this confirmation.\n');

    // In a real CLI, we'd use prompts here. For now, auto-proceed.
    // The --force flag is the recommended path for CI/CD.
  }

  console.log('\n📦 Deploying AgentForge project to production...\n');

  // Step 1: Push environment variables
  if (Object.keys(envVars).length > 0) {
    console.log('  Setting environment variables...');
    for (const [key, value] of Object.entries(envVars)) {
      try {
        execSync(`npx convex env set ${key} "${value}"`, {
          cwd: projectDir,
          stdio: 'pipe',
        });
        console.log(`    ✅ ${key}`);
      } catch {
        console.error(`    ❌ Failed to set ${key}`);
      }
    }
    console.log('');
  }

  // Step 2: Deploy
  console.log('  Deploying Convex backend...');
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
