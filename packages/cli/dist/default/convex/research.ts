import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Research module — Parallel multi-agent research orchestration.
 *
 * Integrates with packages/core/src/research/orchestrator.ts (ResearchOrchestrator).
 */

// Query: Get research job by ID
export const get = query({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Query: List research jobs
export const list = query({
  args: {
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    let result;

    if (args.status) {
      result = await ctx.db.query("researchJobs")
        .withIndex("byStatus", (q) => q.eq("status", args.status!))
        .take(50);
    } else if (args.userId) {
      result = await ctx.db.query("researchJobs")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .take(50);
    } else if (args.projectId) {
      result = await ctx.db.query("researchJobs")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .take(50);
    } else {
      result = await ctx.db.query("researchJobs")
        .withIndex("byCreatedAt")
        .take(50);
    }

    return result;
  },
});

// Mutation: Create a research job
export const create = mutation({
  args: {
    topic: v.string(),
    depth: v.union(v.literal("shallow"), v.literal("medium"), v.literal("deep")),
    agentCount: v.number(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("researchJobs", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
    return jobId;
  },
});

// Mutation: Update research job status and results
export const update = mutation({
  args: {
    jobId: v.id("researchJobs"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    results: v.optional(v.string()),
    synthesis: v.optional(v.string()),
    questions: v.optional(
      v.array(
        v.object({
          id: v.string(),
          question: v.string(),
          status: v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("completed"),
            v.literal("failed")
          ),
        })
      )
    ),
    findings: v.optional(
      v.array(
        v.object({
          questionId: v.string(),
          question: v.string(),
          answer: v.string(),
        })
      )
    ),
    error: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { jobId, ...updates } = args;
    await ctx.db.patch(jobId, updates);
    return jobId;
  },
});

/**
 * Action: Start a research job using ResearchOrchestrator.
 *
 * This action runs in Node.js environment to support ResearchOrchestrator.
 */
export const start = action({
  args: {
    topic: v.string(),
    depth: v.union(v.literal("shallow"), v.literal("medium"), v.literal("deep")),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const agentCount = args.depth === "shallow" ? 3 : args.depth === "medium" ? 5 : 10;

    const jobId = await ctx.runMutation(internal.research.create, {
      topic: args.topic,
      depth: args.depth,
      agentCount,
      userId: args.userId,
      projectId: args.projectId,
    });

    await ctx.runMutation(internal.research.update, {
      jobId,
      status: "running",
    });

    try {
      // Research orchestration — extend this to plug in ResearchOrchestrator
      // from @agentforge-ai/core or your own implementation.
      throw new Error("Research orchestration not yet configured. Extend this action to integrate your orchestrator.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.research.update, {
        jobId,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      });
      throw error;
    }
  },
});

export const createInternal = mutation({
  args: {
    topic: v.string(),
    depth: v.union(v.literal("shallow"), v.literal("medium"), v.literal("deep")),
    agentCount: v.number(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("researchJobs", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    });
    return jobId;
  },
});
