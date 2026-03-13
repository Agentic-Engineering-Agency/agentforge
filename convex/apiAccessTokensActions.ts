"use node";

/**
 * API Access Tokens Actions (Node.js runtime)
 * These actions run in Node.js environment for crypto operations.
 *
 * Tokens are generated with crypto.randomBytes and stored as SHA-256 hashes.
 * The plaintext is returned once at creation time and never stored.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
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

function maskToken(token: string): string {
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

export const generate = action({
  args: { name: v.string(), agentId: v.optional(v.string()), expiresAt: v.optional(v.number()) },
  handler: async (ctx, { name, agentId, expiresAt }) => {
    if (!name || name.length < 1 || name.length > 100)
      throw new Error("Token name must be 1-100 characters");
    const plaintext = generatePlaintext();
    const tokenHash = hashToken(plaintext);
    const tokenPrefix = maskToken(plaintext);
    await ctx.runMutation(internal.apiAccessTokens.insertToken, {
      token: tokenHash,
      tokenPrefix,
      name,
      expiresAt,
    });
    return { plaintext, name, agentId };
  },
});
