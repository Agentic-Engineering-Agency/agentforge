import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: List workflow definitions
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      const workflows = await ctx.db
        .query("workflowDefinitions")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();

      if (args.isActive !== undefined) {
        return workflows.filter((w) => w.isActive === args.isActive);
      }
      return workflows;
    }

    if (args.isActive !== undefined) {
      const workflows = await ctx.db
        .query("workflowDefinitions")
        .withIndex("byIsActive", (q) => q.eq("isActive", args.isActive!))
        .collect();

      if (args.userId) {
        return workflows.filter((w) => w.userId === args.userId);
      }
      return workflows;
    }

    if (args.userId) {
      return await ctx.db
        .query("workflowDefinitions")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }

    return await ctx.db.query("workflowDefinitions").collect();
  },
});

// Query: Get a single workflow definition by Convex _id
export const get = query({
  args: { id: v.id("workflowDefinitions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: Get a workflow run by Convex _id
export const getRun = query({
  args: { id: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: List runs for a workflow
export const listRuns = query({
  args: {
    workflowId: v.optional(v.id("workflowDefinitions")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("suspended"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (args.workflowId) {
      const runs = await ctx.db
        .query("workflowRuns")
        .withIndex("byWorkflowId", (q) => q.eq("workflowId", args.workflowId!))
        .collect();

      if (args.status !== undefined) {
        return runs.filter((r) => r.status === args.status);
      }
      return runs;
    }

    if (args.status !== undefined) {
      const runs = await ctx.db
        .query("workflowRuns")
        .withIndex("byStatus", (q) => q.eq("status", args.status!))
        .collect();

      if (args.projectId) {
        return runs.filter((r) => r.projectId === args.projectId);
      }
      return runs;
    }

    if (args.projectId) {
      return await ctx.db
        .query("workflowRuns")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
    }

    return await ctx.db.query("workflowRuns").collect();
  },
});

// Query: Get all steps for a run
export const getRunSteps = query({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workflowSteps")
      .withIndex("byRunId", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

// Mutation: Create a new workflow definition
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    steps: v.string(),
    triggers: v.optional(v.string()),
    inputSchema: v.optional(v.string()),
    outputSchema: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const workflowId = await ctx.db.insert("workflowDefinitions", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return workflowId;
  },
});

// Mutation: Update a workflow definition
export const update = mutation({
  args: {
    id: v.id("workflowDefinitions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    steps: v.optional(v.string()),
    triggers: v.optional(v.string()),
    inputSchema: v.optional(v.string()),
    outputSchema: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const workflow = await ctx.db.get(id);

    if (!workflow) {
      throw new Error(`Workflow definition not found`);
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Mutation: Delete a workflow definition
export const remove = mutation({
  args: { id: v.id("workflowDefinitions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Mutation: Create a new workflow run
export const createRun = mutation({
  args: {
    workflowId: v.id("workflowDefinitions"),
    input: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("workflowRuns", {
      ...args,
      status: "pending",
      currentStepIndex: 0,
      startedAt: Date.now(),
    });
    return runId;
  },
});

// Mutation: Update a workflow run
export const updateRun = mutation({
  args: {
    id: v.id("workflowRuns"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("suspended"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    currentStepIndex: v.optional(v.number()),
    suspendedAt: v.optional(v.string()),
    suspendPayload: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const run = await ctx.db.get(id);

    if (!run) {
      throw new Error(`Workflow run not found`);
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

// Mutation: Create a workflow step record
export const createStep = mutation({
  args: {
    runId: v.id("workflowRuns"),
    stepId: v.string(),
    name: v.string(),
    input: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const stepRecordId = await ctx.db.insert("workflowSteps", {
      ...args,
      status: "pending",
    });
    return stepRecordId;
  },
});

// Mutation: Update a workflow step
export const updateStep = mutation({
  args: {
    id: v.id("workflowSteps"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("skipped"),
        v.literal("suspended")
      )
    ),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const step = await ctx.db.get(id);

    if (!step) {
      throw new Error(`Workflow step not found`);
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});
