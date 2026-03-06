"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import * as crypto from "node:crypto";

declare const process: { env: Record<string, string | undefined> };

function getVaultKey(): Buffer {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("VAULT_ENCRYPTION_KEY must be at least 32 characters");
  }
  return Buffer.from(key, "utf8");
}

/**
 * Derives an AES-256 key from VAULT_ENCRYPTION_KEY + a random per-record salt
 * using HKDF-SHA256. The salt must be stored alongside the ciphertext.
 */
function deriveKey(salt: Buffer): Buffer {
  return Buffer.from(
    crypto.hkdfSync("sha256", getVaultKey(), salt, "agentforge-bot-token-v1", 32)
  );
}

/**
 * Internal action: encrypt a bot token using AES-256-GCM with a random per-record salt.
 * Returns base64-encoded ciphertext, IV, and salt for storage.
 */
export const encryptBotToken = internalAction({
  args: { plaintext: v.string() },
  returns: v.object({
    encrypted: v.string(),
    iv: v.string(),
    salt: v.string(),
  }),
  handler: async (_, { plaintext }) => {
    const salt = crypto.randomBytes(16); // 128-bit salt: adequate entropy for HKDF-SHA256
    const key = deriveKey(salt);
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Prepend the 16-byte auth tag to the ciphertext so it can be verified on decrypt
    const combined = Buffer.concat([authTag, encrypted]);

    return {
      encrypted: combined.toString("base64"),
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
    };
  },
});

/**
 * Internal action: decrypt a bot token that was encrypted with encryptBotToken.
 */
export const decryptBotToken = internalAction({
  args: {
    encrypted: v.string(),
    iv: v.string(),
    salt: v.string(),
  },
  returns: v.string(),
  handler: async (_, { encrypted, iv, salt }) => {
    const saltBuf = Buffer.from(salt, "base64");
    const key = deriveKey(saltBuf);
    const ivBuf = Buffer.from(iv, "base64");
    const combined = Buffer.from(encrypted, "base64");

    // First 16 bytes are the auth tag, rest is ciphertext
    const authTag = combined.subarray(0, 16);
    const ciphertext = combined.subarray(16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuf);
    decipher.setAuthTag(authTag);

    const decrypted = decipher.update(ciphertext);
    return Buffer.concat([decrypted, decipher.final()]).toString("utf8");
  },
});

/**
 * Internal action: get the decrypted bot token for a channel connection.
 * SECURITY: internalAction — not accessible to clients.
 */
export const getDecryptedBotToken = internalAction({
  args: { connectionId: v.id("channelConnections") },
  returns: v.union(
    v.object({
      botToken: v.string(),
      botUsername: v.optional(v.string()),
      channel: v.string(),
      agentId: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(
      internal.channelConnections.getEncryptedConfig,
      { id: args.connectionId }
    );

    if (!connection) return null;
    if (!connection.botToken || !connection.iv || !connection.salt) return null;

    const botToken = await ctx.runAction(
      internal.channelConnectionsActions.decryptBotToken,
      {
        encrypted: connection.botToken,
        iv: connection.iv,
        salt: connection.salt,
      }
    );

    return {
      botToken,
      botUsername: connection.botUsername,
      channel: connection.channel,
      agentId: connection.agentId,
    };
  },
});
