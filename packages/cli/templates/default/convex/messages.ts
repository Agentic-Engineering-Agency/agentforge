import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

// Mutation: Add a message to a thread
export const add = mutation({
  args: {
    threadId: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    tool_calls: v.optional(v.any()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });

    // Update thread's updatedAt timestamp
    await ctx.db.patch(args.threadId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Mutation: Create a message (alias for add)
export const create = mutation({
  args: {
    threadId: v.string(),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    tool_calls: v.optional(v.any()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      ...args,
      createdAt: Date.now(),
    });
    return messageId;
  },
});

// Query: Get messages by thread (paginated)
export const list = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", args.threadId!))
      .paginate(args.paginationOpts);
  },
});


// Query: Get all messages by thread (non-paginated, for internal use)
export const getByThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", args.threadId!))
      .order("asc")
      .collect();
  },
});
// Mutation: Delete a message
export const remove = mutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Mutation: Clear all messages in a thread
export const clearThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", args.threadId!))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    
    return { success: true, deleted: messages.length };
  },
});
