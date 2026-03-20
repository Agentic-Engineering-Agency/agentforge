import { createTool, type Tool } from '@mastra/core/tools';
import { z } from 'zod';
import type { MCPClient, MCPToolDefinition } from './mcp-client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MastraTool = Tool<any, any, any, any, any, any, any>;

/**
 * Convert a JSON Schema object to a Zod schema.
 * Handles: string, number, integer, boolean, object, array.
 */
export function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const type = schema['type'] as string | undefined;

  switch (type) {
    case 'string':
      return z.string();
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'object': {
      const properties = schema['properties'] as
        | Record<string, Record<string, unknown>>
        | undefined;
      const required = schema['required'] as string[] | undefined;

      if (!properties) return z.object({});

      const shape: z.ZodRawShape = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        const zodField = jsonSchemaToZod(propSchema);
        shape[key] = required?.includes(key) ? zodField : zodField.optional();
      }
      return z.object(shape);
    }
    case 'array': {
      const items = schema['items'] as Record<string, unknown> | undefined;
      return z.array(items ? jsonSchemaToZod(items) : z.unknown());
    }
    default:
      return z.unknown();
  }
}

/**
 * MCPDynamicToolLoader wraps MCP server tools as Mastra-compatible tools
 * so they can be injected into any Mastra Agent at runtime.
 */
export class MCPDynamicToolLoader {
  private tools: Record<string, MastraTool> = {};
  private watchInterval: ReturnType<typeof setInterval> | null = null;
  private lastToolNames: string[] = [];

  /**
   * Load all tools from an MCPClient and return them as Mastra-compatible tools.
   */
  async loadTools(client: MCPClient): Promise<Record<string, MastraTool>> {
    const mcpTools = await client.listTools();
    this.tools = {};

    for (const mcpTool of mcpTools) {
      this.tools[mcpTool.name] = this.wrapTool(client, mcpTool);
    }

    this.lastToolNames = mcpTools.map((t) => t.name).sort();
    return { ...this.tools };
  }

  /**
   * Poll the MCP server for tool list changes and invoke onUpdate when the set changes.
   */
  watchTools(
    client: MCPClient,
    onUpdate: (tools: Record<string, MastraTool>) => void,
    intervalMs = 5_000,
  ): void {
    this.stopWatching();

    this.watchInterval = setInterval(async () => {
      try {
        const mcpTools = await client.listTools();
        const currentNames = mcpTools.map((t) => t.name).sort();

        if (JSON.stringify(currentNames) !== JSON.stringify(this.lastToolNames)) {
          this.tools = {};
          for (const mcpTool of mcpTools) {
            this.tools[mcpTool.name] = this.wrapTool(client, mcpTool);
          }
          this.lastToolNames = currentNames;
          onUpdate({ ...this.tools });
        }
      } catch (error) {
        console.debug('[MCPDynamicTools.watchTools] Polling error (will retry):', error instanceof Error ? error.message : error);
      }
    }, intervalMs);
  }

  /**
   * Stop watching for tool changes and clean up internal state.
   */
  unloadTools(): void {
    this.stopWatching();
    this.tools = {};
    this.lastToolNames = [];
  }

  /**
   * Get the currently loaded tools.
   */
  getTools(): Record<string, MastraTool> {
    return { ...this.tools };
  }

  private stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  private wrapTool(client: MCPClient, mcpTool: MCPToolDefinition): MastraTool {
    const inputSchema = mcpTool.inputSchema
      ? jsonSchemaToZod(mcpTool.inputSchema)
      : z.object({});

    return createTool({
      id: `mcp_${mcpTool.name}`,
      description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
      inputSchema,
      execute: async (inputData) => {
        const result = await client.callTool(mcpTool.name, inputData as Record<string, unknown>);
        return result;
      },
    }) as MastraTool;
  }
}
