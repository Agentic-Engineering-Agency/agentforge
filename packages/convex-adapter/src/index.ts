/**
 * @agentforge-ai/convex-adapter
 *
 * Bridges @agentforge-ai/core with the Convex backend, providing Convex-aware
 * wrappers for agents, MCP servers, and encrypted secret management.
 *
 * ## Main Exports
 *
 * - **ConvexAgent** - Wraps core Agent for use in Convex actions
 * - **ConvexMCPServer** - MCP tool registry with Convex persistence
 * - **ConvexVault** - AES-256-GCM encrypted secrets store
 *
 * @example
 * ```typescript
 * import { ConvexAgent, ConvexMCPServer, ConvexVault } from '@agentforge-ai/convex-adapter';
 * ```
 *
 * @packageDocumentation
 */

export { ConvexAgent } from './convex-agent.js';
export { ConvexMCPServer } from './convex-mcp-server.js';
export type { ConvexMCPServerConfig } from './convex-mcp-server.js';
export { ConvexVault, maskValue } from './convex-vault.js';

export type {
  ConvexActionCtx,
  ConvexMutationCtx,
  ConvexAgentConfig,
  ConvexAgentResponse,
  UsageMetrics,
  PersistedToolRecord,
  VaultConfig,
  EncryptionResult,
} from './types.js';
