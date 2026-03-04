/**
 * Thread queries and mutations for the dashboard chat UI.
 *
 * These are plain Convex queries/mutations (NOT "use node") because
 * chat.ts uses "use node" and can only export actions.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * List all threads (sorted newest first) for the dashboard.
 */
export const listThreads = query({
  args: {},
  handler: async (ctx) => {
    const threads = await ctx.db
      .query("threads")
      .order("desc")
      .take(100);
    return threads;
  },
});

/**
 * Get a single thread by ID.
 */
export const getThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db.get(threadId);
  },
});

/**
 * Get all messages for a thread (sorted oldest first for display).
 */
export const getThreadMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", threadId))
      .order("asc")
      .take(500);
  },
});

/**
 * Create a new thread.
 */
export const createThread = mutation({
  args: {
    agentId: v.string(),
    name: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, { agentId, name, projectId }) => {
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      agentId,
      name: name ?? "New Chat",
      projectId,
      createdAt: now,
      updatedAt: now,
    });
    return threadId;
  },
});

/**
 * Delete a thread and all its messages.
 */
export const deleteThread = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", threadId))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }
    await ctx.db.delete(threadId);
  },
});

export const rename = mutation({
  args: { threadId: v.id("threads"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, { name: args.name });
  },
});
