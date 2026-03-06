import { v } from "convex/values";
import { action, mutation, query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireTokenOrAuth, requireActionAuth } from "./lib/auth";

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

// Internal mutation: Insert a new API key record (called from create action)
export const _insertKey = internalMutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(),
    iv: v.string(),
    tag: v.string(),
    version: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

// Internal mutation: Patch API key fields (called from update action)
export const _patchKey = internalMutation({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()),
    iv: v.optional(v.string()),
    tag: v.optional(v.string()),
    version: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Action: Create API key (encrypts before storing using AES-256-GCM)
// Actions (not mutations) can call internalActions for encryption.
export const create = action({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(), // Plaintext key to encrypt
    userId: v.optional(v.string()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireActionAuth(
      await ctx.auth.getUserIdentity(),
      args.token,
      (t) => ctx.runQuery(internal.apiAccessTokens.findActiveToken, { token: t })
    );

    const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
      plaintext: args.encryptedKey,
    });

    return await ctx.runMutation(internal.apiKeys._insertKey, {
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

// Action: Update API key (encrypts if key is being updated)
// Actions (not mutations) can call internalActions for encryption.
export const update = action({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()), // Plaintext key to encrypt
    isActive: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireActionAuth(
      await ctx.auth.getUserIdentity(),
      args.token,
      (t) => ctx.runQuery(internal.apiAccessTokens.findActiveToken, { token: t })
    );

    const { id, encryptedKey: plaintext, isActive, keyName } = args;
    const patchData: {
      keyName?: string;
      isActive?: boolean;
      encryptedKey?: string;
      iv?: string;
      tag?: string;
      version?: string;
    } = {};
    if (keyName !== undefined) patchData.keyName = keyName;
    if (isActive !== undefined) patchData.isActive = isActive;

    if (plaintext !== undefined) {
      const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
        plaintext,
      });
      patchData.encryptedKey = encrypted.ciphertext;
      patchData.iv = encrypted.iv;
      patchData.tag = encrypted.tag;
      patchData.version = encrypted.version;
    }

    return await ctx.runMutation(internal.apiKeys._patchKey, { id, ...patchData });
  },
});

// Mutation: Toggle API key active status
export const toggleActive = mutation({
  args: { id: v.id("apiKeys"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Require authentication (either user identity or API token)
    await requireTokenOrAuth(ctx, args.token);

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
  args: { id: v.id("apiKeys"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Require authentication (either user identity or API token)
    await requireTokenOrAuth(ctx, args.token);

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Internal Action: Get decrypted (raw) API key for a provider
// Used by runtime processes that need the actual key value
// SECURITY: This is an internalAction, not exposed to clients
export const getDecryptedForProvider = internalAction({
  args: { provider: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    // Run an internal query to get the key
    const key = await ctx.runQuery(internal.apiKeys.getEncryptedKeyForProvider, {
      provider: args.provider,
    });

    if (!key) return null;

    // Decrypt the key using the crypto action
    return await ctx.runAction(internal.apiKeysCrypto.decryptApiKey, {
      ciphertext: key.encryptedKey,
      iv: key.iv,
      tag: key.tag,
    });
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
