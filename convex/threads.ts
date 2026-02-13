import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const threadId = await ctx.db.insert("threads", args);
    return threadId;
  },
});

export const get = query({
  args: { id: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.id);
    return thread;
  },
});
