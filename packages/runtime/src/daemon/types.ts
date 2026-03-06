import type { Agent } from '@mastra/core/agent';

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

/** Minimal interface exposed to channel adapters — avoids circular import with daemon.ts */
export interface DaemonHandle {
  getAgent(id: string): Agent | undefined;
  listAgents(): AgentDefinition[];
}

export interface ChannelAdapter {
  name: string;
  start(agents: Map<string, Agent>, daemon: DaemonHandle): Promise<void>;
  stop(): Promise<void>;
}
