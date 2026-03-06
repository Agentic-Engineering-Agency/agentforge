import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Helper to strip encrypted fields before returning to clients
function stripEncryptedFields<T extends { encryptedKey: string; iv: string; tag: string }>(
  doc: T
): Omit<T, "encryptedKey" | "iv" | "tag"> {
  const { encryptedKey: _ek, iv: _iv, tag: _tag, ...safeFields } = doc;
  return safeFields;
}

// Query: List API keys (never returns encrypted fields)
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

      const filtered = args.userId ? keys.filter((k) => k.userId === args.userId) : keys;
      return filtered.map(stripEncryptedFields);
    }

    if (args.userId) {
      const keys = await ctx.db
        .query("apiKeys")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
      return keys.map(stripEncryptedFields);
    }

    const allKeys = await ctx.db.query("apiKeys").collect();
    return allKeys.map(stripEncryptedFields);
  },
});

// Query: Get API key by ID (never returns encrypted fields)
export const get = query({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    return stripEncryptedFields(doc);
  },
});

// Query: Get active API key for provider (PUBLIC - does NOT return decrypted key)
// SECURITY: This is a public query — returns only safe metadata
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
      return stripEncryptedFields(userKey);
    }

    const firstKey = activeKeys[0];
    if (!firstKey) return null;
    return stripEncryptedFields(firstKey);
  },
});

// Internal Mutation: Insert a new API key record (called from apiKeyActions.create)
// Accepts pre-encrypted data — encryption is done in the Node.js action layer
export const _insertKey = internalMutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(),
    iv: v.string(),
    tag: v.string(),
    version: v.string(),
    isActive: v.boolean(),
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
      isActive: args.isActive,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

// Internal Mutation: Patch an existing API key record (called from apiKeyActions.update)
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
    // Remove undefined fields so patch only touches what changed
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
      throw new Error("API key not found");
    }
    await ctx.db.patch(args.id, { isActive: !key.isActive });
    return { success: true, isActive: !key.isActive };
  },
});

// Mutation: Update last used timestamp
export const updateLastUsed = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
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

// Internal Action: Get decrypted (raw) API key for a provider + optional userId
// Used by runtime processes that need the actual key value.
// SECURITY: internalAction — not exposed to clients
export const getDecryptedForProvider = internalAction({
  args: {
    provider: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const key = await ctx.runQuery(internal.apiKeys.getEncryptedKeyForProvider, {
      provider: args.provider,
      userId: args.userId,
    });

    if (!key) return null;

    return await ctx.runAction(internal.apiKeysCrypto.decryptApiKey, {
      ciphertext: key.encryptedKey,
      iv: key.iv,
      tag: key.tag,
    });
  },
});

// Internal Query: Get encrypted key record for provider (used by getDecryptedForProvider)
// Prefers the user-specific key when userId is provided; falls back to first active key.
export const getEncryptedKeyForProvider = internalQuery({
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

    const match = args.userId
      ? (activeKeys.find((k) => k.userId === args.userId) ?? activeKeys[0])
      : activeKeys[0];

    if (!match) return null;
    return {
      encryptedKey: match.encryptedKey,
      iv: match.iv,
      tag: match.tag,
    };
  },
});
