import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";

// Query: List recent logs (paginated)
export const list = query({
  args: {
    level: v.optional(v.string()),
    source: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    let q = args.projectId
      ? ctx.db
          .query("logs")
          .withIndex("byProjectAndTimestamp", (q) => q.eq("projectId", args.projectId!))
          .order("desc")
      : ctx.db.query("logs").withIndex("byTimestamp").order("desc");

    if (args.level) {
      q = q.filter((f) => f.eq(f.field("level"), args.level!)) as typeof q;
    }
    if (args.source) {
      q = q.filter((f) => f.eq(f.field("source"), args.source!)) as typeof q;
    }

    return await q.paginate(args.paginationOpts);
  },
});

// Mutation: Add a log entry
export const add = mutation({
  args: {
    level: v.union(
      v.literal("debug"),
      v.literal("info"),
      v.literal("warn"),
      v.literal("error")
    ),
    source: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    // Token usage fields (optional)
    agentId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    threadId: v.optional(v.id("threads")),
    inputTokens: v.optional(v.float64()),
    outputTokens: v.optional(v.float64()),
    totalTokens: v.optional(v.float64()),
    costUsd: v.optional(v.float64()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("logs", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Mutation: Clear logs older than a given timestamp
export const clearOld = mutation({
  args: { olderThan: v.number() },
  handler: async (ctx, args) => {
    const old = await ctx.db
      .query("logs")
      .withIndex("byTimestamp")
      .filter((q) => q.lt(q.field("timestamp"), args.olderThan))
      .collect();

    for (const log of old) {
      await ctx.db.delete(log._id);
    }

    return old.length;
  },
});
