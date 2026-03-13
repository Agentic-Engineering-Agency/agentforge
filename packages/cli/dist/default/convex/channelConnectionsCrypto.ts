"use node";

/**
 * Channel Connections Crypto (Node.js runtime)
 *
 * Encrypts/decrypts bot tokens using AES-256-GCM via node:crypto.
 * All crypto operations run in Node.js actions — never in V8 queries/mutations.
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import crypto from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_LENGTH = 32; // 256 bits

function getVaultKey(): string {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("VAULT_ENCRYPTION_KEY not configured or too short (min 32 chars)");
  }
  return key;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

function encryptValue(plaintext: string, password: string): { encrypted: string; iv: string; salt: string } {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Append auth tag to ciphertext for storage
  const combined = Buffer.concat([encrypted, tag]);

  return {
    encrypted: combined.toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
  };
}

function decryptValue(encryptedB64: string, ivB64: string, password: string, saltB64?: string): string {
  const salt = saltB64
    ? Buffer.from(saltB64, "base64")
    : Buffer.from(password.slice(0, 16), "utf8"); // fallback for pre-salt records
  const key = deriveKey(password, salt);
  const iv = Buffer.from(ivB64, "base64");
  const combined = Buffer.from(encryptedB64, "base64");

  // Last 16 bytes are the auth tag
  const encrypted = combined.subarray(0, combined.length - 16);
  const tag = combined.subarray(combined.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Encrypt a bot token and store the channel connection.
 * Called from mutations that need to encrypt tokens.
 */
export const encryptAndStore = internalAction({
  args: {
    agentId: v.string(),
    channel: v.string(),
    botToken: v.string(),
    botUsername: v.optional(v.string()),
    teamId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const password = getVaultKey();
    const { encrypted, iv, salt } = encryptValue(args.botToken, password);

    const id = await ctx.runMutation(internal.channelConnections.insertEncrypted, {
      agentId: args.agentId,
      channel: args.channel,
      encryptedToken: encrypted,
      iv,
      salt,
      botUsername: args.botUsername,
      teamId: args.teamId,
      webhookSecret: args.webhookSecret,
      userId: args.userId,
      projectId: args.projectId,
    });

    return id;
  },
});

/**
 * Decrypt a bot token for a channel connection.
 * Returns the plaintext bot token for use by the runtime.
 */
export const decryptBotToken = internalAction({
  args: { connectionId: v.id("channelConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.channelConnections.getRawConnection, {
      connectionId: args.connectionId,
    });

    if (!connection) {
      throw new Error("Connection not found");
    }

    if (!connection.config.botToken) {
      throw new Error("No bot token configured");
    }

    const password = getVaultKey();
    const decrypted = decryptValue(
      connection.config.botToken,
      connection.config.iv || "",
      password,
      connection.config.salt ?? undefined,
    );

    return {
      botToken: decrypted,
      botUsername: connection.config.botUsername,
      channel: connection.channel,
      agentId: connection.agentId,
    };
  },
});
