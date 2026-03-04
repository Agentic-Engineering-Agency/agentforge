import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get all threads
export const list = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("threads")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
    }
    
    if (args.agentId) {
      return await ctx.db
        .query("threads")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    }
    
    if (args.userId) {
      return await ctx.db
        .query("threads")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    
    return await ctx.db.query("threads").collect();
  },
});

// Query: Get thread by ID
export const get = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation: Create a new thread
export const create = mutation({
  args: {
    name: v.optional(v.string()),
    agentId: v.string(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return threadId;
  },
});

// Mutation: Update thread
export const update = mutation({
  args: {
    id: v.id("threads"),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
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

// Mutation: Rename thread (accepts string ID for short/long ID support)
export const rename = mutation({
  args: {
    id: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Try to find the thread by string ID
    let thread = null;
    const allThreads = await ctx.db.query("threads").collect();
    thread = allThreads.find(t => String(t._id) === args.id || t._id === args.id);

    if (!thread) {
      throw new Error(`Thread "${args.id}" not found`);
    }

    await ctx.db.patch(thread._id, {
      name: args.name,
      updatedAt: Date.now(),
    });
    return thread._id;
  },
});

// Mutation: Delete thread
export const remove = mutation({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    // Delete all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", args.id!))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    // Delete the thread
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
