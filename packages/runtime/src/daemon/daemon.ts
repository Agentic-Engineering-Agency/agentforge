import type { Agent } from '@mastra/core/agent';
import { initStorage } from '../agent/shared.js';
import { createStandardAgent } from '../agent/create-standard-agent.js';
import type { ChannelAdapter, AgentDefinition, DaemonConfig } from './types.js';

export class AgentForgeDaemon {
  private agents = new Map<string, Agent>();
  private channels: ChannelAdapter[] = [];

  constructor(config: DaemonConfig = {}) {
    if (config.deploymentUrl && config.adminAuthToken) {
      initStorage(config.deploymentUrl, config.adminAuthToken);
    }
  }

  async loadAgents(definitions: AgentDefinition[]): Promise<void> {
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
    return Array.from(this.agents.entries()).map(([id, agent]) => {
      return {
        id,
        name: agent.name,
        description: (agent as any).description,
        instructions: typeof (agent as any).instructions === 'string' ? (agent as any).instructions : '',
        model: typeof agent.model === 'string' ? agent.model : undefined,
        tools: [],
        workingMemoryTemplate: undefined,
      };
    });
  }
}
