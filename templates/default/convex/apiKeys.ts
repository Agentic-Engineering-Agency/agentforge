import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

function getEncryptionSalt(): string {
  return process.env.AGENTFORGE_KEY_SALT ?? "agentforge-default-salt";
}

function encodeKey(value: string, salt: string): { encoded: string; iv: string } {
  const iv = Date.now().toString(36);
  const key = salt + iv;
  let encoded = "";
  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encoded += charCode.toString(16).padStart(4, "0");
  }
  return { encoded, iv };
}

function decodeKey(encoded: string, iv: string, salt: string): string {
  const key = salt + iv;
  let decoded = "";
  for (let i = 0; i < encoded.length; i += 4) {
    decoded += String.fromCharCode(
      parseInt(encoded.substring(i, i + 4), 16) ^ key.charCodeAt((i / 4) % key.length)
    );
  }
  return decoded;
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
        return keys.filter((k) => k.userId === args.userId);
      }
      return keys;
    }
    
    if (args.userId) {
      return await ctx.db
        .query("apiKeys")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    
    return await ctx.db.query("apiKeys").collect();
  },
});

// Query: Get API key by ID
export const get = query({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: Get active API key for provider (returns decrypted key)
export const getActiveForProvider = query({
  args: {
    provider: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("byProvider", (q) => q.eq("provider", args.provider!))
      .collect();

    const activeKeys = keys.filter((k) => k.isActive);

    if (args.userId) {
      const userKey = activeKeys.find((k) => k.userId === args.userId);
      if (!userKey) return null;

      const salt = getEncryptionSalt();
      const decryptedKey = userKey.iv
        ? decodeKey(userKey.encryptedKey, userKey.iv, salt)
        : userKey.encryptedKey;

      return {
        ...userKey,
        decryptedKey,
      };
    }

    const firstKey = activeKeys[0];
    if (!firstKey) return null;

    const salt = getEncryptionSalt();
    const decryptedKey = firstKey.iv
      ? decodeKey(firstKey.encryptedKey, firstKey.iv, salt)
      : firstKey.encryptedKey;

    return {
      ...firstKey,
      decryptedKey,
    };
  },
});

// Mutation: Create API key (encrypts before storing)
export const create = mutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const salt = getEncryptionSalt();
    const { encoded, iv } = encodeKey(args.encryptedKey, salt);

    const keyId = await ctx.db.insert("apiKeys", {
      provider: args.provider,
      keyName: args.keyName,
      encryptedKey: encoded,
      iv,
      isActive: true,
      userId: args.userId,
      createdAt: Date.now(),
    });
    return keyId;
  },
});

// Mutation: Update API key (encrypts if key is being updated)
export const update = mutation({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, encryptedKey, ...rest } = args;
    const updates: Record<string, unknown> = { ...rest };

    if (encryptedKey !== undefined) {
      const salt = getEncryptionSalt();
      const { encoded, iv } = encodeKey(encryptedKey, salt);
      updates.encryptedKey = encoded;
      updates.iv = iv;
    }

    await ctx.db.patch(id, updates);
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

// Internal Query: Get decrypted (raw) API key for a provider
// Used by mastraIntegration to pass the key to BYOK LLM provider factories.
// Decrypts using the same XOR+IV encoding as getActiveForProvider.
export const getDecryptedForProvider = internalQuery({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("byProvider", (q) => q.eq("provider", args.provider))
      .collect();
    const active = keys.find((k) => k.isActive);
    if (!active) return null;
    const salt = getEncryptionSalt();
    return active.iv
      ? decodeKey(active.encryptedKey, active.iv, salt)
      : active.encryptedKey;
  },
});
