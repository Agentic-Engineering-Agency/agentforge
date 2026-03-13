import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";

// Query: List projects
export const list = query({
  args: {
    userId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    if (typeof args.userId === 'string' && args.userId) {
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

// Query: Get all available agents (for assignment UI)
export const getAllAgents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").collect();
  },
});

// Query: Get agents assigned to a project
export const getAgents = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project?.agentIds?.length) return [];

    const agents: Array<{ _id: string; id: string; name: string; [key: string]: unknown }> = [];
    for (const agentId of project.agentIds) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("byAgentId", (q) => q.eq("id", agentId))
        .first();
      if (agent) {
        agents.push(agent);
      }
    }
    return agents;
  },
});

// Mutation: Assign agent to project
export const assignAgent = mutation({
  args: { id: v.id("projects"), agentId: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) {
      throw new Error("Project not found");
    }

    const agentIds = [...new Set([...(project.agentIds ?? []), args.agentId])];
    await ctx.db.patch(args.id, {
      agentIds,
      updatedAt: Date.now(),
    });
  },
});

// Mutation: Unassign agent from project
export const unassignAgent = mutation({
  args: { id: v.id("projects"), agentId: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) {
      throw new Error("Project not found");
    }

    const agentIds = (project.agentIds ?? []).filter((id) => id !== args.agentId);
    await ctx.db.patch(args.id, {
      agentIds,
      updatedAt: Date.now(),
    });
  },
});

// Internal query: Get project settings (systemPrompt, defaultModel, defaultProvider)
// Uses internalQuery because it exposes system prompts and API configs
export const getProjectSettings = internalQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return null;
    // Return raw optional fields — let consumers apply defaults.
    // Coercing to "" would break config cascade (empty string looks like
    // an intentional override).
    return {
      systemPrompt: project.systemPrompt,
      defaultModel: project.defaultModel,
      defaultProvider: project.defaultProvider,
      settings: project.settings ?? {},
    };
  },
});

// Mutation: Update project settings
// Accepts both flat top-level fields AND a legacy `settings` object
// for backward compatibility with older dashboard payloads.
export const updateSettings = mutation({
  args: {
    id: v.id("projects"),
    systemPrompt: v.optional(v.string()),
    defaultModel: v.optional(v.string()),
    defaultProvider: v.optional(v.string()),
    settings: v.optional(
      v.object({
        systemPrompt: v.optional(v.string()),
        defaultModel: v.optional(v.string()),
        defaultProvider: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, settings: _legacySettings, ...flatSettings } = args;
    const project = await ctx.db.get(id);
    if (!project) {
      throw new Error("Project not found");
    }

    // Merge legacy settings object with flat fields (flat wins)
    const normalizedSettings = {
      ...(args.settings ?? {}),
      ...Object.fromEntries(
        Object.entries(flatSettings).filter(([, value]) => value !== undefined)
      ),
    };

    // Normalize empty strings to undefined so cascade falls through
    const cleaned: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(normalizedSettings)) {
      cleaned[key] = value || undefined;
    }

    // Only write if there are actual settings to update
    if (Object.keys(cleaned).length === 0) {
      return;
    }

    const nextSettings = {
      ...(project.settings ?? {}),
      ...cleaned,
    };

    await ctx.db.patch(id, {
      ...cleaned,
      settings: nextSettings,
      updatedAt: Date.now(),
    });
  },
});

// Mutation: Delete project
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    // Delete all threads in the project
    const threads = await ctx.db
      .query("threads")
      .withIndex("byProjectId", (q) => q.eq("projectId", args.id!))
      .collect();

    for (const thread of threads) {
      // Delete messages in thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("byThread", (q) => q.eq("threadId", thread._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      await ctx.db.delete(thread._id);
    }

    // Delete all files in the project
    const files = await ctx.db
      .query("files")
      .withIndex("byProjectId", (q) => q.eq("projectId", args.id!))
      .collect();

    for (const file of files) {
      await ctx.db.delete(file._id);
    }

    // Delete all folders in the project
    const folders = await ctx.db
      .query("folders")
      .withIndex("byProjectId", (q) => q.eq("projectId", args.id!))
      .collect();

    for (const folder of folders) {
      await ctx.db.delete(folder._id);
    }

    // Delete the project itself
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
