/**
 * Configuration Cascade System
 *
 * Resolves agent configuration by cascading through multiple levels:
 * Agent Config -> Project Config -> Global Config -> System Defaults
 *
 * Project and global configs can also provide an `instructionPrefix` that
 * is prepended to the agent's instructions to produce the final
 * `systemPrompt`.
 */

/**
 * System defaults for agent configuration
 */
export const SYSTEM_DEFAULTS = {
  model: "openai/gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
  instructions: "You are a helpful AI assistant.",
} as const;

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  instructions?: string;
  failoverModels?: Array<{ provider: string; model: string }> | string[];
  [key: string]: unknown;
}

/**
 * Project settings interface
 */
export interface ProjectSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultInstructions?: string;
  instructionPrefix?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
  [key: string]: unknown;
}

/**
 * Global settings interface
 */
export interface GlobalSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  instructionPrefix?: string;
  [key: string]: unknown;
}

/**
 * Resolved configuration returned by resolveConfig
 */
export interface ResolvedConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  instructions: string;
  systemPrompt: string;
  failoverModels: Array<{ provider: string; model: string }> | string[];
}

/**
 * Resolve configuration by cascading through levels.
 *
 * Priority: Agent Config -> Project Config -> Global Config -> System Defaults
 *
 * The `instructionPrefix` from project (or global if project has none) is
 * prepended to the agent instructions, separated by a blank line. The
 * combined result is available as `systemPrompt`.
 *
 * @param agentConfig - Agent-level configuration
 * @param projectConfig - Project-level settings
 * @param globalConfig - Global user settings
 * @returns Resolved configuration
 */
export function resolveConfig(
  agentConfig: Record<string, unknown>,
  projectConfig: Record<string, unknown> | null,
  globalConfig: Record<string, unknown> | null,
): ResolvedConfig {
  const instructions =
    (agentConfig.instructions as string | undefined) ??
    (projectConfig?.defaultInstructions as string | undefined) ??
    SYSTEM_DEFAULTS.instructions;

  // Instruction prefix: project wins over global
  const prefix =
    (projectConfig?.instructionPrefix as string | undefined) ||
    (globalConfig?.instructionPrefix as string | undefined) ||
    "";

  const systemPrompt = prefix
    ? `${prefix}\n\n${instructions}`
    : instructions;

  return {
    model:
      (agentConfig.model as string | undefined) ??
      (projectConfig?.defaultModel as string | undefined) ??
      (globalConfig?.defaultModel as string | undefined) ??
      SYSTEM_DEFAULTS.model,
    temperature:
      (agentConfig.temperature as number | undefined) ??
      (projectConfig?.defaultTemperature as number | undefined) ??
      (globalConfig?.defaultTemperature as number | undefined) ??
      SYSTEM_DEFAULTS.temperature,
    maxTokens:
      (agentConfig.maxTokens as number | undefined) ??
      (projectConfig?.defaultMaxTokens as number | undefined) ??
      (globalConfig?.defaultMaxTokens as number | undefined) ??
      SYSTEM_DEFAULTS.maxTokens,
    instructions,
    systemPrompt,
    failoverModels: (agentConfig.failoverModels as ResolvedConfig["failoverModels"] | undefined) ?? [],
  };
}
