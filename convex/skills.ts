import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: List skills
export const list = query({
  args: {
    userId: v.optional(v.string()),
    category: v.optional(v.string()),
    isInstalled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.category) {
      const skills = await ctx.db
        .query("skills")
        .withIndex("byCategory", (q) => q.eq("category", args.category))
        .collect();
      
      if (args.userId) {
        return skills.filter((s) => s.userId === args.userId);
      }
      if (args.isInstalled !== undefined) {
        return skills.filter((s) => s.isInstalled === args.isInstalled);
      }
      return skills;
    }
    
    if (args.isInstalled !== undefined) {
      const skills = await ctx.db
        .query("skills")
        .withIndex("byIsInstalled", (q) => q.eq("isInstalled", args.isInstalled))
        .collect();
      
      if (args.userId) {
        return skills.filter((s) => s.userId === args.userId);
      }
      return skills;
    }
    
    if (args.userId) {
      return await ctx.db
        .query("skills")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId))
        .collect();
    }
    
    return await ctx.db.query("skills").collect();
  },
});

// Query: Get skill by ID
export const get = query({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: Get installed skills
export const listInstalled = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("byIsInstalled", (q) => q.eq("isInstalled", true))
      .collect();
    
    if (args.userId) {
      return skills.filter((s) => s.userId === args.userId);
    }
    
    return skills;
  },
});

// Mutation: Create skill
export const create = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.string(),
    version: v.string(),
    author: v.optional(v.string()),
    repository: v.optional(v.string()),
    documentation: v.optional(v.string()),
    code: v.string(),
    schema: v.optional(v.any()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const skillId = await ctx.db.insert("skills", {
      ...args,
      isInstalled: false,
      isEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
    return skillId;
  },
});

// Mutation: Install skill
export const install = mutation({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isInstalled: true,
      isEnabled: true,
      installedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Mutation: Uninstall skill
export const uninstall = mutation({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isInstalled: false,
      isEnabled: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Mutation: Toggle skill enabled status
export const toggleEnabled = mutation({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.id);
    
    if (!skill) {
      throw new Error(`Skill not found`);
    }
    
    await ctx.db.patch(args.id, {
      isEnabled: !skill.isEnabled,
      updatedAt: Date.now(),
    });
    
    return { success: true, isEnabled: !skill.isEnabled };
  },
});

// Mutation: Update skill
export const update = mutation({
  args: {
    id: v.id("skills"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    version: v.optional(v.string()),
    code: v.optional(v.string()),
    schema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Mutation: Delete skill
export const remove = mutation({
  args: { id: v.id("skills") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
