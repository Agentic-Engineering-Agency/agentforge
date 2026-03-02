/**
 * API Access Tokens for /v1/chat/completions endpoint (AGE-176)
 * Tokens stored as SHA-256 hashes — plaintext shown once only.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation, query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const validateToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const token = await ctx.db
      .query("apiAccessTokens")
      .withIndex("byTokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
    if (!token || token.revokedAt) return null;
    return { tokenId: token._id, agentId: token.agentId ?? null };
  },
});

export const recordUsage = internalMutation({
  args: { tokenId: v.id("apiAccessTokens") },
  handler: async (ctx, { tokenId }) => {
    await ctx.db.patch(tokenId, { lastUsedAt: Date.now() });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("apiAccessTokens")
      .filter((q) => q.eq(q.field("revokedAt"), undefined))
      .collect();
  },
});

export const insertToken = internalMutation({
  args: { tokenHash: v.string(), name: v.string(), agentId: v.optional(v.string()) },
  handler: async (ctx, { tokenHash, name, agentId }) => {
    return ctx.db.insert("apiAccessTokens", { tokenHash, name, agentId, createdAt: Date.now() });
  },
});

export const revoke = mutation({
  args: { id: v.id("apiAccessTokens") },
  handler: async (ctx, { id }) => {
    const token = await ctx.db.get(id);
    if (!token) throw new Error("Token not found");
    await ctx.db.patch(id, { revokedAt: Date.now() });
    return { success: true };
  },
});
