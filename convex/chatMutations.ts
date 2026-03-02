/**
 * Chat Mutations for AgentForge
 *
 * These mutations run in the default Convex runtime (not Node.js).
 * They store messages and thread metadata.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// Queries
// ============================================================

/**
 * Get the current chat state for a thread: messages + thread metadata.
 */
export const getThreadMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", args.threadId))
      .collect();
    return messages;
  },
});

/**
 * List all threads for a user, ordered by most recent activity.
 */
export const listThreads = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let threads;
    if (args.agentId) {
      threads = await ctx.db
        .query("threads")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else if (args.userId) {
      threads = await ctx.db
        .query("threads")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      threads = await ctx.db.query("threads").collect();
    }
    // Sort by most recently updated
    return threads.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new chat thread for an agent.
 */
export const createThread = mutation({
  args: {
    agentId: v.string(),
    name: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      name: args.name || "New Chat",
      agentId: args.agentId,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });
    return threadId;
  },
});

/**
 * Store a user message in a thread (called before triggering LLM).
 */
export const addUserMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return messageId;
  },
});

/**
 * Store an assistant message in a thread (called after LLM responds).
 */
export const addAssistantMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: "assistant",
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return messageId;
  },
});
