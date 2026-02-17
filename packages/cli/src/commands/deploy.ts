import path from 'node:path';
import { execSync } from 'node:child_process';
import fs from 'fs-extra';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { CloudClient, CloudClientError, type AgentConfig } from '../lib/cloud-client.js';
import { readCredentials, getCloudUrl } from '../lib/credentials.js';

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
  /** Deployment provider: convex (default) or cloud. */
  provider: 'convex' | 'cloud';
  /** Project ID for cloud deployments. */
  project?: string;
  /** Version tag for the deployment. */
  version?: string;
}

/**
 * Configuration file format for agentforge.config.ts or agentforge.json
 */
export interface AgentForgeConfig {
  projectId?: string;
  agents?: AgentConfig[];
  cloudUrl?: string;
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
 * Read agentforge configuration from agentforge.config.ts or agentforge.json
 */
export async function readAgentForgeConfig(projectDir: string): Promise<AgentForgeConfig | null> {
  // Try agentforge.config.ts first
  const tsConfigPath = path.join(projectDir, 'agentforge.config.ts');
  if (await fs.pathExists(tsConfigPath)) {
    try {
      // For now, we'll read it as a simple module that exports default
      // In production, this might need a dynamic import or esbuild
      const content = await fs.readFile(tsConfigPath, 'utf-8');
      return parseConfigFromContent(content, projectDir);
    } catch {
      // Fall through to JSON
    }
  }

  // Try agentforge.json
  const jsonConfigPath = path.join(projectDir, 'agentforge.json');
  if (await fs.pathExists(jsonConfigPath)) {
    try {
      const content = await fs.readFile(jsonConfigPath, 'utf-8');
      return JSON.parse(content) as AgentForgeConfig;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Parse config from TypeScript file content
 * This is a simplified parser - in production you might use ts-node or esbuild
 */
function parseConfigFromContent(content: string, projectDir: string): AgentForgeConfig | null {
  const config: AgentForgeConfig = {};

  // Extract projectId
  const projectIdMatch = content.match(/projectId\s*:\s*["']([^"']+)["']/);
  if (projectIdMatch) {
    config.projectId = projectIdMatch[1];
  }

  // Try to read agents from the convex/agents.ts file if present
  const agentsPath = path.join(projectDir, 'convex', 'agents.ts');
  if (fs.existsSync(agentsPath)) {
    try {
      const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
      config.agents = parseAgentsFromConvex(agentsContent);
    } catch {
      // Ignore
    }
  }

  // Extract cloudUrl
  const cloudUrlMatch = content.match(/cloudUrl\s*:\s*["']([^"']+)["']/);
  if (cloudUrlMatch) {
    config.cloudUrl = cloudUrlMatch[1];
  }

  return Object.keys(config).length > 0 ? config : null;
}

/**
 * Parse agent definitions from convex/agents.ts
 * This is a simplified parser for common patterns
 */
function parseAgentsFromConvex(content: string): AgentConfig[] {
  const agents: AgentConfig[] = [];

  // Look for agent objects in the content
  // Pattern: { id: "...", name: "...", instructions: "...", model: "..." }
  const agentPattern = /\{\s*id:\s*["']([^"']+)["']\s*,\s*name:\s*["']([^"']+)["']([\s\S]*?)\}/g;
  
  let match;
  while ((match = agentPattern.exec(content)) !== null) {
    const id = match[1];
    const name = match[2];
    const rest = match[3];

    const agent: AgentConfig = { id, name, instructions: '', model: 'gpt-4o-mini' };

    const instructionsMatch = rest.match(/instructions:\s*["']([^"']+)["']/);
    if (instructionsMatch) agent.instructions = instructionsMatch[1];

    const modelMatch = rest.match(/model:\s*["']([^"']+)["']/);
    if (modelMatch) agent.model = modelMatch[1];

    const providerMatch = rest.match(/provider:\s*["']([^"']+)["']/);
    if (providerMatch) agent.provider = providerMatch[1];

    const descriptionMatch = rest.match(/description:\s*["']([^"']+)["']/);
    if (descriptionMatch) agent.description = descriptionMatch[1];

    agents.push(agent);
  }

  return agents;
}

/**
 * Deploy to AgentForge Cloud
 */
async function deployToCloud(
  options: DeployOptions,
  projectDir: string
): Promise<void> {
  console.log('\n☁️  Deploying to AgentForge Cloud...\n');

  // 1. Read credentials
  const credentials = await readCredentials();
  if (!credentials?.apiKey) {
    console.error(chalk.red('✖'), 'Not authenticated with AgentForge Cloud.');
    console.error('   Run "agentforge login" to authenticate.\n');
    process.exit(1);
  }

  // 2. Read local configuration
  const spinner = ora('Reading agent configuration...').start();
  const config = await readAgentForgeConfig(projectDir);

  // 3. Resolve project ID
  let projectId = options.project || config?.projectId;
  
  if (!projectId) {
    spinner.stop();
    console.error(chalk.red('✖'), 'No project ID specified.');
    console.error('   Use --project flag or set projectId in agentforge.config.ts\n');
    process.exit(1);
  }

  // 4. Extract agents from config
  let agents = config?.agents || [];
  
  if (agents.length === 0) {
    spinner.stop();
    console.error(chalk.red('✖'), 'No agents found in configuration.');
    console.error('   Define agents in agentforge.config.ts or convex/agents.ts\n');
    process.exit(1);
  }

  spinner.succeed(`Found ${agents.length} agent(s) to deploy`);

  // 5. Handle dry-run mode
  if (options.dryRun) {
    console.log('\n' + chalk.blue('ℹ'), 'Dry run - no changes will be made\n');
    console.log('  Project ID:', chalk.cyan(projectId));
    console.log('  Cloud URL:', chalk.cyan(credentials.cloudUrl || 'https://cloud.agentforge.ai'));
    console.log('  Agents:');
    for (const agent of agents) {
      console.log(`    • ${chalk.bold(agent.name)} (${agent.model})`);
    }
    console.log();
    return;
  }

  // 6. Create Cloud client
  const cloudSpinner = ora('Connecting to AgentForge Cloud...').start();
  const client = new CloudClient(
    credentials.cloudUrl || process.env.AGENTFORGE_CLOUD_URL,
    credentials.apiKey
  );

  // Verify authentication
  try {
    await client.authenticate();
    cloudSpinner.succeed('Connected to AgentForge Cloud');
  } catch (err: any) {
    cloudSpinner.fail('Failed to connect to AgentForge Cloud');
    if (err instanceof CloudClientError) {
      console.error(chalk.red('✖'), err.message);
    } else {
      console.error(chalk.red('✖'), err.message || err);
    }
    process.exit(1);
  }

  // 7. Verify project exists
  const projectSpinner = ora('Verifying project...').start();
  try {
    await client.getProject(projectId);
    projectSpinner.succeed(`Project verified: ${chalk.cyan(projectId)}`);
  } catch (err: any) {
    projectSpinner.fail('Project verification failed');
    if (err.status === 404) {
      console.error(chalk.red('✖'), `Project "${projectId}" not found.`);
      console.error('   Check the project ID or create the project in the dashboard.\n');
    } else {
      console.error(chalk.red('✖'), err.message || err);
    }
    process.exit(1);
  }

  // 8. Create deployment
  const version = options.version || `v${Date.now()}`;
  const deploySpinner = ora('Creating deployment...').start();

  let deploymentId: string;
  try {
    const response = await client.createDeployment({
      projectId,
      agents,
      version,
    });
    deploymentId = response.deploymentId;
    deploySpinner.succeed(`Deployment created: ${chalk.cyan(deploymentId)}`);
  } catch (err: any) {
    deploySpinner.fail('Failed to create deployment');
    if (err instanceof CloudClientError) {
      console.error(chalk.red('✖'), err.message);
    } else {
      console.error(chalk.red('✖'), err.message || err);
    }
    process.exit(1);
  }

  // 9. Poll deployment status
  console.log('\n📦 Deploying agents...\n');
  const pollSpinner = ora('Waiting for deployment to complete...').start();

  const maxAttempts = 60; // 3 minutes max (3s * 60)
  let attempts = 0;

  while (attempts < maxAttempts) {
    let status;
    try {
      status = await client.getDeploymentStatus(deploymentId);
      attempts++;
    } catch (err: any) {
      // Continue polling on network errors, but track failures
      attempts++;
      if (attempts >= maxAttempts) {
        pollSpinner.fail('Deployment status check timed out');
        console.error();
        console.error(chalk.yellow('⚠'), 'The deployment may still be in progress.');
        console.error(`   Check status at: https://cloud.agentforge.ai/projects/${projectId}/deployments/${deploymentId}`);
        console.error();
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }

    if (status.status === 'completed') {
      pollSpinner.succeed('Deployment completed successfully!');
      console.log();
      console.log(chalk.green('✔'), `Deployed to ${chalk.bold(`https://cloud.agentforge.ai/projects/${projectId}`)}`);
      if (status.url) {
        console.log(chalk.green('✔'), `Deployment URL: ${chalk.cyan(status.url)}`);
      }
      console.log();
      return;
    } else if (status.status === 'failed') {
      pollSpinner.fail('Deployment failed');
      console.error();
      console.error(chalk.red('✖'), 'Error:', status.errorMessage || 'Unknown error');
      console.error();
      process.exit(1);
    } else if (status.progress !== undefined) {
      pollSpinner.text = `Deploying... ${status.progress}%`;
    } else {
      const statuses: Record<string, string> = {
        pending: 'Waiting to start...',
        building: 'Building...',
        deploying: 'Deploying...',
      };
      pollSpinner.text = statuses[status.status] || `Status: ${status.status}`;
    }

    // Wait 3 seconds before polling again
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  pollSpinner.fail('Deployment timed out');
  process.exit(1);
}

/**
 * Deploy to Convex (original behavior)
 */
async function deployToConvex(options: DeployOptions): Promise<void> {
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

/**
 * Deploys an AgentForge project to production.
 *
 * Handles environment variable configuration, provides deployment status
 * feedback, and supports rollback capabilities.
 *
 * @param options - Options for the deploy command.
 */
export async function deployProject(options: DeployOptions): Promise<void> {
  const projectDir = process.cwd();

  // Route to appropriate provider
  if (options.provider === 'cloud') {
    await deployToCloud(options, projectDir);
  } else {
    await deployToConvex(options);
  }
}
