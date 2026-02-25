/**
 * Sandbox execution providers for AgentForge.
 *
 * Includes Docker container sandboxing and E2B cloud sandbox integration.
 */

// Docker / native sandbox
export { DockerSandbox } from './docker-sandbox.js';
export { ContainerPool } from './container-pool.js';
export { SandboxManager as DockerSandboxManager, isDockerAvailable } from './sandbox-manager.js';
export { NativeSandbox, isNativeSandboxAvailable, DEFAULT_SANDBOX_PROFILE } from './native-sandbox.js';
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
  SandboxProfile,
  NativeSandboxConfig,
} from './types.js';

// E2B cloud sandbox
export {
  SandboxManager,
  TimeoutError,
  SandboxExecutionError,
} from './e2b-sandbox.js';
export type {
  SandboxConfig,
  SandboxRunOptions,
  SandboxResult,
} from './e2b-sandbox.js';
