import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    instructions: v.string(),
    model: v.string(),
    tools: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const agentId = await ctx.db.insert("agents", args);
    return agentId;
  },
});

export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_id", (q) => q.eq("id", args.id))
      .unique();
    return agent;
  },
});
