"use node";

/**
 * API Access Tokens Actions (Node.js runtime)
 * These actions run in Node.js environment for crypto operations.
 */

import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import crypto from "node:crypto";

const TOKEN_PREFIX = "agf_";
const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function generatePlaintext(): string {
  return TOKEN_PREFIX + crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

export const generate = action({
  args: { name: v.string(), agentId: v.optional(v.string()) },
  handler: async (ctx, { name, agentId }) => {
    if (!name || name.length < 1 || name.length > 100)
      throw new Error("Token name must be 1-100 characters");
    const plaintext = generatePlaintext();
    const tokenHash = hashToken(plaintext);
    await ctx.runMutation(internal.apiAccessTokensActions.insertToken, { tokenHash, name, agentId });
    return { plaintext, name, agentId };
  },
});

export const insertToken = internalMutation({
  args: {
    tokenHash: v.string(),
    name: v.string(),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, { tokenHash, name, agentId }) => {
    await ctx.db.insert('apiAccessTokens', {
      tokenHash,
      name,
      agentId,
      createdAt: Date.now(),
    });
  },
});
