import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireTokenOrAuth } from "./lib/auth";

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
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authentication (user identity required for token generation)
    await requireAuth(ctx);

    const { token: authHeader, ...tokenData } = args;
    const token = generateToken();
    const id = await ctx.db.insert("apiAccessTokens", {
      name: tokenData.name,
      token,
      createdAt: Date.now(),
      expiresAt: tokenData.expiresAt,
      isActive: true,
    });
    return { id, token };
  },
});

// Mutation: revoke an API access token
export const revoke = mutation({
  args: { id: v.id("apiAccessTokens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Require authentication (either user identity or API token)
    await requireTokenOrAuth(ctx, args.token);

    await ctx.db.patch(args.id, { isActive: false });
  },
});

// Mutation: remove an API access token
export const remove = mutation({
  args: { id: v.id("apiAccessTokens"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Require authentication (either user identity or API token)
    await requireTokenOrAuth(ctx, args.token);

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
