import { v } from "convex/values";
import { mutation, query, internalQuery, internalAction, internalMutation, action } from "./_generated/server";
import { encryptApiKey, decryptApiKey } from "./apiKeysCrypto";
import { internal } from "./_generated/api";

// Helper: strip encrypted fields from an API key document before returning to clients
function stripEncryptedFields<T extends { encryptedKey: unknown; iv: unknown; tag: unknown }>(
  key: T
): Omit<T, "encryptedKey" | "iv" | "tag"> {
  const { encryptedKey, iv, tag, ...safeFields } = key;
  return safeFields;
}

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
        return keys
          .filter((k) => k.userId === args.userId)
          .map(stripEncryptedFields);
      }
      // Strip sensitive fields before returning
      return keys.map(stripEncryptedFields);
    }

    if (args.userId) {
      const keys = await ctx.db
        .query("apiKeys")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
      // Strip sensitive fields before returning
      return keys.map(stripEncryptedFields);
    }

    const allKeys = await ctx.db.query("apiKeys").collect();
    // Strip sensitive fields before returning
    return allKeys.map(stripEncryptedFields);
  },
});

// Query: Get API key by ID
export const get = query({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    // Strip sensitive fields before returning
    return stripEncryptedFields(doc);
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
      return stripEncryptedFields(userKey);
    }

    const firstKey = activeKeys[0];
    if (!firstKey) return null;

    // Return only safe metadata - never return encrypted fields
    return stripEncryptedFields(firstKey);
  },
});

// Action: Create API key (encrypts before storing using AES-256-GCM)
export const create = action({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(), // Plaintext key to encrypt
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Call the internal action to encrypt the key
    const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
      plaintext: args.encryptedKey,
    });

    // Call the internal mutation to store the encrypted key
    const keyId = await ctx.runMutation(internal.apiKeys.createInternal, {
      provider: args.provider,
      keyName: args.keyName,
      encryptedKey: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      version: encrypted.version,
      userId: args.userId,
    });
    return keyId;
  },
});

// Action: Update API key (encrypts if key is being updated)
export const update = action({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()), // Plaintext key to encrypt
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, encryptedKey, keyName, isActive } = args;
    const updates: {
      keyName?: string;
      isActive?: boolean;
      encryptedKey?: string;
      iv?: string;
      tag?: string;
      version?: "aes-gcm-v1";
    } = {};

    if (keyName !== undefined) {
      updates.keyName = keyName;
    }

    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    if (encryptedKey !== undefined) {
      // Call the internal action to encrypt the key
      const encrypted = await ctx.runAction(internal.apiKeysCrypto.encryptApiKey, {
        plaintext: encryptedKey,
      });
      updates.encryptedKey = encrypted.ciphertext;
      updates.iv = encrypted.iv;
      updates.tag = encrypted.tag;
      updates.version = encrypted.version;
    }

    // Call the internal mutation to update the key
    await ctx.runMutation(internal.apiKeys.updateInternal, { id, ...updates });
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

// Internal Mutation: Create API key (stores encrypted data)
// Used by the create action
export const createInternal = internalMutation({
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
    const keyId = await ctx.db.insert("apiKeys", {
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
    return keyId;
  },
});

// Internal Mutation: Update API key (stores encrypted data)
// Used by the update action
export const updateInternal = internalMutation({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()),
    iv: v.optional(v.string()),
    tag: v.optional(v.string()),
    version: v.optional(v.literal("aes-gcm-v1")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
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

    // Legacy keys (XOR cipher) don't have a tag — they require re-entry
    if (!key.tag) return null;

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
