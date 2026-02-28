import type { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import { header, success, error, info, dim } from '../lib/display.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SandboxOptions {
  file: string;
  image?: string;
  timeout?: number;
}

// ─── Command Registration ─────────────────────────────────────────────────────

export function registerSandboxCommand(program: Command): void {
  program
    .command('sandbox')
    .description('Run code in an isolated Docker sandbox')
    .argument('<file>', 'Path to the JavaScript/TypeScript file to execute')
    .option('-i, --image <image>', 'Docker image to use (default: node:22-slim)', 'node:22-slim')
    .option('-t, --timeout <ms>', 'Execution timeout in milliseconds (default: 30000)', '30000')
    .action(async (file: string, options: SandboxOptions) => {
      await runSandbox(file, options);
    });
}

// ─── Implementation ────────────────────────────────────────────────────────────

async function runSandbox(file: string, options: SandboxOptions): Promise<void> {
  header();

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
    const sandboxModule = await import('@agentforge-ai/core/sandbox');
    SandboxManager = sandboxModule.DockerSandboxManager;
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
