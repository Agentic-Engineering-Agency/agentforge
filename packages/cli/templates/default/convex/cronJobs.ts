import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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

    // Standard cron: when both dom and dow are restricted, treat as OR (POSIX)
    const domMatches = matchesField(domField, dom, 1, 31);
    const dowMatches = matchesField(dowField, dow, 0, 6);
    const domRestricted = domField !== "*";
    const dowRestricted = dowField !== "*";
    const dayMatches = (domRestricted && dowRestricted)
      ? (domMatches || dowMatches)
      : (domMatches && dowMatches);

    if (
      matchesField(minuteField, minute, 0, 59) &&
      matchesField(hourField, hour, 0, 23) &&
      dayMatches &&
      matchesField(monthField, month, 1, 12)
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
        ctx.scheduler.runAfter(0, internal.cronJobs.executeJob, {
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

/**
 * Internal action: Execute a single cron job.
 * This is where the actual agent execution happens.
 */
export const executeJob = internalAction({
  args: {
    jobId: v.id("cronJobs"),
    runId: v.id("cronJobRuns"),
  },
  handler: async (ctx, args) => {
    // Get the cron job definition
    const job = await ctx.runQuery(api.cronJobs.get, { id: args.jobId });
    if (!job) {
      throw new Error(`Cron job not found: ${args.jobId}`);
    }

    let output: string | undefined;
    let error: string | undefined;
    let status: "success" | "failed" = "success";

    try {
      // Import Agent class
      const { Agent: AgentClass } = await import("./lib/agent");
      const { getBaseModelId, getProviderBaseUrl } = await import("./lib/agent");

      // Get the agent configuration
      const agent = await ctx.runQuery(api.agents.get, { id: job.agentId });
      if (!agent) {
        throw new Error(`Agent not found: ${job.agentId}`);
      }

      // Get API key for the provider
      const apiKeyData = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, {
        provider: agent.provider || "openrouter",
      });

      if (!apiKeyData || !apiKeyData.apiKey) {
        throw new Error(`No API key found for provider: ${agent.provider}`);
      }

      // Create agent instance
      const mastraAgent = new AgentClass({
        id: job.agentId,
        name: agent.name,
        instructions: agent.instructions || "You are a helpful AI assistant.",
        model: {
          providerId: agent.provider || "openrouter",
          modelId: getBaseModelId(agent.provider || "openrouter", agent.model || "gpt-4o-mini"),
          apiKey: apiKeyData.apiKey,
          url: getProviderBaseUrl(agent.provider || "openrouter"),
        },
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
      });

      // Execute the agent with the cron job prompt
      let fullResponse = "";
      for await (const chunk of mastraAgent.stream(job.prompt || "Execute scheduled task.")) {
        fullResponse += chunk.content;
      }

      output = fullResponse;
      status = "success";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      status = "failed";
      console.error(`[cron.executeJob] Job ${args.jobId} failed:`, error);
    }

    // Update the existing run record (avoids creating a duplicate row)
    await ctx.runMutation(api.cronJobs.updateRun, {
      runId: args.runId,
      status,
      ...(output && { output }),
      ...(error && { error }),
    });

    // Calculate the next run time for this cron job
    const now = Date.now();
    const nextRun = getNextCronRun(job.schedule, now);

    await ctx.runMutation(api.cronJobs.updateLastRun, {
      id: args.jobId,
      nextRun,
    });

    return {
      success: status === "success",
      jobId: args.jobId,
      runId: args.runId,
      output,
      error,
    };
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
