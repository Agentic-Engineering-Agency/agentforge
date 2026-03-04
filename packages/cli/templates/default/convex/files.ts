import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { validateFileUpload } from "./lib/fileUpload";

// Query: List files
export const list = query({
  args: {
    folderId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.folderId) {
      return await ctx.db
        .query("files")
        .withIndex("byFolderId", (q) => q.eq("folderId", args.folderId!))
        .collect();
    }
    
    if (args.projectId) {
      return await ctx.db
        .query("files")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
    }
    
    if (args.userId) {
      return await ctx.db
        .query("files")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    
    return await ctx.db.query("files").collect();
  },
});

// Query: Get file by ID
export const get = query({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation: Create file metadata (file stored in Cloudflare R2)
export const create = mutation({
  args: {
    name: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    url: v.string(),
    folderId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const fileId = await ctx.db.insert("files", {
      ...args,
      uploadedAt: Date.now(),
    });
    return fileId;
  },
});

// Mutation: Update file metadata
export const update = mutation({
  args: {
    id: v.id("files"),
    name: v.optional(v.string()),
    folderId: v.optional(v.id("folders")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Mutation: Delete file
export const remove = mutation({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Mutation: Move file to folder
export const moveToFolder = mutation({
  args: {
    id: v.id("files"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      folderId: args.folderId,
    });
    return args.id;
  },
});

// Mutation: Generate an upload URL for Convex file storage
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Mutation: Confirm upload after file is stored in Convex storage
export const confirmUpload = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    folderId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const validation = validateFileUpload({ mimeType: args.mimeType, size: args.size });
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get storage URL");

    const fileId = await ctx.db.insert("files", {
      name: args.name,
      originalName: args.originalName,
      mimeType: args.mimeType,
      size: args.size,
      url,
      folderId: args.folderId,
      projectId: args.projectId,
      userId: args.userId,
      uploadedAt: Date.now(),
      metadata: args.metadata,
    });
    return fileId;
  },
});

// Query: Get download URL for a file
export const getDownloadUrl = query({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.id);
    if (!file) throw new Error("File not found");
    return { url: file.url, name: file.originalName, mimeType: file.mimeType };
  },
});
