import { Agent as MastraAgent } from '@mastra/core/agent';
import type { LanguageModelV1 } from 'ai';

/**
 * Configuration for creating an AgentForge Agent.
 */
export interface AgentConfig {
  /** A unique identifier for the agent. */
  id: string;
  /** A human-readable name for the agent. */
  name: string;
  /** The system prompt or instructions for the agent. */
  instructions: string;
  /**
   * The language model to use. Pass a LanguageModelV1 instance
   * (e.g., from `@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.).
   *
   * @example
   * ```typescript
   * import { openai } from '@ai-sdk/openai';
   * const agent = new Agent({
   *   model: openai('gpt-4o-mini'),
   *   // ...
   * });
   * ```
   */
  model: LanguageModelV1;
  /** A dictionary of tools available to the agent. */
  tools?: Record<string, unknown>;
}

/**
 * Represents a structured response from an agent generation call.
 */
export interface AgentResponse {
  /** The text content of the response. */
  text: string;
  /** Optional tool call results. */
  toolResults?: unknown[];
}

/**
 * Represents a single chunk in a streaming response.
 */
export interface StreamChunk {
  /** The text content of this chunk. */
  content: string;
}

/**
 * The core Agent class for the AgentForge framework.
 *
 * Wraps the Mastra Agent to provide a simplified, curated API for
 * creating and interacting with AI agents. Supports any AI SDK-compatible
 * model provider (OpenAI, Anthropic, Google, etc.) via BYOK (Bring Your Own Key).
 *
 * @example
 * ```typescript
 * import { openai } from '@ai-sdk/openai';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant.',
 *   model: openai('gpt-4o-mini'),
 * });
 *
 * const response = await agent.generate('Hello!');
 * ```
 */
export class Agent {
  /** The agent's unique ID. */
  public readonly id: string;

  /** The agent's human-readable name. */
  public readonly name: string;

  /** The underlying Mastra agent instance. */
  private mastraAgent: MastraAgent;

  /**
   * Creates a new AgentForge Agent.
   * @param config - The configuration for the agent.
   */
  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;

    this.mastraAgent = new MastraAgent({
      name: config.name,
      instructions: config.instructions,
      model: config.model,
      ...(config.tools ? { tools: config.tools as Record<string, never> } : {}),
    });
  }

  /**
   * Generates a structured response from the agent.
   * @param prompt - The user's prompt or input.
   * @returns A promise that resolves to the agent's response.
   */
  async generate(prompt: string): Promise<AgentResponse> {
    const result = await this.mastraAgent.generate(prompt);
    return result as unknown as AgentResponse;
  }

  /**
   * Generates a streaming response from the agent.
   * @param prompt - The user's prompt or input.
   * @returns An async iterable that yields response chunks.
   */
  async *stream(prompt: string): AsyncGenerator<StreamChunk> {
    const result = await this.mastraAgent.stream(prompt);
    for await (const chunk of result.textStream) {
      yield { content: typeof chunk === 'string' ? chunk : String(chunk) };
    }
  }
}
