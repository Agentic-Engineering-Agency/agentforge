/**
 * @module sandbox-manager
 *
 * SandboxManager — factory + registry for sandbox instances.
 *
 * Responsibilities:
 * - Create the correct sandbox type (Docker | E2B) from a unified config.
 * - Apply the `agentforge-{scope}-{id}` naming convention.
 * - Track active sandboxes and clean them up on process exit.
 * - Verify Docker availability on startup; print a friendly message if absent.
 */

import Dockerode from 'dockerode';
import { randomUUID } from 'node:crypto';
import { DockerSandbox } from './docker-sandbox.js';
import { NativeSandbox, isNativeSandboxAvailable } from './native-sandbox.js';
import type {
  DockerSandboxConfig,
  ExecOptions,
  ExecResult,
  NativeSandboxConfig,
  SandboxManagerConfig,
  SandboxProvider,
} from './types.js';

/**
 * A thin E2B stub that satisfies {@link SandboxProvider} but throws at runtime.
 * The real E2B implementation lives in @agentforge-ai/core.
 * This stub lets the manager compile and be tested without the E2B dependency.
 */
class E2BProviderStub implements SandboxProvider {
  async start(): Promise<void> {
    throw new Error(
      'SandboxManager: E2B provider is not bundled in @agentforge-ai/sandbox. ' +
        'Use the SandboxManager from @agentforge-ai/core instead.',
    );
  }
  async stop(): Promise<void> { /* noop until started */ }
  async destroy(): Promise<void> { /* noop */ }
  async exec(_cmd: string, _opts?: ExecOptions): Promise<ExecResult> {
    throw new Error('E2BProviderStub: not implemented');
  }
  async readFile(_path: string): Promise<string> {
    throw new Error('E2BProviderStub: not implemented');
  }
  async writeFile(_path: string, _content: string): Promise<void> {
    throw new Error('E2BProviderStub: not implemented');
  }
  async isRunning(): Promise<boolean> { return false; }
  getContainerId(): string | null { return null; }
}

/**
 * Checks whether the Docker daemon is reachable.
 *
 * @param docker - Dockerode instance to ping.
 * @returns `true` if Docker is available, `false` otherwise.
 */
export async function isDockerAvailable(docker: Dockerode): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Central factory and lifecycle manager for sandbox instances.
 *
 * @example
 * ```ts
 * const manager = new SandboxManager({ provider: 'docker' });
 * await manager.initialize();
 *
 * const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });
 * const result = await sb.exec('echo hello');
 * await manager.destroy(sb);
 *
 * await manager.shutdown();
 * ```
 */
export class SandboxManager {
  private readonly config: SandboxManagerConfig;
  private readonly docker: Dockerode;
  private readonly active = new Map<string, SandboxProvider>();
  private shutdownRegistered = false;

  constructor(config: SandboxManagerConfig = {}) {
    this.config = { provider: 'docker', ...config };

    const dockerHostCfg = config.dockerHost;
    if (dockerHostCfg?.host) {
      this.docker = new Dockerode({
        host: dockerHostCfg.host,
        port: dockerHostCfg.port ?? 2376,
        protocol: dockerHostCfg.protocol ?? 'http',
      });
    } else {
      this.docker = new Dockerode({
        socketPath: dockerHostCfg?.socketPath ?? '/var/run/docker.sock',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Initialize the manager. For the Docker provider this verifies that the
   * Docker daemon is reachable. Call this once at application startup.
   *
   * @throws Error if the Docker daemon cannot be reached (Docker provider only).
   */
  async initialize(): Promise<void> {
    if (this.config.provider === 'docker') {
      const available = await isDockerAvailable(this.docker);
      if (!available) {
        console.warn(
          '[SandboxManager] Docker daemon is not reachable. ' +
            'Agent tool execution will fail until Docker is started. ' +
            'Install Docker: https://docs.docker.com/get-docker/',
        );
      }
    }

    if (this.config.provider === 'native') {
      const { available, method } = await isNativeSandboxAvailable();
      if (!available) {
        console.warn(
          '[SandboxManager] No native isolation method found (sandbox-exec / bwrap). ' +
            'Sandboxes will run with limited isolation (timeout + env filtering only).',
        );
      } else {
        console.info(`[SandboxManager] Native isolation available: ${method}`);
      }
    }

    this._registerShutdownHandlers();
  }

  /**
   * Create and start a new sandbox.
   *
   * The sandbox is registered internally; call {@link SandboxManager.destroy}
   * or {@link SandboxManager.shutdown} to release it.
   *
   * @param overrides - Per-sandbox config overrides merged with manager defaults.
   */
  async create(
    overrides: Pick<DockerSandboxConfig, 'scope' | 'workspaceAccess'> &
      Partial<DockerSandboxConfig>,
  ): Promise<SandboxProvider> {
    if (this.config.provider === 'e2b') {
      const stub = new E2BProviderStub();
      const id = this._generateId(overrides.scope);
      this.active.set(id, stub);
      return stub;
    }

    if (this.config.provider === 'native') {
      const nativeConfig: NativeSandboxConfig = {
        scope: overrides.scope,
        profile: this.config.nativeConfig?.profile,
        workingDirectory: this.config.nativeConfig?.workingDirectory,
      };
      const sandbox = new NativeSandbox(nativeConfig);
      await sandbox.start();
      const id = this._generateId(overrides.scope);
      this.active.set(id, sandbox);
      return sandbox;
    }

    const mergedConfig: DockerSandboxConfig = {
      image: 'node:22-slim',
      ...this.config.dockerConfig,
      ...overrides,
    };

    const sandbox = new DockerSandbox(mergedConfig, this.docker);
    await sandbox.start();

    const id = this._generateId(overrides.scope);
    this.active.set(id, sandbox);
    return sandbox;
  }

  /**
   * Destroy a specific sandbox and remove it from the active registry.
   */
  async destroy(sandbox: SandboxProvider): Promise<void> {
    await sandbox.destroy();
    for (const [key, value] of this.active) {
      if (value === sandbox) {
        this.active.delete(key);
        break;
      }
    }
  }

  /**
   * Destroy all active sandboxes and shut the manager down.
   * Called automatically on SIGTERM / SIGINT when registered.
   */
  async shutdown(): Promise<void> {
    const destroyAll = Array.from(this.active.values()).map((sb) =>
      sb.destroy().catch((err: unknown) => {
        console.error('[SandboxManager] Error destroying sandbox during shutdown:', err);
      }),
    );
    await Promise.all(destroyAll);
    this.active.clear();
  }

  /**
   * Returns the number of currently active sandboxes.
   */
  get activeCount(): number {
    return this.active.size;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _generateId(scope: string): string {
    return `agentforge-${scope}-${randomUUID().slice(0, 8)}`;
  }

  private _registerShutdownHandlers(): void {
    if (this.shutdownRegistered) return;
    this.shutdownRegistered = true;

    const handler = () => {
      void this.shutdown().finally(() => process.exit(0));
    };

    process.once('SIGTERM', handler);
    process.once('SIGINT', handler);
    process.once('beforeExit', () => void this.shutdown());
  }
}
