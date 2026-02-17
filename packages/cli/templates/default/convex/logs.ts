import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: List recent logs
export const list = query({
  args: {
    level: v.optional(v.string()),
    source: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("logs").withIndex("byTimestamp").order("desc");

    const results = await q.collect();

    let filtered = results;
    if (args.level) {
      filtered = filtered.filter((l) => l.level === args.level);
    }
    if (args.source) {
      filtered = filtered.filter((l) => l.source === args.source);
    }

    return filtered.slice(0, args.limit || 100);
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
