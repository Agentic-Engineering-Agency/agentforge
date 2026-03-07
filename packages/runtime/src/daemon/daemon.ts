import type { Agent } from '@mastra/core/agent';
import { initStorage, isStorageInitialized } from '../agent/shared.js';
import { createStandardAgent } from '../agent/create-standard-agent.js';
import type {
  ChannelAdapter,
  AgentDefinition,
  DaemonConfig,
  WorkflowExecutionResult,
  WorkflowRunExecutor,
} from './types.js';

export class AgentForgeDaemon {
  private agents = new Map<string, Agent>();
  private definitions = new Map<string, AgentDefinition>();
  private channels: ChannelAdapter[] = [];
  private workflowExecutor?: WorkflowRunExecutor;

  constructor(config: DaemonConfig = {}) {
    if (config.deploymentUrl && config.adminAuthToken) {
      initStorage(config.deploymentUrl, config.adminAuthToken);
    }
  }

  async loadAgents(definitions: AgentDefinition[]): Promise<void> {
    if (!isStorageInitialized() && definitions.some((definition) => !definition.disableMemory)) {
      throw new Error(
        'Storage not initialized. Ensure the daemon constructor received valid deploymentUrl and adminAuthToken, or call initStorage() explicitly before loading agents.',
      );
    }
    for (const def of definitions) {
      const agent = createStandardAgent({
        id: def.id,
        name: def.name,
        description: def.description,
        instructions: def.instructions,
        model: def.model,
        workspace: def.workspace,
        workingMemoryTemplate: def.workingMemoryTemplate,
        disableMemory: def.disableMemory,
      });
      this.agents.set(def.id, agent);
      this.definitions.set(def.id, def);
    }
  }

  addChannel(adapter: ChannelAdapter): void {
    this.channels.push(adapter);
  }

  async start(): Promise<void> {
    await Promise.all(this.channels.map(ch => ch.start(this.agents, this)));
  }

  async stop(): Promise<void> {
    await Promise.all(this.channels.map(ch => ch.stop()));
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  listAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  listAgents(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  setWorkflowExecutor(executor: WorkflowRunExecutor): void {
    this.workflowExecutor = executor;
  }

  async executeWorkflowRun(runId: string): Promise<WorkflowExecutionResult> {
    if (!this.workflowExecutor) {
      throw new Error('Workflow executor not configured on daemon.');
    }
    return this.workflowExecutor(runId);
  }
}
