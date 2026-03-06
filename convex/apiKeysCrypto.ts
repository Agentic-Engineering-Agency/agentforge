"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import * as crypto from "node:crypto";

declare const process: { env: Record<string, string | undefined> };

/**
 * Retrieves the AGENTFORGE_KEY_SALT at runtime (not module-load time).
 * This is REQUIRED for production use — called lazily inside action handlers
 * so Convex module analysis doesn't fail.
 */
function getSalt(): string {
  const salt = process.env.AGENTFORGE_KEY_SALT;
  if (!salt || salt.length === 0) {
    throw new Error("AGENTFORGE_KEY_SALT environment variable is required and must not be empty");
  }
  return salt;
}

/**
 * Derives a cryptographic key from the salt using HKDF-SHA256.
 * Uses empty info and salt strings as per Convex best practices.
 */
function deriveKey(salt?: string): Buffer {
  const effectiveSalt = salt ?? getSalt();
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(effectiveSalt, "utf8"), Buffer.alloc(0), "agentforge-api-key-v1", 32));
}

/**
 * Encrypt an API key using AES-256-GCM.
 * Returns the ciphertext, IV (initialization vector), and auth tag.
 * All values are base64-encoded for storage.
 */
export const encryptApiKey = internalAction({
  args: { plaintext: v.string() },
  returns: v.object({
    ciphertext: v.string(),
    iv: v.string(),
    tag: v.string(),
    version: v.literal("aes-gcm-v1"),
  }),
  handler: async (_, { plaintext }) => {
    const key = deriveKey();
    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      version: "aes-gcm-v1" as const,
    };
  },
});

/**
 * Decrypt an API key that was encrypted with AES-256-GCM.
 * Requires the ciphertext, IV, and auth tag.
 */
export const decryptApiKey = internalAction({
  args: {
    ciphertext: v.string(),
    iv: v.string(),
    tag: v.string(),
  },
  returns: v.string(),
  handler: async (_, { ciphertext, iv, tag }) => {
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));

    const decrypted = decipher.update(Buffer.from(ciphertext, "base64"));
    return Buffer.concat([decrypted, decipher.final()]).toString("utf8");
  },
});
