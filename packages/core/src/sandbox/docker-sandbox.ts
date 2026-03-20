/**
 * @module docker-sandbox
 *
 * DockerSandbox — a container-backed {@link SandboxProvider} for AgentForge.
 *
 * Each instance manages exactly one Docker container. The container is
 * created lazily on the first call to {@link DockerSandbox.start}, executed
 * via the Docker exec API, and destroyed via {@link DockerSandbox.destroy}.
 *
 * @example
 * ```ts
 * const sandbox = new DockerSandbox({
 *   scope: 'agent',
 *   workspaceAccess: 'ro',
 *   workspacePath: '/home/user/project',
 *   resourceLimits: { memoryMb: 512, cpuShares: 512 },
 * });
 * await sandbox.start();
 * const result = await sandbox.exec('echo hello');
 * console.log(result.stdout); // "hello\n"
 * await sandbox.destroy();
 * ```
 */

import Dockerode from 'dockerode';
import { randomUUID } from 'node:crypto';
import type { DockerSandboxConfig, ExecOptions, ExecResult, SandboxProvider } from './types.js';
import { DEFAULT_CAP_DROP, SecurityError, validateBinds, validateCommand, validateImageName } from './security.js';

/** Default Docker image used when none is specified. */
const DEFAULT_IMAGE = 'node:22-slim';

/** Default per-exec timeout in milliseconds. */
const DEFAULT_EXEC_TIMEOUT_MS = 30_000;

/** Default container workspace mount point. */
const DEFAULT_CONTAINER_WORKSPACE = '/workspace';

// ---------------------------------------------------------------------------
// Stream demuxing
// ---------------------------------------------------------------------------

/**
 * Decodes the multiplexed stream that Docker returns for exec output.
 *
 * Docker prefixes every chunk with an 8-byte header:
 *   [stream_type(1)] [0(3)] [size(4 BE)]
 * where stream_type is 1 = stdout, 2 = stderr.
 */
function demuxDockerStream(buffer: Buffer): { stdout: string; stderr: string } {
  let stdout = '';
  let stderr = '';
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const frameSize = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + frameSize > buffer.length) break;

    const chunk = buffer.slice(offset, offset + frameSize).toString('utf8');
    offset += frameSize;

    if (streamType === 1) {
      stdout += chunk;
    } else if (streamType === 2) {
      stderr += chunk;
    }
  }

  return { stdout, stderr };
}

// ---------------------------------------------------------------------------
// DockerSandbox
// ---------------------------------------------------------------------------

/**
 * Container-based sandbox using the Docker engine.
 *
 * Implements the {@link SandboxProvider} interface for full lifecycle
 * management, command execution, and file I/O within an isolated container.
 */
export class DockerSandbox implements SandboxProvider {
  private readonly config: Required<
    Pick<DockerSandboxConfig, 'scope' | 'workspaceAccess' | 'image' | 'containerWorkspacePath'>
  > &
    DockerSandboxConfig;

  private readonly docker: Dockerode;
  private container: Dockerode.Container | null = null;
  private containerId: string | null = null;
  private killTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param config - Sandbox configuration.
   * @param docker - Optional pre-configured Dockerode instance (useful in tests).
   */
  constructor(config: DockerSandboxConfig, docker?: Dockerode) {
    // Validate security constraints eagerly
    const image = config.image ?? DEFAULT_IMAGE;
    validateImageName(image);

    if (config.binds && config.binds.length > 0) {
      validateBinds(config.binds);
    }

    this.config = {
      ...config,
      image,
      containerWorkspacePath: config.containerWorkspacePath ?? DEFAULT_CONTAINER_WORKSPACE,
    };

    this.docker =
      docker ??
      new Dockerode(
        process.env['DOCKER_HOST']
          ? { host: process.env['DOCKER_HOST'] }
          : { socketPath: '/var/run/docker.sock' },
      );
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Create and start the Docker container.
   * Idempotent — calling start() on an already-running sandbox is a no-op.
   */
  async start(): Promise<void> {
    if (this.container) return;

    const { image, scope, resourceLimits, binds, env, timeout, workspaceAccess, workspacePath, containerWorkspacePath } = this.config;

    const name = `agentforge-${scope}-${randomUUID().slice(0, 8)}`;

    const envArray = Object.entries(env ?? {}).map(([k, v]) => `${k}=${v}`);

    // Build bind mounts
    const allBinds: string[] = [...(binds ?? [])];

    // Mount workspace if configured
    if (workspaceAccess !== 'none' && workspacePath) {
      const mode = workspaceAccess === 'ro' ? 'ro' : 'rw';
      allBinds.push(`${workspacePath}:${containerWorkspacePath}:${mode}`);
    }

    const hostConfig: Dockerode.HostConfig = {
      // Resource limits
      CpuShares: resourceLimits?.cpuShares,
      Memory: resourceLimits?.memoryMb ? resourceLimits.memoryMb * 1024 * 1024 : undefined,
      PidsLimit: resourceLimits?.pidsLimit ?? 256,

      // Security hardening
      CapDrop: [...DEFAULT_CAP_DROP],
      SecurityOpt: ['no-new-privileges:true'],
      ReadonlyRootfs: false,

      // Bind mounts
      Binds: allBinds.length > 0 ? allBinds : undefined,
    };

    this.container = await this.docker.createContainer({
      name,
      Image: image,
      // Keep container alive — we run commands via exec
      Cmd: ['/bin/sh', '-c', 'while true; do sleep 3600; done'],
      Env: envArray,
      AttachStdin: false,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      NetworkDisabled: resourceLimits?.networkDisabled ?? false,
      WorkingDir: containerWorkspacePath,
      Labels: {
        'agentforge.scope': scope,
        'agentforge.managed': 'true',
      },
      HostConfig: hostConfig,
    });

    await this.container.start();
    this.containerId = this.container.id;

    // Auto-kill after configured timeout
    if (timeout && timeout > 0) {
      this.killTimer = setTimeout(() => {
        void this.destroy();
      }, timeout * 1000);
    }
  }

  /**
   * Stop the container gracefully (10 s grace period then SIGKILL).
   * The container is kept for potential restart.
   */
  async stop(): Promise<void> {
    this._clearKillTimer();
    if (!this.container) return;

    try {
      const info = await this.container.inspect();
      if (info.State.Running) {
        await this.container.stop({ t: 10 });
      }
    } catch (error) {
      console.debug('[DockerSandbox.stop] Container may already be stopped:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Destroy the container and release all resources.
   * Safe to call multiple times.
   */
  async destroy(): Promise<void> {
    this._clearKillTimer();
    const container = this.container;
    this.container = null;
    this.containerId = null;

    if (!container) return;

    try {
      await container.remove({ force: true });
    } catch (error) {
      console.debug('[DockerSandbox.destroy] Container already removed:', error instanceof Error ? error.message : error);
    }
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command inside the running container.
   *
   * @param command - Shell command string passed to `/bin/sh -c`.
   * @param options - Per-call options (timeout, cwd, env overrides).
   */
  async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
    if (!this.container) {
      throw new Error('DockerSandbox: container is not running. Call start() first.');
    }

    // Defense-in-depth command validation
    validateCommand(command);

    const timeoutMs = options.timeout ?? DEFAULT_EXEC_TIMEOUT_MS;
    const envOverride = Object.entries(options.env ?? {}).map(([k, v]) => `${k}=${v}`);

    const execInstance = await this.container.exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      WorkingDir: options.cwd,
      Env: envOverride.length > 0 ? envOverride : undefined,
    });

    return new Promise<ExecResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`DockerSandbox: exec timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      execInstance.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
          return;
        }

        if (!stream) {
          clearTimeout(timer);
          reject(new Error('DockerSandbox: no stream returned from exec'));
          return;
        }

        const chunks: Buffer[] = [];

        stream.on('data', (chunk: Buffer) => chunks.push(chunk));

        stream.on('end', async () => {
          clearTimeout(timer);
          try {
            const raw = Buffer.concat(chunks);
            const { stdout, stderr } = demuxDockerStream(raw);

            // Inspect exec to get exit code
            const inspectResult = await execInstance.inspect();
            const exitCode = inspectResult.ExitCode ?? 0;

            resolve({ stdout, stderr, exitCode });
          } catch (inspectErr) {
            reject(inspectErr);
          }
        });

        stream.on('error', (streamErr: Error) => {
          clearTimeout(timer);
          reject(streamErr);
        });
      });
    });
  }

  /**
   * Read a file from the container filesystem by running `cat`.
   *
   * @param path - Absolute path inside the container.
   */
  async readFile(path: string): Promise<string> {
    const result = await this.exec(`cat "${path.replace(/"/g, '\\"')}"`);
    if (result.exitCode !== 0) {
      throw new Error(
        `DockerSandbox.readFile: failed to read "${path}" (exit ${result.exitCode}): ${result.stderr}`,
      );
    }
    return result.stdout;
  }

  /**
   * Write content to a file inside the container using base64 encoding
   * to avoid shell quoting issues.
   *
   * @param path    - Absolute path inside the container.
   * @param content - UTF-8 string content.
   */
  async writeFile(path: string, content: string): Promise<void> {
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    const cmd = `printf '%s' "${b64}" | base64 -d > "${path.replace(/"/g, '\\"')}"`;
    const result = await this.exec(cmd);
    if (result.exitCode !== 0) {
      throw new Error(
        `DockerSandbox.writeFile: failed to write "${path}" (exit ${result.exitCode}): ${result.stderr}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the underlying Docker container is running.
   */
  async isRunning(): Promise<boolean> {
    if (!this.container) return false;
    try {
      const info = await this.container.inspect();
      return info.State.Running === true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the Docker container ID or null if not yet started.
   */
  getContainerId(): string | null {
    return this.containerId;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _clearKillTimer(): void {
    if (this.killTimer !== null) {
      clearTimeout(this.killTimer);
      this.killTimer = null;
    }
  }
}
