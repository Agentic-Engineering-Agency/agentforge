"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import * as crypto from "node:crypto";

declare const process: { env: Record<string, string | undefined> };

function getVaultKey(): string {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("VAULT_ENCRYPTION_KEY must be at least 32 characters for cryptographic security");
  }
  return key;
}

function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.hkdfSync("sha256", Buffer.from(masterKey, "utf8"), salt, "agentforge-channel-token-v1", 32);
}

/**
 * Encrypt a bot token using AES-256-GCM with HKDF-SHA256 key derivation.
 * Uses a random per-record salt so each token has a unique derived key.
 */
export const encryptBotToken = internalAction({
  args: { plaintext: v.string() },
  returns: v.object({
    ciphertext: v.string(),
    iv: v.string(),
    salt: v.string(),
  }),
  handler: async (_, { plaintext }) => {
    const masterKey = getVaultKey();
    const salt = crypto.randomBytes(16);
    const key = deriveKey(masterKey, salt);
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag(); // 128-bit auth tag

    // Append the auth tag to the ciphertext for storage
    const ciphertextWithTag = Buffer.concat([encrypted, tag]);

    return {
      ciphertext: ciphertextWithTag.toString("base64"),
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
    };
  },
});

/**
 * Decrypt a bot token stored in channelConnections.
 * Reads the encrypted record, derives the key using the stored per-record salt,
 * and decrypts with AES-256-GCM.
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
  handler: async (ctx, { connectionId }) => {
    const connection = await ctx.runQuery(
      internal.channelConnections.getConnectionForDecrypt,
      { connectionId }
    );
    if (!connection) return null;

    const { botToken, iv, salt } = connection.config;
    if (!botToken || !iv || !salt) {
      throw new Error("Bot token not configured or missing encryption fields (botToken/iv/salt)");
    }

    const masterKey = getVaultKey();
    const saltBuf = Buffer.from(salt, "base64");
    const key = deriveKey(masterKey, saltBuf);

    const ciphertextWithTag = Buffer.from(botToken, "base64");
    if (ciphertextWithTag.length < 16) {
      throw new Error("Ciphertext too short to contain auth tag");
    }
    // Last 16 bytes are the GCM auth tag
    const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
    const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return {
      botToken: decrypted.toString("utf8"),
      botUsername: connection.config.botUsername,
      channel: connection.channel,
      agentId: connection.agentId,
    };
  },
});
