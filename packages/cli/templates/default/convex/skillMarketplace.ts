import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Public query — list skills with optional filters
export const listSkills = query({
  args: {
    category: v.optional(v.string()),
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // If query provided, use search index
    if (args.query) {
      let searchQuery = ctx.db
        .query("skillMarketplace")
        .withSearchIndex("search_skills", (q) => {
          let sq = q.search("description", args.query!);
          if (args.category) {
            sq = sq.eq("category", args.category);
          }
          return sq;
        });
      return await searchQuery.take(50);
    }
    // If category filter only
    if (args.category) {
      return await ctx.db
        .query("skillMarketplace")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .take(100);
    }
    // No filter — return all (with bound)
    return await ctx.db.query("skillMarketplace").order("desc").take(100);
  },
});

// Get a single skill by name
export const getSkill = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("skillMarketplace")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    return results;
  },
});

// Publish or update a skill
export const publishSkill = mutation({
  args: {
    name: v.string(),
    version: v.string(),
    description: v.string(),
    author: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
    skillMdContent: v.string(),
    readmeContent: v.optional(v.string()),
    repositoryUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Check if skill already exists
    const existing = await ctx.db
      .query("skillMarketplace")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("skillMarketplace", {
      ...args,
      downloads: 0,
      featured: false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Increment download count
export const incrementDownloads = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query("skillMarketplace")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!skill) throw new Error(`Skill not found: ${args.name}`);
    await ctx.db.patch(skill._id, { downloads: skill.downloads + 1 });
    return { success: true };
  },
});

// Get featured skills
export const getFeaturedSkills = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("skillMarketplace").take(500);
    return all.filter((s) => s.featured);
  },
});

// Install a skill (adds to the skills table for the workspace)
export const install = mutation({
  args: {
    skillName: v.string(),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the skill from marketplace
    const marketplaceSkill = await ctx.db
      .query("skillMarketplace")
      .withIndex("by_name", (q) => q.eq("name", args.skillName))
      .first();

    if (!marketplaceSkill) {
      throw new Error(`Skill not found in marketplace: ${args.skillName}`);
    }

    // Check if already installed
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.skillName))
      .first();

    if (existing) {
      // Already installed, just update
      await ctx.db.patch(existing._id, {
        version: args.version || marketplaceSkill.version,
        updatedAt: Date.now(),
      });
      return { success: true, skillId: existing._id };
    }

    // Install the skill
    const skillId = await ctx.db.insert("skills", {
      name: marketplaceSkill.name,
      version: args.version || marketplaceSkill.version,
      description: marketplaceSkill.description,
      author: marketplaceSkill.author,
      category: marketplaceSkill.category,
      tags: marketplaceSkill.tags,
      repositoryUrl: marketplaceSkill.repositoryUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Increment download count
    await ctx.db.patch(marketplaceSkill._id, {
      downloads: marketplaceSkill.downloads + 1,
    });

    return { success: true, skillId };
  },
});
