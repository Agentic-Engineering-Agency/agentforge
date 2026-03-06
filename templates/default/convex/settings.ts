import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get a setting by key
export const get = query({
  args: { userId: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("byUserIdAndKey", (q) =>
        q.eq("userId", args.userId!).eq("key", args.key!)
      )
      .first();
    return setting;
  },
});

// Query: List all settings for a user
export const list = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("settings")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    return await ctx.db.query("settings").collect();
  },
});

// Mutation: Set a setting (upsert)
export const set = mutation({
  args: {
    userId: v.string(),
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("byUserIdAndKey", (q) =>
        q.eq("userId", args.userId!).eq("key", args.key!)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("settings", {
      userId: args.userId,
      key: args.key,
      value: args.value,
      updatedAt: Date.now(),
    });
  },
});

// Mutation: Delete a setting
export const remove = mutation({
  args: { userId: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("byUserIdAndKey", (q) =>
        q.eq("userId", args.userId!).eq("key", args.key!)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
