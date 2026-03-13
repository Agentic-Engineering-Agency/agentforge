"use node";

/**
 * Vault Crypto (Node.js runtime)
 *
 * AES-256-GCM encryption/decryption for vault secrets using node:crypto.
 * All crypto operations run in Node.js actions — never in V8 queries/mutations.
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import crypto from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const IV_BYTES = 12;
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): string {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "VAULT_ENCRYPTION_KEY must be set in environment variables and be at least 32 characters long."
    );
  }
  return key;
}

function getVaultSalt(): Buffer {
  const storedSalt = process.env.VAULT_SALT;
  if (storedSalt && storedSalt.length >= 16) {
    return Buffer.from(storedSalt, "utf8");
  }
  console.warn(
    "WARNING: VAULT_SALT not set or too short. Using ephemeral random salt. " +
    "Encrypted data will be inaccessible after restart!"
  );
  return crypto.randomBytes(16);
}

function deriveKey(password: string): Buffer {
  const salt = getVaultSalt();
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

function encryptValue(plaintext: string, password: string): { encrypted: string; iv: string } {
  const key = deriveKey(password);
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Append auth tag to ciphertext
  const combined = Buffer.concat([encrypted, tag]);

  return {
    encrypted: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

function decryptValue(encryptedB64: string, ivB64: string, password: string): string {
  const key = deriveKey(password);
  const iv = Buffer.from(ivB64, "base64");
  const combined = Buffer.from(encryptedB64, "base64");

  // Last 16 bytes are the auth tag
  const encrypted = combined.subarray(0, combined.length - 16);
  const tag = combined.subarray(combined.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

// Mask a secret value for display
function maskSecret(value: string): string {
  if (value.length <= 12) {
    return value.substring(0, 3) + "..." + value.substring(value.length - 3);
  }
  return value.substring(0, 6) + "..." + value.substring(value.length - 4);
}

/**
 * Encrypt a secret value and store it in the vault.
 */
export const encryptAndStore = internalAction({
  args: {
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    value: v.string(),
    userId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const password = getEncryptionKey();
    const { encrypted, iv } = encryptValue(args.value, password);
    const masked = maskSecret(args.value);

    const id = await ctx.runMutation(internal.vault.insertEncrypted, {
      name: args.name,
      category: args.category,
      provider: args.provider,
      encryptedValue: encrypted,
      iv,
      maskedValue: masked,
      userId: args.userId,
      expiresAt: args.expiresAt,
      source: args.source ?? "dashboard",
    });

    return { id, masked };
  },
});

/**
 * Re-encrypt a vault entry with a new value.
 */
export const reEncrypt = internalAction({
  args: {
    id: v.id("vault"),
    value: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const password = getEncryptionKey();
    const { encrypted, iv } = encryptValue(args.value, password);
    const masked = maskSecret(args.value);

    await ctx.runMutation(internal.vault.updateEncryptedValue, {
      id: args.id,
      encryptedValue: encrypted,
      iv,
      maskedValue: masked,
      userId: args.userId,
    });
  },
});

/**
 * Decrypt a vault secret.
 */
export const decryptSecret = internalAction({
  args: {
    id: v.id("vault"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.runQuery(internal.vault.getRawEntry, { id: args.id });
    if (!entry) throw new Error("Vault entry not found");
    if (!entry.isActive) throw new Error("Vault entry is disabled");

    await ctx.runMutation(internal.vault.recordAccess, {
      id: args.id,
      userId: args.userId,
    });

    const password = getEncryptionKey();
    return decryptValue(entry.encryptedValue, entry.iv, password);
  },
});

/**
 * Encrypt a secret for the censorMessage flow.
 * Returns encrypted data without storing (caller handles storage).
 */
export const encryptForCensor = internalAction({
  args: {
    value: v.string(),
  },
  handler: async (_ctx, args) => {
    const password = getEncryptionKey();
    const { encrypted, iv } = encryptValue(args.value, password);
    const masked = maskSecret(args.value);
    return { encrypted, iv, masked };
  },
});
