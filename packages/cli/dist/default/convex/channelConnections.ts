import { v } from "convex/values";
import { action, mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

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
    let results;

    if (args.agentId) {
      results = await ctx.db.query("channelConnections")
        .withIndex("byAgent", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else if (args.channel) {
      results = await ctx.db.query("channelConnections")
        .withIndex("byChannel", (q) => q.eq("channel", args.channel!))
        .collect();
    } else if (args.userId) {
      results = await ctx.db.query("channelConnections")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      results = await ctx.db.query("channelConnections").collect();
    }

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
 * Create a new channel connection with encrypted bot token.
 * Encryption is handled via the "use node" channelConnectionsActions module.
 */
export const create = action({
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

    // Encrypt the bot token using the "use node" action (node:crypto HKDF + AES-256-GCM)
    const { ciphertext, iv, salt } = await ctx.runAction(
      internal.channelConnectionsActions.encryptBotToken,
      { plaintext: botToken }
    );

    return await ctx.runMutation(internal.channelConnections.insertConnection, {
      agentId: rest.agentId,
      channel: rest.channel,
      ciphertext,
      iv,
      salt,
      botUsername: rest.botUsername,
      teamId: rest.teamId,
      webhookSecret: rest.webhookSecret,
      userId: rest.userId,
      projectId: rest.projectId,
    });
  },
});

/**
 * Internal: Insert a channel connection document (called from create action after encryption).
 */
export const insertConnection = internalMutation({
  args: {
    agentId: v.string(),
    channel: v.string(),
    ciphertext: v.string(),
    iv: v.string(),
    salt: v.string(),
    botUsername: v.optional(v.string()),
    teamId: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("channelConnections", {
      agentId: args.agentId,
      channel: args.channel,
      config: {
        botToken: args.ciphertext,
        iv: args.iv,
        salt: args.salt,
        botUsername: args.botUsername,
        teamId: args.teamId,
        webhookSecret: args.webhookSecret,
      },
      status: "active",
      lastActivity: undefined,
      messageCount: 0,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
      projectId: args.projectId,
    });
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

// ---- Internal queries ----

/**
 * Internal: Return raw encrypted config for a connection.
 * Used by getDecryptedBotToken (internalAction in channelConnectionsActions.ts).
 * Never returned to public clients.
 */
export const getConnectionForDecrypt = internalQuery({
  args: { connectionId: v.id("channelConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (!connection) return null;
    return {
      config: {
        botToken: connection.config.botToken,
        iv: connection.config.iv,
        salt: connection.config.salt,
        botUsername: connection.config.botUsername,
      },
      channel: connection.channel,
      agentId: connection.agentId,
    };
  },
});
