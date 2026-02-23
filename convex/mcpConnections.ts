import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: List MCP connections
export const list = query({
  args: {
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      const connections = await ctx.db
        .query("mcpConnections")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();

      if (args.isEnabled !== undefined) {
        return connections.filter((c) => c.isEnabled === args.isEnabled);
      }
      return connections;
    }

    if (args.isEnabled !== undefined) {
      const connections = await ctx.db
        .query("mcpConnections")
        .withIndex("byIsEnabled", (q) => q.eq("isEnabled", args.isEnabled!))
        .collect();

      if (args.userId) {
        return connections.filter((c) => c.userId === args.userId);
      }
      return connections;
    }

    if (args.userId) {
      return await ctx.db
        .query("mcpConnections")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }

    return await ctx.db.query("mcpConnections").collect();
  },
});

// Query: Get MCP connection by ID
export const get = query({
  args: { id: v.id("mcpConnections") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation: Create MCP connection
export const create = mutation({
  args: {
    name: v.string(),
    serverUrl: v.string(),
    protocol: v.string(),
    credentials: v.optional(v.any()),
    capabilities: v.optional(v.any()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const connectionId = await ctx.db.insert("mcpConnections", {
      ...args,
      isConnected: false,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
    return connectionId;
  },
});

// Mutation: Update MCP connection
export const update = mutation({
  args: {
    id: v.id("mcpConnections"),
    name: v.optional(v.string()),
    serverUrl: v.optional(v.string()),
    credentials: v.optional(v.any()),
    capabilities: v.optional(v.any()),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Mutation: Update connection status
export const updateStatus = mutation({
  args: {
    id: v.id("mcpConnections"),
    isConnected: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isConnected: args.isConnected,
      lastConnectedAt: args.isConnected ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Mutation: Toggle MCP connection enabled status
export const toggleEnabled = mutation({
  args: { id: v.id("mcpConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.id);
    
    if (!connection) {
      throw new Error(`MCP connection not found`);
    }
    
    await ctx.db.patch(args.id, {
      isEnabled: !connection.isEnabled,
      updatedAt: Date.now(),
    });
    
    return { success: true, isEnabled: !connection.isEnabled };
  },
});

// Mutation: Delete MCP connection
export const remove = mutation({
  args: { id: v.id("mcpConnections") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
