/**
 * @module types
 *
 * Shared types for the AgentForge sandbox abstraction layer.
 *
 * Every sandbox provider (Docker, E2B, future providers) implements the
 * {@link SandboxProvider} interface, ensuring a unified API for agent
 * tool execution regardless of the underlying isolation technology.
 */

// ---------------------------------------------------------------------------
// Execution primitives
// ---------------------------------------------------------------------------

/**
 * Options passed to {@link SandboxProvider.exec} for a single command invocation.
 */
export interface ExecOptions {
  /** Timeout in milliseconds for this specific execution. */
  timeout?: number;
  /** Working directory inside the container / sandbox. */
  cwd?: string;
  /** Additional environment variables for this execution. */
  env?: Record<string, string>;
}

/**
 * The result of a sandbox command execution.
 */
export interface ExecResult {
  /** Combined stdout output. */
  stdout: string;
  /** Combined stderr output. */
  stderr: string;
  /** Exit code (0 = success). */
  exitCode: number;
}

// ---------------------------------------------------------------------------
// SandboxProvider — the unified interface
// ---------------------------------------------------------------------------

/**
 * Unified interface implemented by every sandbox provider (Docker, E2B, etc.).
 *
 * All agent tool execution must go through a SandboxProvider to ensure
 * isolation and prevent malicious code from affecting the host system.
 */
export interface SandboxProvider {
  // --- Lifecycle ---

  /** Start / warm up the sandbox so it is ready to accept commands. */
  start(): Promise<void>;

  /**
   * Stop the sandbox gracefully (may keep the container for reuse).
   * Implementations that do not support reuse may treat this as destroy().
   */
  stop(): Promise<void>;

  /**
   * Permanently destroy all resources associated with this sandbox.
   * Must be idempotent — safe to call multiple times.
   */
  destroy(): Promise<void>;

  // --- Execution ---

  /**
   * Execute a shell command inside the sandbox.
   * @param command - The shell command string to run (via /bin/sh -c).
   * @param options - Per-call options (timeout, cwd, env).
   */
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;

  /**
   * Read a file from the sandbox filesystem.
   * @param path - Absolute path inside the sandbox.
   */
  readFile(path: string): Promise<string>;

  /**
   * Write content to a file inside the sandbox filesystem.
   * @param path    - Absolute path inside the sandbox.
   * @param content - UTF-8 string to write.
   */
  writeFile(path: string, content: string): Promise<void>;

  // --- Health ---

  /** Returns true if the sandbox is currently running and accepting commands. */
  isRunning(): Promise<boolean>;

  /** Returns the provider-specific container/session ID, or null if not started. */
  getContainerId(): string | null;
}

// ---------------------------------------------------------------------------
// Resource limits
// ---------------------------------------------------------------------------

/**
 * Resource limits that can be applied to a DockerSandbox container.
 */
export interface ResourceLimits {
  /** CPU shares (relative weight). Docker default: 1024. */
  cpuShares?: number;
  /** Memory limit in megabytes. */
  memoryMb?: number;
  /** Disk quota in megabytes (requires overlay2 quota support). */
  diskMb?: number;
  /** When true the container has no network access. */
  networkDisabled?: boolean;
  /** Maximum number of PIDs inside the container. */
  pidsLimit?: number;
}

// ---------------------------------------------------------------------------
// Docker sandbox config
// ---------------------------------------------------------------------------

/**
 * Configuration for a {@link DockerSandbox} instance.
 */
export interface DockerSandboxConfig {
  /**
   * Lifecycle scope:
   * - `session` — one container per user session
   * - `agent`   — one container per agent run
   * - `shared`  — long-running shared container (pool-managed)
   */
  scope: 'session' | 'agent' | 'shared';

  /**
   * How the host workspace is mounted inside the container:
   * - `none` — no host filesystem access
   * - `ro`   — read-only bind mount
   * - `rw`   — read-write bind mount
   */
  workspaceAccess: 'none' | 'ro' | 'rw';

  /** Docker image to use. Defaults to `node:22-slim`. */
  image?: string;

  /** Resource constraints applied to the container. */
  resourceLimits?: ResourceLimits;

  /**
   * Additional bind mounts in `host:container[:mode]` format.
   * Dangerous paths (/var/run/docker.sock, /etc, /proc, /sys) are blocked.
   */
  binds?: string[];

  /** Environment variables injected into the container. */
  env?: Record<string, string>;

  /**
   * Automatic kill timeout in seconds.
   * The container is force-killed after this many seconds of total uptime.
   */
  timeout?: number;

  /**
   * Path to the workspace directory on the host.
   * Used when `workspaceAccess` is `ro` or `rw` to mount the workspace.
   */
  workspacePath?: string;

  /**
   * Path inside the container where the workspace is mounted.
   * Defaults to `/workspace`.
   */
  containerWorkspacePath?: string;
}

// ---------------------------------------------------------------------------
// Container pool config
// ---------------------------------------------------------------------------

/**
 * Pool configuration for {@link ContainerPool}.
 */
export interface PoolConfig {
  /** Docker image to pre-warm. */
  image: string;
  /** Scope used when naming / managing pooled containers. */
  scope: 'session' | 'agent' | 'shared';
  /** Maximum number of warm containers to keep ready. Defaults to 3. */
  maxSize?: number;
  /** Seconds of idle time before evicting a warm container. Defaults to 300. */
  idleTimeoutSeconds?: number;
}

/**
 * A single entry tracked by the {@link ContainerPool}.
 */
export interface PoolEntry {
  sandbox: SandboxProvider;
  createdAt: number;
  lastUsedAt: number;
  inUse: boolean;
}

// ---------------------------------------------------------------------------
// Sandbox manager config
// ---------------------------------------------------------------------------

/**
 * Configuration for the {@link SandboxManager} factory.
 */
export interface SandboxManagerConfig {
  /**
   * Which provider to use when creating new sandboxes.
   * Defaults to `docker`.
   */
  provider?: 'docker' | 'e2b';

  /**
   * Passed through to DockerSandbox when provider === 'docker'.
   */
  dockerConfig?: Omit<DockerSandboxConfig, 'scope' | 'workspaceAccess'>;

  /**
   * Docker host configuration. Defaults to the local Unix socket.
   */
  dockerHost?: {
    socketPath?: string;
    host?: string;
    port?: number;
    protocol?: 'http' | 'https';
  };
}
