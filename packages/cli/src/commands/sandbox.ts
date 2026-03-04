import type { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { header, success, error, info, dim } from '../lib/display.js';
import { createClient, safeCall } from '../lib/convex-client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SandboxOptions {
  file: string;
  image?: string;
  timeout?: number;
}

interface SandboxRunOptions {
  message: string;
}

// ─── Command Registration ─────────────────────────────────────────────────────

export function registerSandboxCommand(program: Command): void {
  const sandboxCmd = program
    .command('sandbox')
    .description('Run code in an isolated Docker sandbox');

  // Original file execution command
  sandboxCmd
    .command('run-file')
    .argument('<file>', 'Path to the JavaScript/TypeScript file to execute')
    .option('-i, --image <image>', 'Docker image to use (default: node:22-slim)', 'node:22-slim')
    .option('-t, --timeout <ms>', 'Execution timeout in milliseconds (default: 30000)', '30000')
    .action(async (file: string, options: SandboxOptions) => {
      await runSandbox(file, options);
    });

  // SPEC-016 Task 3: New sandbox run command for agents
  sandboxCmd
    .command('run')
    .argument('<agent-id>', 'Agent ID to run in sandbox')
    .requiredOption('-m, --message <text>', 'Message to send to the agent')
    .action(async (agentId: string, options: SandboxRunOptions) => {
      await runAgentInSandbox(agentId, options);
    });

  // Default to run-file if no subcommand is provided (backward compatibility)
  sandboxCmd
    .argument('<file>', 'Path to the JavaScript/TypeScript file to execute')
    .option('-i, --image <image>', 'Docker image to use (default: node:22-slim)', 'node:22-slim')
    .option('-t, --timeout <ms>', 'Execution timeout in milliseconds (default: 30000)', '30000')
    .action(async (file: string, options: SandboxOptions) => {
      await runSandbox(file, options);
    });
}

// ─── Implementation ────────────────────────────────────────────────────────────

async function runSandbox(file: string, options: SandboxOptions): Promise<void> {
  header('Sandbox');

  // Validate file exists
  const filePath = path.resolve(file);
  if (!(await fs.pathExists(filePath))) {
    error(`File not found: ${file}`);
    process.exit(1);
  }

  const imageName = options.image || 'node:22-slim';
  const timeoutMs = parseInt(String(options.timeout), 10) || 30000;

  info(`Running file in isolated Docker sandbox`);
  dim(`File: ${filePath}`);
  dim(`Image: ${imageName}`);
  dim(`Timeout: ${timeoutMs}ms`);

  // Import sandbox manager dynamically
  let SandboxManager: any;
  try {
    const coreModule = await import('@agentforge-ai/core');
    SandboxManager = coreModule.DockerSandboxManager;
  } catch (err) {
    error('Failed to load sandbox module. Make sure @agentforge-ai/core is installed.');
    process.exit(1);
  }

  // Create sandbox manager
  const manager = new SandboxManager({
    provider: 'docker',
    dockerConfig: {
      image: imageName,
      timeout: timeoutMs / 1000,
    },
  });

  let sandbox: any;
  try {
    // Initialize manager
    await manager.initialize();

    // Create sandbox
    sandbox = await manager.create({
      scope: 'agent',
      workspaceAccess: 'none',
    });

    success('Sandbox started');
    const containerId = sandbox.getContainerId();
    if (containerId) {
      dim(`Container ID: ${containerId}`);
    }

    // Read file content
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    // Write file to sandbox
    await sandbox.writeFile(`/workspace/${fileName}`, fileContent);
    dim(`File written to sandbox: /workspace/${fileName}`);

    // Execute the file
    info('Executing file...');
    const result = await sandbox.exec(`node /workspace/${fileName}`, {
      timeout: timeoutMs,
    });

    // Print output
    if (result.stdout) {
      console.log('\n' + result.stdout);
    }

    if (result.stderr) {
      console.error('\n' + result.stderr);
    }

    if (result.exitCode === 0) {
      success('Execution completed successfully');
    } else {
      error(`Execution failed with exit code ${result.exitCode}`);
      process.exit(result.exitCode);
    }
  } catch (err) {
    error(`Sandbox execution failed: ${err instanceof Error ? err.message : String(err)}`);
    await manager.shutdown();
    process.exit(1);
  } finally {
    if (sandbox) {
      await manager.destroy(sandbox);
      success('Sandbox destroyed');
    }
    await manager.shutdown();
  }
}

// ─── SPEC-016 Task 3: Run Agent in Docker Sandbox ────────────────────────────────

async function runAgentInSandbox(agentId: string, options: SandboxRunOptions): Promise<void> {
  header('Sandbox Agent Execution');

  // 1. Check if Docker is installed
  let dockerVersion: string;
  try {
    dockerVersion = execSync('docker --version', { encoding: 'utf-8' }).trim();
    dim(`Docker: ${dockerVersion}`);
  } catch (err) {
    error('Docker is not installed or not accessible. Please install Docker first.');
    process.exit(1);
  }

  // 2. Fetch agent config from Convex
  const client = await createClient();
  const agent = await safeCall(
    () => client.query('agents:get' as any, { id: agentId }),
    `Agent "${agentId}" not found`
  );

  if (!agent) {
    process.exit(1);
  }

  const a = agent as any;
  const sandboxImage = a.sandboxImage || 'node:20-alpine';

  info(`Running agent in Docker sandbox`);
  dim(`Agent: ${a.name}`);
  dim(`Image: ${sandboxImage}`);
  dim(`Message: ${options.message.substring(0, 100)}${options.message.length > 100 ? '...' : ''}`);

  // 3. Pull image if needed
  info('Checking Docker image...');
  try {
    execSync(`docker pull ${sandboxImage}`, { stdio: 'inherit' });
  } catch (err) {
    error(`Failed to pull Docker image: ${sandboxImage}`);
    process.exit(1);
  }

  // 4. Run agent execution inside container
  info('Executing agent in Docker container...');
  try {
    // For now, we'll execute a simple Node.js script that calls the Convex API
    // In a full implementation, this would mount the agent code and execute it directly
    const execScript = `
const https = require('https');

// Simple script to execute agent via Convex HTTP API
// This is a simplified version - the full implementation would use the Convex SDK

console.log('Executing agent in isolated sandbox environment...');
console.log('Agent ID: ${agentId}');
console.log('Message: ${options.message.replace(/'/g, "\\'")}');
console.log('\\n⚠️  Full sandbox execution requires Convex client in container');
console.log('For now, this demonstrates the Docker container spawning.');
`;

    // Execute the script in the container
    const dockerCommand = `docker run --rm -i ${sandboxImage} node -e "${execScript.replace(/\n/g, '\\n')}"`;
    const result = execSync(dockerCommand, { encoding: 'utf-8', stdio: 'inherit' });

    success('Sandbox execution completed');
  } catch (err) {
    error(`Sandbox execution failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
