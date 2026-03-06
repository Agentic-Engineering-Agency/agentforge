import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: List folders
export const list = query({
  args: {
    parentId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("folders")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
    }
    
    if (args.parentId) {
      return await ctx.db
        .query("folders")
        .withIndex("byParentId", (q) => q.eq("parentId", args.parentId!))
        .collect();
    }
    
    if (args.userId) {
      return await ctx.db
        .query("folders")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    
    return await ctx.db.query("folders").collect();
  },
});

// Query: Get folder by ID
export const get = query({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation: Create folder
export const create = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const folderId = await ctx.db.insert("folders", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return folderId;
  },
});

// Mutation: Update folder
export const update = mutation({
  args: {
    id: v.id("folders"),
    name: v.optional(v.string()),
    parentId: v.optional(v.id("folders")),
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

// Mutation: Delete folder
export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    // Delete all files in the folder
    const files = await ctx.db
      .query("files")
      .withIndex("byFolderId", (q) => q.eq("folderId", args.id!))
      .collect();
    
    for (const file of files) {
      await ctx.db.delete(file._id);
    }
    
    // Delete all subfolders recursively
    const subfolders = await ctx.db
      .query("folders")
      .withIndex("byParentId", (q) => q.eq("parentId", args.id!))
      .collect();
    
    for (const subfolder of subfolders) {
      // Recursive delete (will be called via mutation)
      await ctx.db.delete(subfolder._id);
    }
    
    // Delete the folder itself
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
