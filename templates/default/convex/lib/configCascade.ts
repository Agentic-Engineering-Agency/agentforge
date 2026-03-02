/**
 * Configuration Cascade System
 *
 * Resolves agent configuration by cascading through multiple levels:
 * Agent Config → Project Config → Global Config → System Defaults
 */

/**
 * System defaults for agent configuration
 */
export const SYSTEM_DEFAULTS = {
  model: "openai/gpt-4o-mini",
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
  failoverModels?: string[];
}

/**
 * Project settings interface
 */
export interface ProjectSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultInstructions?: string;
}

/**
 * Global settings interface
 */
export interface GlobalSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

/**
 * Resolve configuration by cascading through levels
 *
 * Priority: Agent Config → Project Config → Global Config → System Defaults
 *
 * @param agentConfig - Agent-level configuration
 * @param projectConfig - Project-level settings
 * @param globalConfig - Global user settings
 * @returns Resolved configuration
 */
export function resolveConfig(
  agentConfig: AgentConfig,
  projectConfig: ProjectSettings | null,
  globalConfig: GlobalSettings | null,
): AgentConfig {
  return {
    model:
      agentConfig.model ??
      projectConfig?.defaultModel ??
      globalConfig?.defaultModel ??
      SYSTEM_DEFAULTS.model,
    temperature:
      agentConfig.temperature ??
      projectConfig?.defaultTemperature ??
      globalConfig?.defaultTemperature ??
      SYSTEM_DEFAULTS.temperature,
    maxTokens:
      agentConfig.maxTokens ??
      projectConfig?.defaultMaxTokens ??
      globalConfig?.defaultMaxTokens ??
      SYSTEM_DEFAULTS.maxTokens,
    instructions:
      agentConfig.instructions ??
      projectConfig?.defaultInstructions ??
      SYSTEM_DEFAULTS.instructions,
    failoverModels: agentConfig.failoverModels ?? [],
  };
}
