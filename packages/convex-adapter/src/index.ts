/**
 * @agentforge-ai/convex-adapter
 *
 * Bridges @agentforge-ai/core with the Convex backend, providing Convex-aware
 * wrappers for agents, MCP servers, and encrypted secret management.
 *
 * ## Main Exports
 *
 * - **ConvexAgentAdapter** - Wraps core Agent for use in Convex Node Actions
 * - **createConvexAgent** - Factory function for creating adapter instances
 * - **createConvexAgentFromRecord** - Create adapter from stored agent record
 * - **getModel, parseModelString** - Model resolver utilities
 * - **ConvexMCPServer** - MCP tool registry with Convex persistence
 * - **ConvexVault** - AES-256-GCM encrypted secrets store
 * - **ConvexAgent** - Legacy adapter (deprecated, use ConvexAgentAdapter)
 * - **ModelFailoverChain** - Automatic failover across LLM providers
 * - **createFailoverChain** - Factory for creating failover chains from model strings
 * - **createFailoverChainFromConfig** - Factory for creating chains from JSON config
 * - **createFailoverChainFromAgent** - Factory for creating chains from agent records
 * - **ProviderRegistry** - Centralized provider management with cost & latency tracking
 *
 * @example
 * ```typescript
 * import { ConvexAgentAdapter, createConvexAgent } from '@agentforge-ai/convex-adapter';
 *
 * // Using factory function
 * const adapter = createConvexAgent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are helpful.',
 *   model: 'openai/gpt-4o',
 * });
 *
 * // In a Convex Node Action:
 * const result = await adapter.runInAction(ctx, messages, {
 *   onUsage: (usage) => { // record to Convex }
 * });
 * ```
 *
 * @packageDocumentation
 */

// New adapter pattern exports
export {
  ConvexAgentAdapter,
  ConvexAgent,
  createConvexAgent,
  createConvexAgentFromRecord,
  getModel,
  parseModelString,
  createModelConfigFromRecord,
} from './convex-agent.js';

export type {
  ConvexAgentConfig,
  ConvexAgentResponse,
  ModelResolverConfig,
  Message,
  RunInActionOptions,
  RunResult,
} from './convex-agent.js';

export type { LLMProvider } from './types.js';

// MCP Server exports
export { ConvexMCPServer } from './convex-mcp-server.js';
export type { ConvexMCPServerConfig } from './convex-mcp-server.js';

// Vault exports
export { ConvexVault, maskValue } from './convex-vault.js';

// Failover Chain exports
export {
  ModelFailoverChain,
  createFailoverChain,
  createFailoverChainFromConfig,
  createFailoverChainFromAgent,
} from './failover-chain.js';

export type {
  FailoverChainConfig,
  FailoverModelConfig,
  RetryPolicy,
  CircuitBreakerConfig,
  FailoverEvent,
  CircuitStateChangeEvent,
  FailoverErrorCategory,
  CircuitState,
  FailoverResult,
} from './failover-chain.js';

// Provider Registry exports
export {
  ProviderRegistry,
  getProviderRegistry,
  resetProviderRegistry,
} from './provider-registry.js';

export type {
  ModelPricing,
  RegisteredModel,
  RegisteredProvider,
  ProviderMetrics,
  CostEstimate,
} from './provider-registry.js';

// Additional type exports
export type {
  ConvexActionCtx,
  ConvexMutationCtx,
  UsageMetrics,
  PersistedToolRecord,
  VaultConfig,
  EncryptionResult,
} from './types.js';
