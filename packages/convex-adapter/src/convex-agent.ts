/**
 * ConvexAgentAdapter - Bridges @agentforge-ai/core Agent with Convex Node Actions.
 *
 * Wraps a framework Agent for use in Convex internalActions, handling
 * model resolution, usage tracking, and Convex context integration.
 *
 * @example
 * ```typescript
 * import { Agent } from '@agentforge-ai/core';
 * import { ConvexAgentAdapter } from '@agentforge-ai/convex-adapter';
 *
 * // In a Convex Node Action:
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are helpful.',
 *   model: 'openai/gpt-4o',
 * });
 * const adapter = new ConvexAgentAdapter(agent);
 * const result = await adapter.runInAction(ctx, messages, {
 *   onUsage: (usage) => console.log(usage)
 * });
 * ```
 *
 * @packageDocumentation
 */

import { Agent, MCPServer } from '@agentforge-ai/core';
import type { StreamChunk } from '@agentforge-ai/core';
import type { LanguageModelV1 } from 'ai';
import {
  getModel,
  parseModelString,
  createModelConfigFromRecord,
  type ModelResolverConfig,
} from './model-resolver.js';
import type {
  ConvexActionCtx,
  ConvexAgentConfig,
  ConvexAgentResponse,
  UsageMetrics,
  Message,
  RunInActionOptions,
  RunResult,
} from './types.js';

export type {
  ConvexAgentConfig,
  ConvexAgentResponse,
  ModelResolverConfig,
  Message,
  RunInActionOptions,
  RunResult,
};

export { getModel, parseModelString, createModelConfigFromRecord };

/**
 * Adapter that wraps an AgentForge Agent for use in Convex Node Actions.
 *
 * This adapter bridges the framework's Agent class with Convex's runtime,
 * handling model resolution, message formatting, and usage tracking.
 */
export class ConvexAgentAdapter {
  /** The wrapped AgentForge Agent instance */
  private agent: Agent;

  /** Optional model config for resolving string model IDs */
  private modelConfig?: ModelResolverConfig;

  /** Resolved model instance (cached) */
  private resolvedModel?: LanguageModelV1;

  /**
   * Creates a new ConvexAgentAdapter.
   *
   * @param agent - The AgentForge Agent instance to wrap
   * @param modelConfig - Optional model resolver config for string model IDs
   */
  constructor(agent: Agent, modelConfig?: ModelResolverConfig) {
    this.agent = agent;
    this.modelConfig = modelConfig;
  }

  /**
   * Get the underlying AgentForge Agent.
   */
  getAgent(): Agent {
    return this.agent;
  }

  /**
   * Get the resolved language model for this adapter.
   *
   * If the agent's model is a string ID, it will be resolved using
   * the model resolver. The result is cached for subsequent calls.
   */
  getResolvedModel(): LanguageModelV1 {
    if (this.resolvedModel) {
      return this.resolvedModel;
    }

    // If the agent's model is already a LanguageModelV1, use it directly
    if (typeof this.agent.model !== 'string') {
      this.resolvedModel = this.agent.model as LanguageModelV1;
      return this.resolvedModel;
    }

    // Otherwise, resolve the string model ID
    const config = this.modelConfig || parseModelString(this.agent.model);
    this.resolvedModel = getModel(config);
    return this.resolvedModel;
  }

  /**
   * Run the agent within a Convex action context.
   *
   * This is the primary method for executing agents in Convex Node Actions.
   * It handles message formatting, model resolution, generation, and usage tracking.
   *
   * @param ctx - The Convex action context
   * @param messages - Array of messages (conversation history)
   * @param options - Optional configuration including usage callback
   * @returns A promise resolving to the run result
   */
  async runInAction(
    ctx: ConvexActionCtx,
    messages: Message[],
    options: RunInActionOptions = {}
  ): Promise<RunResult> {
    const startTime = Date.now();

    try {
      // Format messages for the agent
      const formattedPrompt = this.formatMessages(messages);

      // Generate response using the underlying agent
      const result = await this.agent.generate(formattedPrompt);
      const latencyMs = Date.now() - startTime;

      // Build usage metrics
      const usage: UsageMetrics = {
        latencyMs,
        model: typeof this.agent.model === 'string' ? this.agent.model : undefined,
      };

      // Call usage callback if provided
      if (options.onUsage) {
        await options.onUsage(usage);
      }

      return {
        content: result.text,
        model: typeof this.agent.model === 'string' ? this.agent.model : 'unknown',
        usage,
        latencyMs,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[ConvexAgentAdapter] Error running agent:`, msg);
      throw new Error(`Agent execution failed: ${msg}`);
    }
  }

  /**
   * Run the agent with a single prompt (convenience method).
   *
   * @param ctx - The Convex action context
   * @param prompt - The user's prompt
   * @param options - Optional configuration
   * @returns A promise resolving to the run result
   */
  async generate(
    ctx: ConvexActionCtx,
    prompt: string,
    options: RunInActionOptions = {}
  ): Promise<RunResult> {
    return this.runInAction(
      ctx,
      [
        { role: 'system', content: this.agent.instructions },
        { role: 'user', content: prompt },
      ],
      options
    );
  }

  /**
   * Format messages array into a prompt string.
   */
  private formatMessages(messages: Message[]): string {
    return messages
      .map((m) => {
        switch (m.role) {
          case 'system':
            return m.content;
          case 'user':
            return `User: ${m.content}`;
          case 'assistant':
            return `Assistant: ${m.content}`;
          default:
            return m.content;
        }
      })
      .join('\n\n');
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
   */
  async callTool(toolName: string, input: unknown): Promise<unknown> {
    return this.agent.callTool(toolName, input);
  }

  /**
   * Generates a streaming response from the agent.
   */
  async *stream(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.agent.stream(prompt);
  }
}

/**
 * Factory function to create a ConvexAgentAdapter from a configuration object.
 *
 * @param config - Configuration for creating the agent and adapter
 * @returns A ConvexAgentAdapter instance
 */
export function createConvexAgent(config: {
  /** Unique agent ID */
  id: string;
  /** Human-readable agent name */
  name: string;
  /** System instructions/prompt */
  instructions: string;
  /** Model config or string ID */
  model: ModelResolverConfig | string;
  /** Optional API key override */
  apiKey?: string;
}): ConvexAgentAdapter {
  // Build model config if a string was provided
  let modelConfig: ModelResolverConfig | undefined;
  let agentModel: string;

  if (typeof config.model === 'string') {
    modelConfig = parseModelString(config.model);
    agentModel = config.model;
  } else {
    modelConfig = config.model;
    agentModel = `${config.model.provider}/${config.model.modelId}`;
  }

  // Create the framework Agent
  const agent = new Agent({
    id: config.id,
    name: config.name,
    instructions: config.instructions,
    model: agentModel,
  });

  // Create and return the adapter
  return new ConvexAgentAdapter(agent, modelConfig);
}

/**
 * Create a ConvexAgentAdapter from an agent record (as stored in Convex).
 *
 * @param record - The agent record from Convex
 * @returns A ConvexAgentAdapter instance
 */
export function createConvexAgentFromRecord(record: {
  name: string;
  systemPrompt?: string;
  model?: string;
  provider?: string;
  config?: {
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
  };
}): ConvexAgentAdapter {
  const modelConfig = createModelConfigFromRecord(record);

  // Create the framework Agent with the model string
  const agent = new Agent({
    id: record.name.toLowerCase().replace(/\s+/g, '-'),
    name: record.name,
    instructions:
      record.systemPrompt || 'You are a helpful AI assistant built with AgentForge.',
    model: `${modelConfig.provider}/${modelConfig.modelId}`,
  });

  return new ConvexAgentAdapter(agent, modelConfig);
}

// =====================================================
// Legacy ConvexAgent Class (for backward compatibility)
// =====================================================

/**
 * ConvexAgent - Wraps @agentforge-ai/core Agent for Convex action contexts.
 *
 * @deprecated Use ConvexAgentAdapter instead for new code.
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
   */
  async callTool(toolName: string, input: unknown): Promise<unknown> {
    return this.agent.callTool(toolName, input);
  }

  /**
   * Generates a response from the agent.
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
   */
  async *stream(prompt: string): AsyncGenerator<StreamChunk> {
    yield* this.agent.stream(prompt);
  }

  /**
   * Executes a Convex query through this agent's context.
   */
  async runQuery(query: any, args?: any): Promise<any> {
    return this.ctx.runQuery(query, args);
  }

  /**
   * Executes a Convex mutation through this agent's context.
   */
  async runMutation(mutation: any, args?: any): Promise<any> {
    return this.ctx.runMutation(mutation, args);
  }

  /**
   * Creates a ConvexAgent from a stored agent record.
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
        provider: record.provider,
        providerConfig: record.config,
      },
      ctx,
    );
  }
}
