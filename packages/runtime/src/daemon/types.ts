import type { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { Workspace } from '@mastra/core/workspace';

// Forward declaration to avoid circular reference
export interface ChannelAdapter {
  name: string;
  start(agents: Map<string, Agent>, daemon: any): Promise<void>;
  stop(): Promise<void>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model?: string;
  tools?: ToolsInput;
  workspace?: Workspace;
  workingMemoryTemplate?: string;
  disableMemory?: boolean;
}

export type AgentDefinitionLoader = (id: string) => Promise<AgentDefinition | null | undefined>;

export interface DaemonConfig {
  deploymentUrl?: string;
  adminAuthToken?: string;
  defaultModel?: string;
  agentLoader?: AgentDefinitionLoader;
}

export interface WorkflowExecutionResult {
  runId: string;
  status: 'success' | 'failed';
  output?: string;
  error?: string;
}

export type WorkflowRunExecutor = (runId: string) => Promise<WorkflowExecutionResult>;
