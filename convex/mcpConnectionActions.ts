"use node";

/**
 * MCP Connection Actions
 *
 * These actions run in the Convex Node.js runtime and handle MCP connection testing.
 * They can make HTTP requests to probe MCP servers and update connection status.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Test an MCP connection by attempting to fetch its tool list.
 *
 * For stdio-based servers (npx/node prefix), returns success with "stdio-protocol" marker.
 * For HTTP-based servers, POSTs to /tools/list endpoint with auth headers.
 *
 * Updates connection status in database after testing.
 */
export const testConnection = action({
  args: { id: v.id("mcpConnections") },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    tools: string[];
    error?: string;
    latencyMs: number;
  }> => {
    const start = Date.now();
    try {
      const connection = await ctx.runQuery(internal.mcpConnections.get, { id: args.id });
      if (!connection) {
        throw new Error("Connection not found");
      }

      // Build auth headers from credentials
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (connection.credentials?.apiKey) {
        headers["Authorization"] = "Bearer " + connection.credentials.apiKey;
      }
      if (connection.credentials?.GITHUB_PERSONAL_ACCESS_TOKEN) {
        headers["Authorization"] = "Bearer " + connection.credentials.GITHUB_PERSONAL_ACCESS_TOKEN;
      }
      if (connection.credentials?.SLACK_BOT_TOKEN) {
        headers["Authorization"] = "Bearer " + connection.credentials.SLACK_BOT_TOKEN;
      }
      if (connection.credentials?.BRAVE_API_KEY) {
        headers["X-API-Key"] = connection.credentials.BRAVE_API_KEY;
      }

      // For npx-based servers (most MCP servers), we cannot make HTTP calls.
      // Return a success with 'stdio' protocol note.
      if (
        connection.serverUrl.startsWith("npx ") ||
        connection.serverUrl.startsWith("node ")
      ) {
        // Mark as connected (stdio protocol — cannot probe via HTTP)
        await ctx.runMutation(internal.mcpConnections.updateStatus, {
          id: args.id,
          isConnected: true,
        });
        return {
          ok: true,
          tools: ["stdio-protocol"],
          latencyMs: Date.now() - start,
        };
      }

      // For HTTP-based MCP servers
      const url = connection.serverUrl.endsWith("/tools/list")
        ? connection.serverUrl
        : connection.serverUrl + "/tools/list";

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as { tools?: Array<{ name: string }> };
      const tools = (data.tools ?? []).map((t: { name: string }) => t.name);

      await ctx.runMutation(internal.mcpConnections.updateStatus, {
        id: args.id,
        isConnected: true,
      });

      return {
        ok: true,
        tools,
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      // Mark as disconnected on error
      await ctx.runMutation(internal.mcpConnections.updateStatus, {
        id: args.id,
        isConnected: false,
      });
      return {
        ok: false,
        tools: [],
        error: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - start,
      };
    }
  },
});
