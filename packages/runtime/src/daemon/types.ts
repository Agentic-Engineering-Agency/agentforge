import type { Agent } from '@mastra/core/agent';

/**
 * Minimal daemon interface exposed to channel adapters.
 * Avoids circular references while providing typed access to daemon methods.
 */
export interface DaemonAccess {
  listAgents(): AgentDefinition[];
  getAgent(id: string): Agent | undefined;
}

// Forward declaration to avoid circular reference
export interface ChannelAdapter {
  name: string;
  start(agents: Map<string, Agent>, daemon: DaemonAccess): Promise<void>;
  stop(): Promise<void>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model?: string;
  tools?: string[];
  workingMemoryTemplate?: string;
}

export interface DaemonConfig {
  deploymentUrl?: string;
  adminAuthToken?: string;
  defaultModel?: string;
}
