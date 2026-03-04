import { Agent as MastraAgent } from '@mastra/core/agent';
import type { Workspace } from '@mastra/core/workspace';
import type { MCPServer } from './mcp-server.js';
import { A2AClient } from './a2a/index.js';
import type { A2AAgentRegistry, A2AContext, A2AConstraints, A2AResult } from './a2a/index.js';

/**
 * Supported model types for AgentForge agents.
 *
 * - `string`: A Mastra model router ID in `"provider/model-name"` format (e.g., `'openai/gpt-4o'`)
 */
export type AgentModel = string;

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
   * The language model to use. Accepts a Mastra model router string ID
   * in `"provider/model-name"` format.
   *
   * @example
   * ```typescript
   * // Using a Mastra model router string
   * const agent = new Agent({
   *   model: 'openai/gpt-4o-mini',
   *   // ...
   * });
   * ```
   */
  model: AgentModel;
  /** An MCPServer instance providing tools for the agent. */
  tools?: MCPServer;
  /** An A2AAgentRegistry for delegating tasks to other agents. */
  a2aRegistry?: A2AAgentRegistry;
  /**
   * A Mastra Workspace instance for file system access.
   * When provided, the agent automatically gets file tools.
   *
   * @example
   * ```typescript
   * import { createWorkspace } from '@agentforge-ai/core/workspace';
   *
   * const workspace = createWorkspace({ storage: 'local' });
   * const agent = new Agent({
   *   id: 'my-agent',
   *   name: 'My Agent',
   *   instructions: 'You have file access.',
   *   model: 'openai/gpt-4o',
   *   workspace,
   * });
   * ```
   */
  workspace?: Workspace;
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
 * creating and interacting with AI agents. Uses Mastra model router
 * string IDs (e.g., `'openai/gpt-4o'`) for all model configuration.
 *
 * Tools can be provided at construction time via the `tools` config option,
 * or added dynamically after construction using the `addTools()` method.
 *
 * @example
 * ```typescript
 * import { Agent, MCPServer } from '@agentforge-ai/core';
 *
 * const tools = new MCPServer();
 * tools.registerTool({ ... });
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant.',
 *   model: 'openai/gpt-4o-mini',
 *   tools: tools,
 * });
 *
 * // Or add tools dynamically:
 * const moreTools = new MCPServer();
 * moreTools.registerTool({ ... });
 * agent.addTools(moreTools);
 *
 * const response = await agent.generate('Hello!');
 * ```
 */
export class Agent {
  /** The agent's unique ID. */
  public readonly id: string;

  /** The agent's human-readable name. */
  public readonly name: string;

  /** The agent's instructions (system prompt). */
  public readonly instructions: string;

  /** The agent's model configuration. */
  public readonly model: AgentModel;

  /** The underlying Mastra agent instance. */
  private mastraAgent: MastraAgent;

  /** The collection of MCP servers providing tools to this agent. */
  private toolServers: MCPServer[] = [];

  /** The A2A client for delegating tasks to other agents. */
  private a2aClient?: A2AClient;

  /** The workspace instance for file system access. */
  private workspace?: Workspace;

  /**
   * Creates a new AgentForge Agent.
   * @param config - The configuration for the agent.
   */
  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.instructions = config.instructions;
    this.model = config.model;

    if (config.tools) {
      this.toolServers.push(config.tools);
    }

    if (config.a2aRegistry) {
      this.a2aClient = new A2AClient(config.a2aRegistry);
    }

    this.workspace = config.workspace;
    this.mastraAgent = this.buildMastraAgent(this.workspace);
  }

  /**
   * Dynamically adds tools from an MCPServer to this agent.
   *
   * This method allows you to extend an agent's capabilities after construction.
   * Multiple MCPServer instances can be added, and their tools are merged together.
   * The underlying Mastra agent is rebuilt to include the new tools.
   *
   * @param server - An MCPServer instance containing the tools to add.
   *
   * @example
   * ```typescript
   * const agent = new Agent({ id: 'a', name: 'A', instructions: '...', model: 'openai/gpt-4o' });
   *
   * const financialTools = new MCPServer();
   * financialTools.registerTool({ name: 'get_stock_price', ... });
   * agent.addTools(financialTools);
   *
   * const adminTools = new MCPServer();
   * adminTools.registerTool({ name: 'delete_user', ... });
   * agent.addTools(adminTools);
   *
   * // Agent now has both get_stock_price and delete_user tools
   * const tools = agent.getTools();
   * ```
   */
  addTools(server: MCPServer): void {
    this.toolServers.push(server);
    this.mastraAgent = this.buildMastraAgent(this.workspace);
  }

  /**
   * Removes all tools from this agent.
   *
   * Clears all registered MCPServer instances and rebuilds the underlying
   * Mastra agent without any tools.
   */
  clearTools(): void {
    this.toolServers = [];
    this.mastraAgent = this.buildMastraAgent(this.workspace);
  }

  /**
   * Returns a flat list of all tool schemas registered across all MCPServer instances.
   *
   * @returns An array of tool schema descriptors from all attached MCPServers.
   */
  getTools(): ReturnType<MCPServer['listTools']> {
    return this.toolServers.flatMap((server) => server.listTools());
  }

  /**
   * Invokes a tool by name across all attached MCPServer instances.
   *
   * Searches through all registered MCPServers for the named tool and
   * invokes it with the provided input. Throws if the tool is not found
   * in any server.
   *
   * @param toolName - The name of the tool to invoke.
   * @param input - The input to pass to the tool.
   * @returns A promise that resolves with the tool's output.
   * @throws {Error} If the tool is not found in any attached MCPServer.
   */
  async callTool(toolName: string, input: unknown): Promise<unknown> {
    for (const server of this.toolServers) {
      const toolList = server.listTools();
      if (toolList.some((t) => t.name === toolName)) {
        return server.callTool(toolName, input);
      }
    }
    throw new Error(`Tool '${toolName}' not found in any attached MCPServer.`);
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

  /**
   * Delegates a task to another agent via the A2A protocol.
   * Requires `a2aRegistry` to be provided in `AgentConfig`.
   *
   * @param task - The task to delegate, including the target agent ID and instruction.
   * @returns A promise that resolves to the result from the target agent.
   * @throws {Error} If `a2aRegistry` was not provided in `AgentConfig`.
   */
  async delegate(task: {
    to: string;
    instruction: string;
    context?: A2AContext;
    constraints?: A2AConstraints;
  }): Promise<A2AResult> {
    if (!this.a2aClient) {
      throw new Error('A2A not configured. Provide a2aRegistry in AgentConfig.');
    }
    return this.a2aClient.delegate({ from: this.id, ...task });
  }

  /**
   * Builds (or rebuilds) the underlying Mastra agent from the current configuration.
   * Called on construction and whenever tools are added or cleared.
   */
  private buildMastraAgent(workspace?: Workspace): MastraAgent {
    const toolsRecord = this.buildToolsRecord();

    return new MastraAgent({
      id: this.id,
      name: this.name,
      instructions: this.instructions,
      model: this.model,
      ...(workspace ? { workspace } : {}),
      ...(Object.keys(toolsRecord).length > 0 ? { tools: toolsRecord as Record<string, never> } : {}),
    });
  }

  /**
   * Merges tools from all attached MCPServer instances into a single record
   * suitable for passing to the Mastra agent constructor.
   */
  private buildToolsRecord(): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    for (const server of this.toolServers) {
      for (const tool of server.listTools()) {
        record[tool.name] = tool;
      }
    }
    return record;
  }
}
