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

    // Update status to running
    await ctx.runMutation(internal.research.update, {
      jobId,
      status: "running",
    });

    try {
      // Import ResearchOrchestrator from packages/core
      const { ResearchOrchestrator } = await import("@agentforge-ai/core");

      // Get default agent config from API keys
      const apiKeyData = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, {
        provider: "openrouter",
      });

      if (!apiKeyData || !apiKeyData.apiKey) {
        throw new Error("No API key found for provider: openrouter");
      }

      const { getProviderBaseUrl } = await import("./lib/apiKeys");

      // Create orchestrator and run research
      const orchestrator = new ResearchOrchestrator({
        topic: args.topic,
        depth: args.depth,
      });

      const report = await orchestrator.run({
        providerId: "openrouter",
        modelId: "gpt-4o-mini",
        apiKey: apiKeyData.apiKey,
        url: getProviderBaseUrl("openrouter"),
      });

      // Update job with results
      await ctx.runMutation(internal.research.update, {
        jobId,
        status: "completed",
        results: JSON.stringify(report.findings, null, 2),
        synthesis: report.synthesis,
        questions: report.questions,
        findings: report.findings,
        completedAt: Date.now(),
      });

      return { success: true, jobId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update job with error
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
