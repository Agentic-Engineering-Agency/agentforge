import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

// Query: List cron jobs
export const list = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.isEnabled !== undefined) {
      const jobs = await ctx.db
        .query("cronJobs")
        .withIndex("byIsEnabled", (q) => q.eq("isEnabled", args.isEnabled))
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
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
        .collect();
    }
    
    if (args.userId) {
      return await ctx.db
        .query("cronJobs")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId))
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
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // TODO: Parse cron expression to calculate nextRun
    // For now, set it to 1 hour from now
    const nextRun = now + 60 * 60 * 1000;
    
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
      (updates as any).nextRun = now + 60 * 60 * 1000; // TODO: Parse cron
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
      .withIndex("byCronJobId", (q) => q.eq("cronJobId", args.id))
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
    const now = Date.now();
    const runId = await ctx.db.insert("cronJobRuns", {
      cronJobId: args.cronJobId,
      status: args.status,
      startedAt: now,
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
      .withIndex("byCronJobId", (q) => q.eq("cronJobId", args.cronJobId))
      .collect();
    
    // Sort by startedAt descending
    runs.sort((a, b) => b.startedAt - a.startedAt);
    
    if (args.limit) {
      return runs.slice(0, args.limit);
    }
    
    return runs;
  },
});
