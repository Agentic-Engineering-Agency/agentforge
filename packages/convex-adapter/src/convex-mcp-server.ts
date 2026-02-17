/**
 * ConvexMCPServer - MCP tool registry with Convex storage backend.
 *
 * Extends the core MCPServer to add tool persistence in Convex,
 * enabling tools to be stored, retrieved, and shared across agent
 * sessions and deployments.
 *
 * @example
 * ```typescript
 * import { ConvexMCPServer } from '@agentforge-ai/convex-adapter';
 * import { z } from 'zod';
 *
 * export const runWithTools = action({
 *   args: { prompt: v.string() },
 *   handler: async (ctx, args) => {
 *     const server = new ConvexMCPServer(ctx);
 *
 *     server.registerTool({
 *       name: 'get_weather',
 *       description: 'Get current weather',
 *       inputSchema: z.object({ city: z.string() }),
 *       outputSchema: z.string(),
 *       handler: async ({ city }) => `Weather in ${city}: sunny`,
 *     });
 *
 *     await server.persistTool(server.listTools()[0]);
 *   },
 * });
 * ```
 *
 * @packageDocumentation
 */

import { MCPServer } from '@agentforge-ai/core';
import type { MCPServerConfig, Tool, ToolSchema } from '@agentforge-ai/core';
import type { ConvexActionCtx, PersistedToolRecord } from './types.js';

/**
 * Configuration for ConvexMCPServer.
 */
export interface ConvexMCPServerConfig extends MCPServerConfig {
  /**
   * The Convex table name to persist tools to.
   * @default "skills"
   */
  persistTable?: string;
  /**
   * The Convex mutation reference for persisting tool records.
   * If not provided, persistTool() will store tools in-memory only.
   */
  persistMutation?: any;
  /**
   * The Convex query reference for loading persisted tools.
   */
  loadQuery?: any;
}

/**
 * A Convex-backed MCP Server that extends the core MCPServer with persistence.
 *
 * All tools registered via registerTool() work in-memory as with the core server.
 * The persistTool() method additionally stores tool metadata in Convex for
 * cross-session discovery and management.
 */
export class ConvexMCPServer extends MCPServer {
  /** The Convex action context. */
  public readonly ctx: ConvexActionCtx;

  /** Configuration for persistence. */
  private persistConfig: ConvexMCPServerConfig;

  /** In-memory cache of persisted tool records. */
  private persistedTools: Map<string, PersistedToolRecord> = new Map();

  /**
   * Creates a new ConvexMCPServer.
   *
   * @param ctx - The Convex ActionCtx for backend access.
   * @param config - Optional server and persistence configuration.
   */
  constructor(ctx: ConvexActionCtx, config?: ConvexMCPServerConfig) {
    super({
      name: config?.name ?? 'agentforge-convex-mcp',
      version: config?.version ?? '0.1.0',
    });

    if (!ctx || typeof ctx.runQuery !== 'function') {
      throw new Error('ConvexMCPServer requires a valid Convex ActionCtx.');
    }

    this.ctx = ctx;
    this.persistConfig = config ?? {};
  }

  /**
   * Persists a tool's metadata to the Convex backend.
   *
   * Stores the tool's schema (name, description, input/output schemas) in
   * Convex storage for cross-session tool discovery. The tool must already
   * be registered via registerTool() before persisting.
   *
   * If a persistMutation is configured, the tool record is stored via that
   * mutation. Otherwise, it's cached in memory.
   *
   * @param tool - The tool schema to persist (from listTools()).
   * @throws {Error} If the tool is not registered or persistence fails.
   *
   * @example
   * ```typescript
   * server.registerTool(myTool);
   * const toolSchema = server.listTools().find(t => t.name === 'myTool');
   * await server.persistTool(toolSchema);
   * ```
   */
  async persistTool(tool: ToolSchema): Promise<void> {
    if (!tool || !tool.name) {
      throw new Error('persistTool requires a valid tool with a name.');
    }

    // Verify the tool is registered in memory
    const registered = this.listTools().find((t) => t.name === tool.name);
    if (!registered) {
      throw new Error(
        `Tool '${tool.name}' must be registered via registerTool() before persisting.`,
      );
    }

    const record: PersistedToolRecord = {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      source: 'convex-mcp-server',
      createdAt: Date.now(),
    };

    // Store in memory cache
    this.persistedTools.set(tool.name, record);

    // If a persist mutation is configured, store in Convex
    if (this.persistConfig.persistMutation) {
      await this.ctx.runMutation(this.persistConfig.persistMutation, {
        name: record.name,
        displayName: record.name,
        description: record.description || '',
        category: 'mcp-tool',
        version: this.version,
        code: JSON.stringify({ inputSchema: record.inputSchema, outputSchema: record.outputSchema }),
        schema: record.inputSchema,
        isInstalled: true,
        isEnabled: true,
        createdAt: record.createdAt,
        updatedAt: record.createdAt,
      });
    }
  }

  /**
   * Loads persisted tool records from the Convex backend.
   *
   * Retrieves tool metadata that was previously stored via persistTool().
   * Note: This loads metadata only — tool handlers must be re-registered
   * in the current runtime.
   *
   * @returns An array of persisted tool records.
   */
  async loadPersistedTools(): Promise<PersistedToolRecord[]> {
    if (this.persistConfig.loadQuery) {
      const records = await this.ctx.runQuery(this.persistConfig.loadQuery, {});
      return (records || []).map((r: any) => ({
        name: r.name || r.displayName,
        description: r.description,
        inputSchema: r.schema || {},
        outputSchema: {},
        source: r.category || 'persisted',
        createdAt: r.createdAt || Date.now(),
      }));
    }

    return Array.from(this.persistedTools.values());
  }

  /**
   * Checks if a tool has been persisted.
   *
   * @param toolName - The name of the tool to check.
   * @returns Whether the tool exists in the persistence cache.
   */
  isToolPersisted(toolName: string): boolean {
    return this.persistedTools.has(toolName);
  }

  /**
   * Returns the count of persisted tools.
   */
  getPersistedToolCount(): number {
    return this.persistedTools.size;
  }

  /**
   * Removes a tool from the persistence cache.
   *
   * Note: This does not remove the tool from the in-memory registry.
   * Use this to manage the persistence layer independently.
   *
   * @param toolName - The name of the tool to unpersist.
   * @returns Whether the tool was found and removed.
   */
  unpersistTool(toolName: string): boolean {
    return this.persistedTools.delete(toolName);
  }
}
