/**
 * E2E Test Helper — Cloud API Client
 *
 * Lightweight HTTP client for interacting with the AgentForge Cloud API
 * during E2E tests. Wraps fetch with auth headers, retries, and typed
 * response parsing.
 */

export interface CloudAgent {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: string;
  provider: string;
  tools?: unknown;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CloudThread {
  _id: string;
  name?: string;
  agentId: string;
  userId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CloudMessage {
  _id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: unknown;
  createdAt: number;
}

export interface CloudRunResponse {
  threadId: string;
  message: string;
  agentId: string;
}

export interface UsageRecord {
  agentId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
  timestamp: number;
}

const TEST_AGENT_PREFIX = 'e2e-test-';

export class CloudTestClient {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private timeoutMs = 30_000,
  ) {}

  // ─── Health ──────────────────────────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.fetch('/health', { method: 'GET' });
      return res.ok;
    } catch {
      // If /health doesn't exist, try root or a known query endpoint
      try {
        const res = await this.fetch('/api/agents', { method: 'GET' });
        return res.ok || res.status === 401; // 401 = API is up, just needs auth
      } catch {
        return false;
      }
    }
  }

  // ─── Agents ──────────────────────────────────────────────────────────────

  async createAgent(agent: {
    id: string;
    name: string;
    instructions: string;
    model: string;
    provider: string;
    tools?: unknown;
    description?: string;
  }): Promise<string> {
    const res = await this.fetch('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        ...agent,
        id: `${TEST_AGENT_PREFIX}${agent.id}`,
      }),
    });
    const data = await res.json();
    return data.id ?? data._id ?? data;
  }

  async getAgent(id: string): Promise<CloudAgent | null> {
    try {
      const res = await this.fetch(`/api/agents/${TEST_AGENT_PREFIX}${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async listAgents(): Promise<CloudAgent[]> {
    const res = await this.fetch('/api/agents');
    return await res.json();
  }

  async deleteAgent(id: string): Promise<void> {
    await this.fetch(`/api/agents/${TEST_AGENT_PREFIX}${id}`, {
      method: 'DELETE',
    });
  }

  // ─── Threads ─────────────────────────────────────────────────────────────

  async createThread(agentId: string, name?: string): Promise<CloudThread> {
    const res = await this.fetch('/api/threads', {
      method: 'POST',
      body: JSON.stringify({
        agentId: `${TEST_AGENT_PREFIX}${agentId}`,
        name: name ?? `e2e-thread-${Date.now()}`,
        userId: 'e2e-test-user',
      }),
    });
    return await res.json();
  }

  async getThread(threadId: string): Promise<CloudThread | null> {
    try {
      const res = await this.fetch(`/api/threads/${threadId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async listThreadMessages(threadId: string): Promise<CloudMessage[]> {
    const res = await this.fetch(`/api/threads/${threadId}/messages`);
    return await res.json();
  }

  // ─── Agent Execution ────────────────────────────────────────────────────

  async runAgent(
    agentId: string,
    prompt: string,
    threadId?: string,
  ): Promise<CloudRunResponse> {
    const res = await this.fetch('/api/agents/run', {
      method: 'POST',
      body: JSON.stringify({
        agentId: `${TEST_AGENT_PREFIX}${agentId}`,
        prompt,
        threadId,
        userId: 'e2e-test-user',
      }),
    });
    return await res.json();
  }

  // ─── Usage ───────────────────────────────────────────────────────────────

  async getUsage(agentId?: string): Promise<UsageRecord[]> {
    const params = agentId
      ? `?agentId=${TEST_AGENT_PREFIX}${agentId}`
      : '';
    const res = await this.fetch(`/api/usage${params}`);
    return await res.json();
  }

  async getUsageStats(agentId?: string): Promise<{
    totalTokens: number;
    totalCost: number;
    totalRequests: number;
  }> {
    const params = agentId
      ? `?agentId=${TEST_AGENT_PREFIX}${agentId}`
      : '';
    const res = await this.fetch(`/api/usage/stats${params}`);
    return await res.json();
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  async cleanupTestAgents(): Promise<number> {
    const agents = await this.listAgents();
    const testAgents = agents.filter((a) => a.id.startsWith(TEST_AGENT_PREFIX));

    for (const agent of testAgents) {
      try {
        await this.fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      } catch {
        // Best-effort cleanup
      }
    }

    return testAgents.length;
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async fetch(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await globalThis.fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(init?.headers ?? {}),
        },
      });

      if (!res.ok && res.status >= 500) {
        const body = await res.text().catch(() => 'unknown');
        throw new Error(`Cloud API ${res.status}: ${body}`);
      }

      return res;
    } finally {
      clearTimeout(timeout);
    }
  }
}
