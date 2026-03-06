/**
 * AgentForge Runtime Package
 *
 * Central daemon for managing Mastra agents and channel adapters.
 *
 * @packageDocumentation
 */

// Re-export types
export type {
  AgentDefinition,
  AgentForgeDaemon,
  ChannelAdapter,
  ChannelConfig,
  ChannelsConfig,
  DaemonConfig,
} from './daemon/types.js';

// Re-export config helper
export { defineConfig } from './config.js';

// Re-export daemon factory
export { createDaemon, AgentForgeDaemonImpl } from './daemon/daemon.js';

/**
 * Create an AgentForge daemon instance
 *
 * Example:
 * ```ts
 * import { createDaemon } from '@agentforge-ai/runtime'
 *
 * const daemon = createDaemon({
 *   defaultModel: 'moonshotai/kimi-k2.5',
 *   convexUrl: process.env.CONVEX_URL,
 * })
 *
 * await daemon.loadAgents([{
 *   id: 'main',
 *   name: 'Main Agent',
 *   instructions: 'You are a helpful assistant.',
 * }])
 *
 * await daemon.start()
 * ```
 */
export { createDaemon as default } from './daemon/daemon.js';
