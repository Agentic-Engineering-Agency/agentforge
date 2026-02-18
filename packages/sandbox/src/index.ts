/**
 * @agentforge-ai/sandbox
 *
 * Docker-based sandbox provider for agent tool execution isolation.
 *
 * Provides container-based isolation for agent code execution using Docker,
 * with a warm container pool for latency reduction and a unified manager
 * that supports both Docker and E2B providers.
 *
 * @example
 * ```ts
 * import { DockerSandbox, SandboxManager } from '@agentforge-ai/sandbox';
 *
 * // Direct usage
 * const sandbox = new DockerSandbox({
 *   scope: 'agent',
 *   workspaceAccess: 'ro',
 *   workspacePath: './workspace',
 * });
 * await sandbox.start();
 * const { stdout } = await sandbox.exec('node --version');
 * console.log(stdout);
 * await sandbox.destroy();
 *
 * // Via manager
 * const manager = new SandboxManager({ provider: 'docker' });
 * await manager.initialize();
 * const sb = await manager.create({ scope: 'agent', workspaceAccess: 'none' });
 * await manager.destroy(sb);
 * ```
 *
 * @packageDocumentation
 */

export { DockerSandbox } from './docker-sandbox.js';
export { ContainerPool } from './container-pool.js';
export { SandboxManager, isDockerAvailable } from './sandbox-manager.js';
export {
  SecurityError,
  validateBind,
  validateBinds,
  validateImageName,
  validateCommand,
  BLOCKED_BIND_PREFIXES,
  DEFAULT_CAP_DROP,
} from './security.js';
export type {
  SandboxProvider,
  DockerSandboxConfig,
  ExecOptions,
  ExecResult,
  ResourceLimits,
  PoolConfig,
  PoolEntry,
  SandboxManagerConfig,
} from './types.js';
