import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getNextCronRun } from "./lib/cron";

// Query: List cron jobs
export const list = query({
  args: {
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    agentId: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      const jobs = await ctx.db
        .query("cronJobs")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();

      if (args.isEnabled !== undefined) {
        return jobs.filter((j) => j.isEnabled === args.isEnabled);
      }
      if (args.agentId) {
        return jobs.filter((j) => j.agentId === args.agentId);
      }
      return jobs;
    }

    if (args.isEnabled !== undefined) {
      const jobs = await ctx.db
        .query("cronJobs")
        .withIndex("byIsEnabled", (q) => q.eq("isEnabled", args.isEnabled!))
        .collect();

      if (args.userId) {
        return jobs.filter((j) => j.userId === args.userId);
      }
      if (args.agentId) {
        return jobs.filter((j) => j.agentId === args.agentId);
      }
      return jobs;
    }

    if (args.agentId) {
      return await ctx.db
        .query("cronJobs")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    }

    if (args.userId) {
      return await ctx.db
        .query("cronJobs")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }

    return await ctx.db.query("cronJobs").collect();
  },
});

// Query: Get cron job by ID
export const get = query({
  args: { id: v.id("cronJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: Get jobs due to run
export const getDueJobs = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const jobs = await ctx.db
      .query("cronJobs")
      .withIndex("byNextRun")
      .collect();
    
    return jobs.filter((j) => j.isEnabled && j.nextRun && j.nextRun <= now);
  },
});

// Mutation: Create cron job
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    schedule: v.string(),
    agentId: v.string(),
    prompt: v.string(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const nextRun = getNextCronRun(args.schedule, now);
    
    const jobId = await ctx.db.insert("cronJobs", {
      ...args,
      isEnabled: true,
      nextRun,
      createdAt: now,
      updatedAt: now,
    });
    return jobId;
  },
});

// Mutation: Update cron job
export const update = mutation({
  args: {
    id: v.id("cronJobs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    schedule: v.optional(v.string()),
    prompt: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    // If schedule changed, recalculate nextRun
    if (updates.schedule) {
      const now = Date.now();
      (updates as any).nextRun = getNextCronRun(updates.schedule, now);
    }
    
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Mutation: Toggle cron job enabled status
export const toggleEnabled = mutation({
  args: { id: v.id("cronJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    
    if (!job) {
      throw new Error(`Cron job not found`);
    }
    
    await ctx.db.patch(args.id, {
      isEnabled: !job.isEnabled,
      updatedAt: Date.now(),
    });
    
    return { success: true, isEnabled: !job.isEnabled };
  },
});

// Mutation: Update last run time
export const updateLastRun = mutation({
  args: {
    id: v.id("cronJobs"),
    nextRun: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastRun: Date.now(),
      nextRun: args.nextRun,
    });
    return args.id;
  },
});

// Mutation: Delete cron job
export const remove = mutation({
  args: { id: v.id("cronJobs") },
  handler: async (ctx, args) => {
    // Delete all run history
    const runs = await ctx.db
      .query("cronJobRuns")
      .withIndex("byCronJobId", (q) => q.eq("cronJobId", args.id!))
      .collect();
    
    for (const run of runs) {
      await ctx.db.delete(run._id);
    }
    
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Mutation: Record cron job run
export const recordRun = mutation({
  args: {
    cronJobId: v.id("cronJobs"),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("running")
    ),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the parent cron job to inherit projectId
    const cronJob = await ctx.db.get(args.cronJobId);
    if (!cronJob) {
      throw new Error(`Cron job not found`);
    }

    const now = Date.now();
    const runId = await ctx.db.insert("cronJobRuns", {
      cronJobId: args.cronJobId,
      status: args.status,
      startedAt: now,
      projectId: cronJob.projectId,
      ...(args.status !== "running" && { completedAt: now }),
      ...(args.output && { output: args.output }),
      ...(args.error && { error: args.error }),
    });
    return runId;
  },
});

// Query: Get run history for a cron job
export const getRunHistory = query({
  args: {
    cronJobId: v.id("cronJobs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("cronJobRuns")
      .withIndex("byCronJobId", (q) => q.eq("cronJobId", args.cronJobId!))
      .collect();

    // Sort by startedAt descending
    runs.sort((a, b) => b.startedAt - a.startedAt);

    if (args.limit) {
      return runs.slice(0, args.limit);
    }

    return runs;
  },
});

// ============================================================
// Internal Cron Execution Engine
// ============================================================

/**
 * Internal mutation: Execute all due cron jobs.
 * Called by the cron scheduler every minute.
 */
export const executeDueJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all jobs that are due to run
    const dueJobs = await ctx.runQuery(api.cronJobs.getDueJobs, {});

    if (dueJobs.length === 0) {
      return { executed: 0, jobs: [] };
    }

    const jobIds: string[] = [];

    // For each due job, schedule its execution
    for (const job of dueJobs) {
      try {
        // Create a run record
        const runId = await ctx.runMutation(api.cronJobs.recordRun, {
          cronJobId: job._id,
          status: "running",
        });

        jobIds.push(job._id);

        // Advance nextRun immediately to prevent double-scheduling on long jobs
        const nextRun = getNextCronRun(job.schedule, Date.now());
        await ctx.db.patch(job._id, { nextRun });

        // Schedule the actual job execution immediately
        ctx.scheduler.runAfter(0, internal.cronJobsActions.executeJob, {
          jobId: job._id,
          runId,
        });
      } catch (error) {
        console.error(`[cron.executeDueJobs] Failed to schedule job ${job._id}:`, error);
      }
    }

    return { executed: jobIds.length, jobs: jobIds };
  },
});

// Mutation: Update an existing run record status/output
export const updateRun = mutation({
  args: {
    runId: v.id("cronJobRuns"),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("running")),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.runId, {
      status: args.status,
      ...(args.status !== "running" && { completedAt: now }),
      ...(args.output !== undefined && { output: args.output }),
      ...(args.error !== undefined && { error: args.error }),
    });
  },
});

export const triggerNow = mutation({
  args: { id: v.id("cronJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Cron job not found");
    await ctx.db.patch(args.id, { lastRun: Date.now(), nextRun: Date.now() });
    return { success: true, jobId: args.id };
  },
});
