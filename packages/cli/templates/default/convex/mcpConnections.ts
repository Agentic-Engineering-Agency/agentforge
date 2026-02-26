import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: List MCP connections
export const list = query({
  args: {
    userId: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
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
    lastConnectedAt: v.optional(v.number()),
    toolCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, isConnected, lastConnectedAt, toolCount } = args;
    const updates: Record<string, any> = {
      isConnected,
      updatedAt: Date.now(),
    };
    if (lastConnectedAt !== undefined) {
      updates.lastConnectedAt = lastConnectedAt;
    } else if (isConnected) {
      updates.lastConnectedAt = Date.now();
    }
    if (toolCount !== undefined) {
      updates.toolCount = toolCount;
    }
    await ctx.db.patch(id, updates);
    return id;
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
