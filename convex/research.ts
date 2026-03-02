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
    let query = ctx.db.query("researchJobs");

    if (args.status) {
      query = query.withIndex("byStatus", (q) => q.eq("status", args.status!));
    } else if (args.userId) {
      query = query.withIndex("byUserId", (q) => q.eq("userId", args.userId!));
    } else if (args.projectId) {
      query = query.withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!));
    } else {
      query = query.withIndex("byCreatedAt");
    }

    return await query.take(50); // Limit to most recent 50 jobs
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
 * NOTE: Temporarily disabled due to bundling issues with @agentforge-ai/core.
 * Re-enable once the ResearchOrchestrator is moved to a separate package or refactored.
 */
export const start = action({
  args: {
    topic: v.string(),
    depth: v.union(v.literal("shallow"), v.literal("medium"), v.literal("deep")),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    // Determine agent count based on depth
    const agentCount = args.depth === "shallow" ? 3 : args.depth === "medium" ? 5 : 10;

    // Create the research job
    const jobId = await ctx.runMutation(internal.research.createInternal, {
      topic: args.topic,
      depth: args.depth,
      agentCount,
      userId: args.userId,
      projectId: args.projectId,
    });

    // Update job with error
    await ctx.runMutation(internal.research.update, {
      jobId,
      status: "failed",
      error: "Research endpoint temporarily disabled. ResearchOrchestrator will be re-enabled in a future update.",
      completedAt: Date.now(),
    });

    throw new Error("Research endpoint temporarily disabled. ResearchOrchestrator will be re-enabled in a future update.");
  },
});

// Internal mutation: Create research job (called from action)
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
