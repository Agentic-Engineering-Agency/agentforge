import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Query: List projects
export const list = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("projects")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    
    return await ctx.db.query("projects").collect();
  },
});

// Query: Get project by ID
export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation: Create project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
    return projectId;
  },
});

// Mutation: Update project
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    settings: v.optional(v.any()),
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

// Mutation: Get or create the default project for a user
export const getOrCreateDefault = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("byUserId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("projects", {
      name: "Default",
      description: "Auto-created default project",
      userId: args.userId,
      isDefault: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    });
  },
});

const BATCH_SIZE = 64;

// Internal mutation: Delete one batch of project data and schedule continuation if needed
export const _deleteProjectCascade = internalMutation({
  args: {
    projectId: v.id("projects"),
    // Which phase of deletion we're in
    phase: v.union(
      v.literal("messages"),
      v.literal("threads"),
      v.literal("files"),
      v.literal("folders"),
      v.literal("project")
    ),
    // For the messages phase, the threadId being processed
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    if (args.phase === "messages" && args.threadId) {
      // Delete up to BATCH_SIZE messages for a thread
      const batch = await ctx.db
        .query("messages")
        .withIndex("byThread", (q) => q.eq("threadId", args.threadId!))
        .take(BATCH_SIZE);
      for (const msg of batch) {
        await ctx.db.delete(msg._id);
      }
      if (batch.length === BATCH_SIZE) {
        // More messages remain for this thread
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "messages",
          threadId: args.threadId,
        });
      } else {
        // Done with this thread's messages — delete the thread, then continue threads phase
        await ctx.db.delete(args.threadId!);
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "threads",
        });
      }
      return;
    }

    if (args.phase === "threads") {
      // Pick the next thread to process
      const thread = await ctx.db
        .query("threads")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId))
        .first();
      if (thread) {
        // Process its messages first
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "messages",
          threadId: thread._id,
        });
      } else {
        // No more threads — move to files
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "files",
        });
      }
      return;
    }

    if (args.phase === "files") {
      const batch = await ctx.db
        .query("files")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId))
        .take(BATCH_SIZE);
      for (const file of batch) {
        await ctx.db.delete(file._id);
      }
      if (batch.length === BATCH_SIZE) {
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "files",
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "folders",
        });
      }
      return;
    }

    if (args.phase === "folders") {
      const batch = await ctx.db
        .query("folders")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId))
        .take(BATCH_SIZE);
      for (const folder of batch) {
        await ctx.db.delete(folder._id);
      }
      if (batch.length === BATCH_SIZE) {
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "folders",
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
          projectId: args.projectId,
          phase: "project",
        });
      }
      return;
    }

    if (args.phase === "project") {
      await ctx.db.delete(args.projectId);
    }
  },
});

// Mutation: Delete project (kicks off batched cascade deletion)
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    // Schedule batched cascade deletion starting with threads/messages
    await ctx.scheduler.runAfter(0, internal.projects._deleteProjectCascade, {
      projectId: args.id,
      phase: "threads",
    });
    return { success: true };
  },
});
