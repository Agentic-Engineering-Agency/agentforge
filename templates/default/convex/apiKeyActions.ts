"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Action: Create an API key — encrypts the plaintext key and stores it in the database.
 * Replaces the old `apiKeys.create` mutation (which incorrectly called ctx.runAction()).
 */
export const create = action({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(), // Plaintext key to encrypt (arg name kept for client compatibility)
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
      plaintext: args.encryptedKey,
    });
    return await ctx.runMutation(internal.apiKeys._insertEncryptedApiKey, {
      provider: args.provider,
      keyName: args.keyName,
      encryptedKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      version: encrypted.version,
      userId: args.userId,
    });
  },
});

/**
 * Action: Update an API key — re-encrypts the key if a new plaintext key is provided.
 * Replaces the old `apiKeys.update` mutation (which incorrectly called ctx.runAction()).
 */
export const update = action({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()), // Plaintext key to re-encrypt
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string> => {
    const { id, encryptedKey, ...rest } = args;
    const updates: {
      keyName?: string;
      isActive?: boolean;
      encryptedKey?: string;
      iv?: string;
      tag?: string;
      version?: "aes-gcm-v1";
    } = { ...rest };

    if (encryptedKey !== undefined) {
      const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
        plaintext: encryptedKey,
      });
      updates.encryptedKey = encrypted.ciphertext;
      updates.iv = encrypted.iv;
      updates.tag = encrypted.tag;
      updates.version = encrypted.version;
    }

    return await ctx.runMutation(internal.apiKeys._updateEncryptedApiKey, {
      id,
      ...updates,
    });
  },
});

export const testKey = action({
  args: {
    provider: v.string(),
    keyValue: v.string(),
  },
  handler: async (_ctx, args): Promise<{ ok: boolean; error?: string; latencyMs: number }> => {
    const start = Date.now();
    try {
      if (args.provider === "openai" || args.provider === "openrouter") {
        const baseURL =
          args.provider === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : "https://api.openai.com/v1";
        const resp = await fetch(`${baseURL}/models`, {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "anthropic") {
        const resp = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": args.keyValue,
            "anthropic-version": "2023-06-01",
          },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "google") {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${args.keyValue}`
        );
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "mistral") {
        const resp = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "deepseek") {
        const resp = await fetch("https://api.deepseek.com/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "xai") {
        const resp = await fetch("https://api.x.ai/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "groq") {
        const resp = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "together") {
        const resp = await fetch("https://api.together.xyz/v1/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else if (args.provider === "perplexity") {
        const resp = await fetch("https://api.perplexity.ai/models", {
          headers: { Authorization: `Bearer ${args.keyValue}` },
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
      } else {
        throw new Error(`Provider ${args.provider} not supported for testing`);
      }

      return { ok: true, latencyMs: Date.now() - start };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - start,
      };
    }
  },
});
