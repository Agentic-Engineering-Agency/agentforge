import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Helper: generate random token without Node.js crypto
function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'agf_';
  for (let i = 0; i < 64; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// Query: list all API access tokens
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("apiAccessTokens").order("desc").collect();
  },
});

// Mutation: generate a new API access token
export const generate = mutation({
  args: {
    name: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const token = generateToken();
    const id = await ctx.db.insert("apiAccessTokens", {
      name: args.name,
      token,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
      isActive: true,
    });
    return { id, token };
  },
});

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
