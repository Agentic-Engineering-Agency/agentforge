import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Research module — Data layer for research job tracking.
 *
 * Architecture compliance (CLAUDE.md Rule 5):
 * This file contains ONLY database operations (queries + mutations).
 * All LLM/Mastra orchestration runs in packages/runtime/ via the daemon.
 * The dashboard delegates research execution to the daemon's HTTP API
 * (POST /api/research) and uses these Convex functions only for
 * persisting and displaying job status.
 *
 * See also: packages/core/src/research/orchestrator.ts (ResearchOrchestrator)
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

// Mutation: Create a research job record
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
