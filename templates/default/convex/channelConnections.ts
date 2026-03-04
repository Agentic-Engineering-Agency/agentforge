import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// Helper: Encrypt a bot token using vault
async function encryptBotToken(token: string): Promise<{ encrypted: string; iv: string }> {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("VAULT_ENCRYPTION_KEY not configured");
  }

  // Derive key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = new TextEncoder().encode(key.slice(0, 16)); // Use first 16 chars as salt
  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  // Encrypt
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    new TextEncoder().encode(token)
  );

  // Convert to base64
  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return { encrypted: encryptedBase64, iv: ivBase64 };
}

// Helper: Decrypt a bot token
async function decryptBotToken(encrypted: string, iv: string): Promise<string> {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("VAULT_ENCRYPTION_KEY not configured");
  }

  // Derive key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  const salt = new TextEncoder().encode(key.slice(0, 16));
  const cryptoKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  // Decrypt
  const encryptedData = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const ivData = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivData },
    cryptoKey,
    encryptedData
  );

  return new TextDecoder().decode(decrypted);
}

// ---- Queries ----

/**
 * List all channel connections, optionally filtered by agentId or channel
 */
export const list = query({
  args: {
    agentId: v.optional(v.string()),
    channel: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let connections = ctx.db.query("channelConnections");

    if (args.agentId) {
      connections = connections.withIndex("byAgent", (q) => q.eq("agentId", args.agentId!));
    } else if (args.channel) {
      connections = connections.withIndex("byChannel", (q) => q.eq("channel", args.channel!));
    } else if (args.userId) {
      connections = connections.withIndex("byUserId", (q) => q.eq("userId", args.userId!));
    }

    const results = await connections.collect();

    // Return without sensitive data
    return results.map((c) => ({
      _id: c._id,
      agentId: c.agentId,
      channel: c.channel,
      config: {
        botUsername: c.config.botUsername,
        teamId: c.config.teamId,
      },
      status: c.status,
      lastActivity: c.lastActivity,
      messageCount: c.messageCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  },
});

/**
 * Get a single channel connection by ID
 */
export const getById = query({
  args: { id: v.id("channelConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.id);
    if (!connection) return null;

    // Return without sensitive data
    return {
      _id: connection._id,
      agentId: connection.agentId,
      channel: connection.channel,
      config: {
        botUsername: connection.config.botUsername,
        teamId: connection.config.teamId,
      },
      status: connection.status,
      lastActivity: connection.lastActivity,
      messageCount: connection.messageCount,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  },
});

// ---- Mutations ----

/**
 * Create a new channel connection with encrypted config
 */
export const create = mutation({
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
    const { botToken, ...rest } = args;

    // Encrypt the bot token
    const { encrypted, iv } = await encryptBotToken(botToken);

    const now = Date.now();
    const id = await ctx.db.insert("channelConnections", {
      agentId: rest.agentId,
      channel: rest.channel,
      config: {
        botToken: encrypted,
        iv: iv, // Store IV for decryption
        botUsername: rest.botUsername,
        teamId: rest.teamId,
        webhookSecret: rest.webhookSecret,
      },
      status: "active",
      lastActivity: undefined,
      messageCount: 0,
      userId: rest.userId,
      createdAt: now,
      updatedAt: now,
      projectId: rest.projectId,
    });

    return id;
  },
});

/**
 * Update the status of a channel connection
 */
export const updateStatus = mutation({
  args: {
    id: v.id("channelConnections"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, status } = args;
    await ctx.db.patch(id, {
      status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Update activity tracking for a channel connection
 */
export const updateActivity = mutation({
  args: {
    id: v.id("channelConnections"),
    messageCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, messageCount } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Connection not found");

    await ctx.db.patch(id, {
      lastActivity: Date.now(),
      messageCount: messageCount ?? (existing.messageCount ?? 0) + 1,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Remove a channel connection
 */
export const remove = mutation({
  args: { id: v.id("channelConnections") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ---- Internal Actions ----

/**
 * Internal: Get decrypted bot token for a connection
 * Only callable from other Convex functions (actions/internal)
 */
export const getDecryptedBotToken = internalQuery({
  args: { connectionId: v.id("channelConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }

    if (!connection.config.botToken) {
      throw new Error("No bot token configured");
    }

    const iv = connection.config.iv || "";
    const decrypted = await decryptBotToken(connection.config.botToken, iv);

    return {
      botToken: decrypted,
      botUsername: connection.config.botUsername,
      channel: connection.channel,
      agentId: connection.agentId,
    };
  },
});
