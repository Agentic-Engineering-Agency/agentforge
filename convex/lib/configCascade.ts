/**
 * Configuration cascade resolution for AgentForge.
 * Resolves config values by walking: Agent > Project > Global > System Defaults.
 */

export const SYSTEM_DEFAULTS = {
  model: "openai/gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
  instructionPrefix: "",
  failoverModels: [] as Array<{ provider: string; model: string }>,
} as const;

export interface VoiceConfig {
  /** ElevenLabs voice ID */
  voiceId?: string;
  /** Speech speed multiplier (0.5–2.0) */
  speed?: number;
  /** TTS model ID (e.g., 'eleven_multilingual_v2') */
  model?: string;
  /** Voice provider */
  provider?: 'elevenlabs';
  /** Language code (e.g., 'en', 'es') */
  language?: string;
}

export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  instructions?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
  voiceConfig?: VoiceConfig;
}

export interface ProjectSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  instructionPrefix?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
}

export interface GlobalSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  instructionPrefix?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
}

export interface ResolvedConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  failoverModels: Array<{ provider: string; model: string }>;
}

export function resolveConfig(
  agent: AgentConfig,
  projectSettings: ProjectSettings | null | undefined,
  globalSettings: GlobalSettings | null | undefined,
): ResolvedConfig {
  const ps = projectSettings ?? {};
  const gs = globalSettings ?? {};

  // Scalar resolution: first non-null wins
  const model =
    agent.model ||
    ps.defaultModel ||
    gs.defaultModel ||
    SYSTEM_DEFAULTS.model;

  const temperature =
    agent.temperature ??
    ps.defaultTemperature ??
    gs.defaultTemperature ??
    SYSTEM_DEFAULTS.temperature;

  const maxTokens =
    agent.maxTokens ??
    ps.defaultMaxTokens ??
    gs.defaultMaxTokens ??
    SYSTEM_DEFAULTS.maxTokens;

  const failoverModels =
    agent.failoverModels ??
    ps.failoverModels ??
    gs.failoverModels ??
    [...SYSTEM_DEFAULTS.failoverModels];

  // Instructions: prefix injection (not override)
  const instructionPrefix =
    ps.instructionPrefix ||
    gs.instructionPrefix ||
    SYSTEM_DEFAULTS.instructionPrefix;

  const agentInstructions = agent.instructions ?? "";
  const systemPrompt = instructionPrefix
    ? `${instructionPrefix}\n\n${agentInstructions}`
    : agentInstructions;

  return {
    model,
    temperature,
    maxTokens,
    systemPrompt,
    failoverModels,
  };
}
