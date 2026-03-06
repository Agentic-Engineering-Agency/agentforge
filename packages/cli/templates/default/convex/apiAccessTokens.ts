import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireAuth, requireTokenOrAuth } from "./lib/auth";

// Helper: generate a cryptographically secure random token using Web Crypto API
// (available in both V8 and Node.js Convex runtimes)
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `agf_${hex}`;
}

// Query: list all API access tokens
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("apiAccessTokens").order("desc").collect();
  },
});

// Internal query: find an active, non-expired token by value.
// Used by actions that need to validate tokens without direct ctx.db access.
export const findActiveToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenDoc = await ctx.db
      .query("apiAccessTokens")
      .withIndex("byToken", (q) => q.eq("token", args.token))
      .first();

    if (!tokenDoc || !tokenDoc.isActive) return null;
    if (tokenDoc.expiresAt && tokenDoc.expiresAt < Date.now()) return null;

    return tokenDoc;
  },
});

// Mutation: generate a new API access token
// Note: only user identity (dashboard auth) can generate tokens — not API tokens.
// This prevents privilege escalation via token-based token creation.
export const generate = mutation({
  args: {
    name: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Require authentication (user identity required for token generation)
    await requireAuth(ctx);

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
