import type { Agent } from '@mastra/core/agent';
import { initStorage, isStorageInitialized } from '../agent/shared.js';
import { createStandardAgent } from '../agent/create-standard-agent.js';
import type {
  ChannelAdapter,
  AgentDefinition,
  AgentDefinitionLoader,
  DaemonConfig,
  WorkflowExecutionResult,
  WorkflowRunExecutor,
} from './types.js';

export class AgentForgeDaemon {
  private agents = new Map<string, Agent>();
  private definitions = new Map<string, AgentDefinition>();
  private channels: ChannelAdapter[] = [];
  private workflowExecutor?: WorkflowRunExecutor;
  private agentLoader?: AgentDefinitionLoader;

  constructor(config: DaemonConfig = {}) {
    if (config.deploymentUrl && config.adminAuthToken) {
      initStorage(config.deploymentUrl, config.adminAuthToken);
    }
    this.agentLoader = config.agentLoader;
  }

  async loadAgents(definitions: AgentDefinition[]): Promise<void> {
    if (!isStorageInitialized() && definitions.some((definition) => !definition.disableMemory)) {
      throw new Error(
        'Storage not initialized. Ensure the daemon constructor received valid deploymentUrl and adminAuthToken, or call initStorage() explicitly before loading agents.',
      );
    }
    for (const def of definitions) {
      this.registerAgent(def);
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

  async getOrLoadAgentDefinition(id: string): Promise<{ agent: Agent; definition: AgentDefinition } | null> {
    const existingAgent = this.agents.get(id);
    const existingDefinition = this.definitions.get(id);
    if (existingAgent && existingDefinition) {
      return { agent: existingAgent, definition: existingDefinition };
    }

    if (!this.agentLoader) {
      return null;
    }

    const loadedDefinition = await this.agentLoader(id);
    if (!loadedDefinition) {
      return null;
    }

    const loadedAgent = this.registerAgent(loadedDefinition);
    return {
      agent: loadedAgent,
      definition: loadedDefinition,
    };
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

  private registerAgent(definition: AgentDefinition): Agent {
    const agent = createStandardAgent({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      instructions: definition.instructions,
      model: definition.model,
      tools: definition.tools,
      workspace: definition.workspace,
      workingMemoryTemplate: definition.workingMemoryTemplate,
      disableMemory: definition.disableMemory,
    });
    this.agents.set(definition.id, agent);
    this.definitions.set(definition.id, definition);
    return agent;
  }
}
