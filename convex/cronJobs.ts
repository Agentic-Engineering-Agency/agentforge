import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";

/**
 * Parse a cron expression and return the next run timestamp (ms) after `fromMs`.
 *
 * Supports standard 5-field cron: minute hour dom month dow
 *   - `*`    — any value
 *   - `*\/N`  — every N units (step)
 *   - `N`    — exact value
 *   - `N-M`  — range
 *
 * Returns `fromMs + 60_000` (1 minute) as a safe fallback for unsupported expressions.
 */
function getNextCronRun(cronExpression: string, fromMs: number): number {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    // Unsupported format — fall back to 1 hour
    return fromMs + 60 * 60 * 1000;
  }

  const [minuteField, hourField, domField, monthField, dowField] = fields;

  function matchesField(field: string, value: number, min: number, max: number): boolean {
    if (field === "*") return true;
    if (field.startsWith("*/")) {
      const step = parseInt(field.slice(2), 10);
      return !isNaN(step) && step > 0 && (value - min) % step === 0;
    }
    if (field.includes("-")) {
      const [lo, hi] = field.split("-").map(Number);
      return !isNaN(lo) && !isNaN(hi) && value >= lo && value <= hi;
    }
    const num = parseInt(field, 10);
    return !isNaN(num) && value === num;
  }

  // Advance by 1 minute from now and search up to 1 year ahead
  const MS_PER_MIN = 60 * 1000;
  const MAX_MINUTES = 366 * 24 * 60; // ~1 year in minutes

  // Start searching from the next whole minute
  let candidate = new Date(Math.ceil((fromMs + 1) / MS_PER_MIN) * MS_PER_MIN);

  for (let i = 0; i < MAX_MINUTES; i++) {
    const minute = candidate.getUTCMinutes();
    const hour = candidate.getUTCHours();
    const dom = candidate.getUTCDate();
    const month = candidate.getUTCMonth() + 1; // 1-12
    const dow = candidate.getUTCDay(); // 0=Sunday

    if (
      matchesField(minuteField, minute, 0, 59) &&
      matchesField(hourField, hour, 0, 23) &&
      matchesField(domField, dom, 1, 31) &&
      matchesField(monthField, month, 1, 12) &&
      matchesField(dowField, dow, 0, 6)
    ) {
      return candidate.getTime();
    }

    candidate = new Date(candidate.getTime() + MS_PER_MIN);
  }

  // Fallback: 1 hour from now
  return fromMs + 60 * 60 * 1000;
}

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
