/**
 * MCPExecutor - Client for connecting to and executing MCP server tools
 *
 * Uses the official @modelcontextprotocol/sdk Client with StdioClientTransport.
 * Provides a simplified interface for tool execution.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MCPExecutorConfig {
  /** Unique identifier for this connection */
  id?: string;
  /** Command to spawn MCP server process */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables for the process */
  env?: Record<string, string>;
  /** Transport type: 'stdio' (default) or 'sse' */
  transport?: 'stdio' | 'sse';
  /** URL for SSE transport (required if transport is 'sse') */
  url?: string;
}

export interface ToolInfo {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Error thrown when trying to execute tools without connecting
 */
export class McpNotConnectedError extends Error {
  constructor() {
    super('MCPExecutor not connected. Call connect() first.');
    this.name = 'McpNotConnectedError';
  }
}

export class MCPExecutor {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private config: MCPExecutorConfig;
  private connected = false;

  constructor(config?: MCPExecutorConfig) {
    this.config = config ?? { command: 'node', args: [] };
  }

  /**
   * Connect to an MCP server via stdio transport (lazy connection)
   * Stores the config for later use in listTools/executeTool
   */
  async connect(serverConfig: MCPExecutorConfig): Promise<void> {
    this.config = serverConfig;
    // Store config for lazy connection (actual connection happens when needed)
    // This allows connect() to return without error for valid config shape
  }

  /**
   * Ensure client is connected
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    // Create client
    this.client = new Client(
      {
        name: 'agentforge-mcp-executor',
        version: '1.0.0',
      },
      {
        capabilities: {} as any,
      }
    );

    // Create transport
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: this.config.env,
    });

    // Connect
    await this.client.connect(this.transport);
    this.connected = true;
  }

  /**
   * List available tools from the connected MCP server
   */
  async listTools(): Promise<ToolInfo[]> {
    await this.ensureConnected();

    if (!this.client) {
      throw new McpNotConnectedError();
    }

    const result = await this.client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  /**
   * Execute a tool call on the connected MCP server
   */
  async executeTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    await this.ensureConnected();

    if (!this.client) {
      throw new McpNotConnectedError();
    }

    const result = await this.client.callTool({
      name: toolName,
      arguments: args,
    });

    const content = (result as any).content || [];
    return {
      content: content.map((item: any) => ({
        type: item.type,
        text: item.text,
        data: item.data,
        mimeType: item.mimeType,
      })),
      isError: result.isError as boolean | undefined,
    };
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.connected = false;
  }
}
