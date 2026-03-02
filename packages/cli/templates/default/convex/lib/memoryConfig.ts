/**
 * Memory configuration types and defaults for AgentForge.
 * Used by the agent execution pipeline to resolve per-agent memory settings.
 */

export interface MemoryConfig {
  enabled: boolean;
  maxRecallItems: number;         // max memories to inject into context
  memoryModel: string;            // embedding model identifier
  autoStore: boolean;             // auto-store interactions as memories
  recallThreshold: number;        // min similarity score to include
  shortTermTTL: number;           // ms before short-term memories expire
  consolidationEnabled: boolean;  // enable auto-consolidation
  consolidationThreshold: number; // number of memories before consolidation triggers
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  maxRecallItems: 5,
  memoryModel: "text-embedding-3-small",
  autoStore: true,
  recallThreshold: 0.3,
  shortTermTTL: 24 * 60 * 60 * 1000, // 24 hours in ms
  consolidationEnabled: true,
  consolidationThreshold: 50,
};

/**
 * Resolve memory config from agent metadata, using defaults for missing values.
 * Looks for a `memoryConfig` key inside the agent's metadata object and merges
 * any provided values over the defaults, preferring agent-level values.
 */
export function resolveMemoryConfig(
  agentMetadata: Record<string, unknown> | undefined
): MemoryConfig {
  if (!agentMetadata || typeof agentMetadata !== "object") {
    return { ...DEFAULT_MEMORY_CONFIG };
  }

  const raw = agentMetadata["memoryConfig"];
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_MEMORY_CONFIG };
  }

  const overrides = raw as Record<string, unknown>;

  return {
    enabled:
      typeof overrides["enabled"] === "boolean"
        ? overrides["enabled"]
        : DEFAULT_MEMORY_CONFIG.enabled,
    maxRecallItems:
      typeof overrides["maxRecallItems"] === "number"
        ? overrides["maxRecallItems"]
        : DEFAULT_MEMORY_CONFIG.maxRecallItems,
    memoryModel:
      typeof overrides["memoryModel"] === "string"
        ? overrides["memoryModel"]
        : DEFAULT_MEMORY_CONFIG.memoryModel,
    autoStore:
      typeof overrides["autoStore"] === "boolean"
        ? overrides["autoStore"]
        : DEFAULT_MEMORY_CONFIG.autoStore,
    recallThreshold:
      typeof overrides["recallThreshold"] === "number"
        ? overrides["recallThreshold"]
        : DEFAULT_MEMORY_CONFIG.recallThreshold,
    shortTermTTL:
      typeof overrides["shortTermTTL"] === "number"
        ? overrides["shortTermTTL"]
        : DEFAULT_MEMORY_CONFIG.shortTermTTL,
    consolidationEnabled:
      typeof overrides["consolidationEnabled"] === "boolean"
        ? overrides["consolidationEnabled"]
        : DEFAULT_MEMORY_CONFIG.consolidationEnabled,
    consolidationThreshold:
      typeof overrides["consolidationThreshold"] === "number"
        ? overrides["consolidationThreshold"]
        : DEFAULT_MEMORY_CONFIG.consolidationThreshold,
  };
}
