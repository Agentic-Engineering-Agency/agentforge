/**
 * Configuration Cascade System
 *
 * Resolves agent configuration by cascading through multiple levels:
 * Agent Config -> Project Config -> Global Config -> System Defaults
 *
 * Project and global configs can provide a `systemPrompt` (or legacy
 * `instructionPrefix`) that is prepended to the agent's instructions
 * to produce the final `systemPrompt`.
 */

/**
 * System defaults for agent configuration
 */
export const SYSTEM_DEFAULTS = {
  model: "openai/gpt-5.4",
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
}

/**
 * Project settings interface
 */
export interface ProjectSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultInstructions?: string;
  /** Primary key for instruction prefix (stored as systemPrompt in DB) */
  systemPrompt?: string;
  /** Legacy alias for systemPrompt — used as fallback */
  instructionPrefix?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
}

/**
 * Global settings interface
 */
export interface GlobalSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  /** Primary key for instruction prefix */
  systemPrompt?: string;
  /** Legacy alias for systemPrompt — used as fallback */
  instructionPrefix?: string;
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
 * Normalize a string value: treat empty strings as undefined so `||`
 * cascade falls through correctly (UI "None" selects send "").
 */
function normalizeStr(val: string | undefined): string | undefined {
  return val || undefined;
}

/**
 * Resolve configuration by cascading through levels.
 *
 * Priority: Agent Config -> Project Config -> Global Config -> System Defaults
 *
 * The `systemPrompt` (or legacy `instructionPrefix`) from project (or global
 * if project has none) is prepended to the agent instructions, separated by a
 * blank line. The combined result is available as `systemPrompt`.
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
): ResolvedConfig {
  const instructions =
    agentConfig.instructions ??
    projectConfig?.defaultInstructions ??
    SYSTEM_DEFAULTS.instructions;

  // Instruction prefix: systemPrompt is the primary key, instructionPrefix
  // is the legacy fallback. Project wins over global.
  const prefix =
    normalizeStr(projectConfig?.systemPrompt) ||
    normalizeStr(projectConfig?.instructionPrefix) ||
    normalizeStr(globalConfig?.systemPrompt) ||
    normalizeStr(globalConfig?.instructionPrefix) ||
    "";

  const systemPrompt = prefix
    ? `${prefix}\n\n${instructions}`
    : instructions;

  // Failover models: agent > project > global (no merging)
  const failoverModels =
    agentConfig.failoverModels ??
    projectConfig?.failoverModels ??
    [];

  return {
    model:
      normalizeStr(agentConfig.model) ||
      normalizeStr(projectConfig?.defaultModel) ||
      normalizeStr(globalConfig?.defaultModel) ||
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
    instructions,
    systemPrompt,
    failoverModels,
  };
}
