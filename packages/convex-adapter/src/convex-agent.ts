/**
 * ConvexAgent - Wraps @agentforge-ai/core Agent for Convex action contexts.
 *
 * Provides the same generate/stream interface as the core Agent but operates
 * within a Convex ActionCtx, enabling access to Convex queries, mutations,
 * and actions during agent execution.
 *
 * @example
 * ```typescript
 * import { ConvexAgent } from '@agentforge-ai/convex-adapter';
 * import { openai } from '@ai-sdk/openai';
 *
 * export const runMyAgent = action({
 *   args: { prompt: v.string() },
 *   handler: async (ctx, args) => {
 *     const agent = new ConvexAgent({
 *       id: 'my-agent',
 *       name: 'My Agent',
 *       instructions: 'You are helpful.',
 *       model: openai('gpt-4o-mini'),
 *     }, ctx);
 *
 *     const response = await agent.generate(args.prompt);
 *     return response;
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

import { Agent, MCPServer } from '@agentforge-ai/core';
import type {
  ConvexActionCtx,
  ConvexAgentConfig,
  ConvexAgentResponse,
  StreamChunk,
  UsageMetrics,
} from './types.js';

/**
 * A Convex-aware wrapper around the core AgentForge Agent.
 *
 * ConvexAgent bridges the @agentforge-ai/core Agent with Convex's action
 * runtime, providing seamless access to the Convex backend during agent
 * execution. It supports usage tracking, tool management, and all
 * capabilities of the underlying Agent.
 */
export class ConvexAgent {
  /** The Convex action context for running queries/mutations. */
  public readonly ctx: ConvexActionCtx;

  /** The agent configuration. */
  public readonly config: ConvexAgentConfig;

  /** The underlying core Agent instance. */
  private agent: Agent;

  /**
   * Creates a new ConvexAgent.
   *
   * @param config - The agent configuration including model and instructions.
   * @param ctx - The Convex ActionCtx for backend access.
   *
   * @example
   * ```typescript
   * const agent = new ConvexAgent({
   *   id: 'helper',
   *   name: 'Helper Bot',
   *   instructions: 'Assist with tasks.',
   *   model: 'openai/gpt-4o',
   *   provider: 'openai',
   *   trackUsage: true,
   * }, ctx);
   * ```
   */
  constructor(config: ConvexAgentConfig, ctx: ConvexActionCtx) {
    if (!config.id) {
      throw new Error('ConvexAgent requires a non-empty id.');
    }
    if (!config.name) {
      throw new Error('ConvexAgent requires a non-empty name.');
    }
    if (!config.instructions) {
      throw new Error('ConvexAgent requires non-empty instructions.');
    }
    if (!config.model) {
      throw new Error('ConvexAgent requires a model.');
    }
    if (!ctx || typeof ctx.runQuery !== 'function') {
      throw new Error('ConvexAgent requires a valid Convex ActionCtx.');
    }

    this.config = config;
    this.ctx = ctx;
    this.agent = new Agent({
      id: config.id,
      name: config.name,
      instructions: config.instructions,
      model: config.model,
    });
  }

  /** The agent's unique identifier. */
  get id(): string {
    return this.agent.id;
  }

  /** The agent's display name. */
  get name(): string {
    return this.agent.name;
  }

  /** The agent's system instructions. */
  get instructions(): string {
    return this.agent.instructions;
  }

  /**
   * Adds tools from an MCPServer to this agent.
   *
   * @param server - An MCPServer instance containing tools.
   */
  addTools(server: MCPServer): void {
    this.agent.addTools(server);
  }

  /**
   * Removes all tools from this agent.
   */
  clearTools(): void {
    this.agent.clearTools();
  }

  /**
   * Returns all registered tool schemas.
   */
  getTools(): ReturnType<Agent['getTools']> {
    return this.agent.getTools();
  }

  /**
   * Invokes a named tool across all attached MCPServers.
   *
   * @param toolName - The tool to invoke.
   * @param input - The input for the tool.
   * @returns The tool's output.
   * @throws {Error} If the tool is not found.
   */
  async callTool(toolName: string, input: unknown): Promise<unknown> {
    return this.agent.callTool(toolName, input);
  }

  /**
   * Generates a response from the agent.
   *
   * Wraps the core Agent.generate() and optionally tracks usage metrics.
   *
   * @param prompt - The user prompt.
   * @returns A response with text and optional usage metrics.
   *
   * @example
   * ```typescript
   * const response = await agent.generate('What is the weather?');
   * console.log(response.text);
   * console.log(response.usage?.totalTokens);
   * ```
   */
  async generate(prompt: string): Promise<ConvexAgentResponse> {
    const startTime = Date.now();
    const result = await this.agent.generate(prompt);
    const latencyMs = Date.now() - startTime;

    const response: ConvexAgentResponse = {
      ...result,
      usage: {
        latencyMs,
        model: typeof this.config.model === 'string' ? this.config.model : undefined,
      },
    };

    return response;
  }

  /**
   * Generates a streaming response from the agent.
   *
   * @param prompt - The user prompt.
   * @returns An async generator yielding response chunks.
   *
   * @example
   * ```typescript
   * for await (const chunk of agent.stream('Tell me a story')) {
   *   process.stdout.write(chunk.content);
   * }
   * ```
   */
  async *stream(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.agent.stream(prompt);
  }

  /**
   * Executes a Convex query through this agent's context.
   *
   * Convenience method for running queries from the agent's ActionCtx.
   *
   * @param query - The Convex query function reference.
   * @param args - Arguments to pass to the query.
   * @returns The query result.
   */
  async runQuery(query: any, args?: any): Promise<any> {
    return this.ctx.runQuery(query, args);
  }

  /**
   * Executes a Convex mutation through this agent's context.
   *
   * @param mutation - The Convex mutation function reference.
   * @param args - Arguments to pass to the mutation.
   * @returns The mutation result.
   */
  async runMutation(mutation: any, args?: any): Promise<any> {
    return this.ctx.runMutation(mutation, args);
  }

  /**
   * Creates a ConvexAgent from a stored agent record.
   *
   * Factory method for constructing agents from database records,
   * commonly used in agentRunner patterns.
   *
   * @param record - The stored agent configuration record.
   * @param ctx - The Convex ActionCtx.
   * @returns A new ConvexAgent instance.
   *
   * @example
   * ```typescript
   * const agent = ConvexAgent.fromRecord({
   *   id: 'agent-1',
   *   name: 'My Agent',
   *   instructions: 'Be helpful.',
   *   model: 'gpt-4o-mini',
   *   provider: 'openai',
   * }, ctx);
   * ```
   */
  static fromRecord(
    record: {
      id?: string;
      name: string;
      instructions?: string;
      systemPrompt?: string;
      model?: string;
      provider?: string;
      config?: Record<string, unknown>;
    },
    ctx: ConvexActionCtx,
  ): ConvexAgent {
    return new ConvexAgent(
      {
        id: record.id || record.name.toLowerCase().replace(/\s+/g, '-'),
        name: record.name,
        instructions:
          record.instructions ||
          record.systemPrompt ||
          'You are a helpful AI assistant built with AgentForge.',
        model: record.model || 'gpt-4o-mini',
        provider: record.provider || 'openai',
        providerConfig: record.config,
      },
      ctx,
    );
  }
}
