/**
 * FailoverChain - Model provider failover for reliability
 *
 * Attempts to generate responses using multiple model providers in sequence.
 * If one provider fails, automatically retries with the next provider.
 *
 * Note: API keys should be configured via environment variables for each provider.
 */

import { Agent } from './agent';

export interface ProviderConfig {
  /** Model identifier (e.g., 'openai/gpt-4', 'anthropic/claude-3-5-sonnet') */
  model: string;
  /** Optional agent ID (auto-generated if not provided) */
  id?: string;
  /** Optional agent name */
  name?: string;
}

export interface FailoverChainConfig {
  providers: ProviderConfig[];
  maxRetries?: number;
}

/**
 * Error thrown when all providers in the failover chain have failed
 */
export class FailoverExhaustedError extends Error {
  public readonly errors: Error[];

  constructor(errors: Error[]) {
    const messages = errors.map((e) => e.message).join('; ');
    super(`All providers in failover chain failed: ${messages}`);
    this.name = 'FailoverExhaustedError';
    this.errors = errors;
  }
}

export class FailoverChain {
  private providers: ProviderConfig[];
  private agents: Map<string, Agent> = new Map();
  private agentIdCounter = 0;

  constructor(config: FailoverChainConfig) {
    this.providers = config.providers;
  }

  /**
   * Generate a response, trying each provider in sequence until one succeeds
   */
  async generate(messages: Array<{ role: string; content: string }>, options: Record<string, unknown> = {}): Promise<{ text: string }> {
    const errors: Error[] = [];

    for (const provider of this.providers) {
      try {
        const agent = this.getOrCreateAgent(provider);
        // Convert messages to prompt string
        const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const response = await agent.generate(prompt);
        return { text: response.text };
      } catch (error) {
        errors.push(error as Error);
        // Continue to next provider
        continue;
      }
    }

    throw new FailoverExhaustedError(errors);
  }

  /**
   * Get or create an Agent for the given provider configuration
   */
  private getOrCreateAgent(config: ProviderConfig): Agent {
    const key = config.model;

    if (!this.agents.has(key)) {
      this.agentIdCounter++;
      const agent = new Agent({
        id: config.id || `failover-agent-${this.agentIdCounter}`,
        name: config.name || `Failover Agent ${this.agentIdCounter}`,
        instructions: 'You are a helpful assistant.',
        model: config.model,
      });

      this.agents.set(key, agent);
    }

    return this.agents.get(key)!;
  }

  /**
   * Clean up all agents
   */
  async cleanup(): Promise<void> {
    this.agents.clear();
  }
}
