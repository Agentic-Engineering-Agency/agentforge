import type { A2ATask, A2AResult } from './a2a-types.js';

// Re-export to satisfy the import (used by downstream consumers)
export type { A2ATask, A2AResult };

const AGENT_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

interface RegisteredAgent {
  id: string;
  endpoint: string;
  capabilities: string[];
}

export class A2AAgentRegistry {
  private agents = new Map<string, RegisteredAgent>();

  register(agentId: string, endpoint: string, capabilities: string[] = []): void {
    if (!AGENT_ID_RE.test(agentId)) {
      throw new Error(
        `Invalid agentId "${agentId}": must be 1-128 alphanumeric characters, hyphens, or underscores.`
      );
    }

    try {
      new URL(endpoint);
    } catch {
      throw new Error(`Invalid endpoint "${endpoint}": must be a valid URL.`);
    }

    this.agents.set(agentId, { id: agentId, endpoint, capabilities });
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  resolve(agentId: string): string | undefined {
    return this.agents.get(agentId)?.endpoint;
  }

  list(): Array<{ id: string; endpoint: string; capabilities: string[] }> {
    return Array.from(this.agents.values());
  }

  findByCapability(capability: string): Array<{ id: string; endpoint: string; capabilities: string[] }> {
    return this.list().filter((a) => a.capabilities.includes(capability));
  }
}
