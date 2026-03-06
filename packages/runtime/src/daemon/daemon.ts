import type { Agent } from '@mastra/core/agent';
import { initStorage, isStorageInitialized } from '../agent/shared.js';
import { createStandardAgent } from '../agent/create-standard-agent.js';
import type { ChannelAdapter, AgentDefinition, DaemonConfig } from './types.js';

export class AgentForgeDaemon {
  private agents = new Map<string, Agent>();
  private definitions = new Map<string, AgentDefinition>();
  private channels: ChannelAdapter[] = [];

  constructor(config: DaemonConfig = {}) {
    if (config.deploymentUrl && config.adminAuthToken) {
      initStorage(config.deploymentUrl, config.adminAuthToken);
    }
  }

  async loadAgents(definitions: AgentDefinition[]): Promise<void> {
    if (!isStorageInitialized()) {
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
        workingMemoryTemplate: def.workingMemoryTemplate,
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

  listAgents(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }
}
