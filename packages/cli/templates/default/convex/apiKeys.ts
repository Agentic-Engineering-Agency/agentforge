import { v } from "convex/values";
import { mutation, query, internalQuery, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Query: List API keys
export const list = query({
  args: {
    userId: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.provider) {
      const keys = await ctx.db
        .query("apiKeys")
        .withIndex("byProvider", (q) => q.eq("provider", args.provider!))
        .collect();

      if (args.userId) {
        return keys.filter((k) => k.userId === args.userId);
      }
      // Strip sensitive fields before returning
      return keys.map((k) => {
        const { encryptedKey, iv, tag, ...safeFields } = k;
        return safeFields;
      });
    }

    if (args.userId) {
      const keys = await ctx.db
        .query("apiKeys")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
      // Strip sensitive fields before returning
      return keys.map((k) => {
        const { encryptedKey, iv, tag, ...safeFields } = k;
        return safeFields;
      });
    }

    const allKeys = await ctx.db.query("apiKeys").collect();
    // Strip sensitive fields before returning
    return allKeys.map((k) => {
      const { encryptedKey, iv, tag, ...safeFields } = k;
      return safeFields;
    });
  },
});

// Query: Get API key by ID
export const get = query({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    // Strip sensitive fields before returning
    const { encryptedKey, iv, tag, ...safeFields } = doc;
    return safeFields;
  },
});

// Query: Get active API key for provider (PUBLIC - does NOT return decrypted key)
// SECURITY: This is a public query, so it only returns metadata, not the decrypted key
export const getActiveForProvider = query({
  args: {
    provider: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("byProvider", (q) => q.eq("provider", args.provider))
      .collect();

    const activeKeys = keys.filter((k) => k.isActive);

    if (args.userId) {
      const userKey = activeKeys.find((k) => k.userId === args.userId);
      if (!userKey) return null;

      // Return only safe metadata - never return encrypted fields
      const { encryptedKey, iv, tag, ...safeFields } = userKey;
      return safeFields;
    }

    const firstKey = activeKeys[0];
    if (!firstKey) return null;

    // Return only safe metadata - never return encrypted fields
    const { encryptedKey, iv, tag, ...safeFields } = firstKey;
    return safeFields;
  },
});

// Internal Mutation: Insert a pre-encrypted API key into the database.
// Called by the apiKeyActions.create action after encryption.
export const _insertEncryptedApiKey = internalMutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(),
    iv: v.string(),
    tag: v.string(),
    version: v.literal("aes-gcm-v1"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      provider: args.provider,
      keyName: args.keyName,
      encryptedKey: args.encryptedKey,
      iv: args.iv,
      tag: args.tag,
      version: args.version,
      isActive: true,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

// Internal Mutation: Update an API key with pre-encrypted fields.
// Called by the apiKeyActions.update action after encryption.
export const _updateEncryptedApiKey = internalMutation({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    encryptedKey: v.optional(v.string()),
    iv: v.optional(v.string()),
    tag: v.optional(v.string()),
    version: v.optional(v.literal("aes-gcm-v1")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    // Remove undefined fields before patching
    const patch = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, patch);
    return id;
  },
});

// Mutation: Toggle API key active status
export const toggleActive = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.id);

    if (!key) {
      throw new Error(`API key not found`);
    }

    await ctx.db.patch(args.id, {
      isActive: !key.isActive,
    });

    return { success: true, isActive: !key.isActive };
  },
});

// Mutation: Update last used timestamp
export const updateLastUsed = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastUsedAt: Date.now(),
    });
    return args.id;
  },
});

// Mutation: Delete API key
export const remove = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Internal Action: Get decrypted (raw) API key for a provider.
// Used by runtime processes that need the actual key value.
// Returns { apiKey: string } | null — callers must use ctx.runAction(), NOT ctx.runQuery().
// SECURITY: This is an internalAction, not exposed to clients.
export const getDecryptedForProvider = internalAction({
  args: { provider: v.string() },
  returns: v.union(v.object({ apiKey: v.string() }), v.null()),
  handler: async (ctx, args) => {
    // Run an internal query to get the encrypted key material
    const key = await ctx.runQuery(internal.apiKeys.getEncryptedKeyForProvider, {
      provider: args.provider,
    });

    if (!key) return null;

    // Decrypt the key using the crypto action
    const decrypted = await ctx.runAction(internal.apiKeysCrypto.decryptApiKey, {
      ciphertext: key.encryptedKey,
      iv: key.iv,
      tag: key.tag,
    });

    return { apiKey: decrypted };
  },
});

// Internal Query: Get encrypted key for provider (used by getDecryptedForProvider)
// This is internal-only, so it returns the encrypted fields
export const getEncryptedKeyForProvider = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("byProvider", (q) => q.eq("provider", args.provider))
      .collect();
    const active = keys.find((k) => k.isActive);
    if (!active) return null;
    return {
      encryptedKey: active.encryptedKey,
      iv: active.iv,
      tag: active.tag,
    };
  },
});
