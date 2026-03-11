import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Query: list all API access tokens
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("apiAccessTokens").order("desc").collect();
  },
});

// Token generation uses crypto.randomBytes() via apiAccessTokensActions.generate (Node.js action).
// Do NOT add a V8 mutation that generates tokens with Math.random() — it is cryptographically insecure.

// Mutation: revoke an API access token
export const revoke = mutation({
  args: { id: v.id("apiAccessTokens") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { isActive: false });
  },
});

// Mutation: remove an API access token
export const remove = mutation({
  args: { id: v.id("apiAccessTokens") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const insertToken = internalMutation({
  args: {
    token: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { token, name }) => {
    await ctx.db.insert("apiAccessTokens", {
      token,
      name,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});
