/**
 * AgentForge Config
 *
 * Helper for defining agentforge.config.ts files
 */

import type { DaemonConfig } from './daemon/types.js';

/**
 * Define AgentForge daemon configuration
 *
 * Use this in your agentforge.config.ts file:
 *
 * ```ts
 * import { defineConfig } from "@agentforge-ai/runtime"
 *
 * export default defineConfig({
 *   daemon: {
 *     defaultModel: "moonshotai/kimi-k2.5",
 *   },
 *   channels: {
 *     http: { port: 3001 },
 *   },
 *   agents: [...]
 * })
 * ```
 */
export function defineConfig(config: DaemonConfig): DaemonConfig {
  return config;
}
