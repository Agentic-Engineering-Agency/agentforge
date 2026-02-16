import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
        .withIndex("byProvider", (q) => q.eq("provider", args.provider))
        .collect();
      
      if (args.userId) {
        return keys.filter((k) => k.userId === args.userId);
      }
      return keys;
    }
    
    if (args.userId) {
      return await ctx.db
        .query("apiKeys")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId))
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

// Query: Get active API key for provider
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
      return activeKeys.find((k) => k.userId === args.userId);
    }
    
    return activeKeys[0];
  },
});

// Mutation: Create API key
export const create = mutation({
  args: {
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const keyId = await ctx.db.insert("apiKeys", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });
    return keyId;
  },
});

// Mutation: Update API key
export const update = mutation({
  args: {
    id: v.id("apiKeys"),
    keyName: v.optional(v.string()),
    encryptedKey: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
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
