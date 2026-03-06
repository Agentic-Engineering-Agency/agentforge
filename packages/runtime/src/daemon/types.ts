import type { Agent } from '@mastra/core/agent';

export interface ChannelAdapter {
  name: string;
  start(agents: Map<string, Agent>, daemon: AgentForgeDaemon): Promise<void>;
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

import type { AgentForgeDaemon } from './daemon.js';
