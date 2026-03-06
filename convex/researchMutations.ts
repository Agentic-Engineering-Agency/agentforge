/**
 * Research module — Parallel multi-agent research orchestration.
 *
 * Queries and mutations run in default Convex runtime.
 * Actions are in researchActions.ts (with "use node").
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

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
      const status = args.status;
      result = await ctx.db
        .query("researchJobs")
        .withIndex("byStatus", (q) => q.eq("status", status))
        .take(50);
    } else if (args.userId) {
      result = await ctx.db
        .query("researchJobs")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .take(50);
    } else if (args.projectId) {
      result = await ctx.db
        .query("researchJobs")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .take(50);
    } else {
      result = await ctx.db
        .query("researchJobs")
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
export const update = internalMutation({
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

// Internal mutation: Create research job (called from action)
export const createInternal = internalMutation({
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
