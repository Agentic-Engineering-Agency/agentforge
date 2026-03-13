import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// Token generation uses crypto.randomBytes() via apiAccessTokensActions.generate (Node.js action).
// Do NOT add a V8 mutation that generates tokens with Math.random() — it is cryptographically insecure.
// The `token` field stores a SHA-256 hash — plaintext is shown once at creation time and never stored.

// Query: list all API access tokens (never returns the hash)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const tokens = await ctx.db.query("apiAccessTokens").order("desc").collect();
    // Strip the hash from the response — return only safe display fields
    return tokens.map(({ token, ...rest }) => rest);
  },
});

// Internal query: validate a token by its SHA-256 hash
// Used by the HTTP channel auth middleware
export const validateByHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const record = await ctx.db
      .query("apiAccessTokens")
      .withIndex("byToken", (q) => q.eq("token", tokenHash))
      .first();
    if (!record) return null;
    if (!record.isActive) return null;
    if (record.expiresAt && record.expiresAt < Date.now()) return null;
    return { _id: record._id, name: record.name, isActive: record.isActive };
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
    token: v.string(), // SHA-256 hash of the plaintext token
    tokenPrefix: v.string(), // Masked display value, e.g. "agf_abc1...ef56"
    name: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { token, tokenPrefix, name, expiresAt }) => {
    await ctx.db.insert("apiAccessTokens", {
      token,
      tokenPrefix,
      name,
      isActive: true,
      createdAt: Date.now(),
      expiresAt,
    });
  },
});
