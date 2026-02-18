import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'fs-extra';

/**
 * Supported sandbox providers for agent tool execution.
 */
export type SandboxType = 'local' | 'docker' | 'e2b' | 'none';

/**
 * Options for the run command.
 */
export interface RunOptions {
  /** The port for the dev server. */
  port: string;
  /** The sandbox provider to use for agent tool execution. */
  sandbox: SandboxType;
}

/**
 * Starts the local development environment for an AgentForge project.
 *
 * This command starts the Convex development server and watches for file changes.
 * When `--sandbox docker` is specified, agent tool execution will use Docker
 * containers for isolation instead of the default local sandbox.
 *
 * @param options - Options for the run command.
 */
export async function runProject(options: RunOptions): Promise<void> {
  const projectDir = process.cwd();

  // Verify we're in an AgentForge project
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

  console.log(`\n🚀 Starting AgentForge development server...\n`);
  console.log(`  Convex dev server starting on port ${options.port}...`);

  // Log sandbox configuration
  if (options.sandbox === 'docker') {
    console.log(`  🐳 Docker sandbox enabled — agent tools will execute in isolated containers`);
    console.log(`     Image: ${process.env['DOCKER_IMAGE'] ?? 'node:22-slim (default)'}`);
    console.log(`     Host:  ${process.env['DOCKER_HOST'] ?? '/var/run/docker.sock (default)'}`);
  } else if (options.sandbox === 'e2b') {
    console.log(`  ☁️  E2B sandbox enabled — agent tools will execute in cloud sandboxes`);
  } else if (options.sandbox === 'none') {
    console.log(`  ⚠️  No sandbox — agent tools will execute directly on the host (unsafe)`);
  } else {
    console.log(`  📦 Local sandbox enabled (default)`);
  }

  // Set sandbox environment variable for downstream consumers
  const sandboxEnv = {
    ...process.env,
    AGENTFORGE_SANDBOX_PROVIDER: options.sandbox,
  };

  // Start the Convex dev server
  const convexProcess = spawn('npx', ['convex', 'dev'], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: true,
    env: sandboxEnv,
  });

  convexProcess.on('error', (err) => {
    console.error(`Failed to start Convex dev server: ${err.message}`);
    process.exit(1);
  });

  convexProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Convex dev server exited with code ${code}`);
    }
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\n👋 Shutting down AgentForge dev server...');
    convexProcess.kill('SIGTERM');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
