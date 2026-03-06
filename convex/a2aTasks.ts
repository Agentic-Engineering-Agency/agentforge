import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createTask = mutation({
  args: {
    taskId: v.string(),
    fromAgentId: v.string(),
    toAgentId: v.string(),
    instruction: v.string(),
    context: v.optional(v.any()),
    constraints: v.optional(v.object({
      maxTokens: v.optional(v.number()),
      timeoutMs: v.optional(v.number()),
      maxCost: v.optional(v.number()),
    })),
    callbackUrl: v.optional(v.string()),
    projectId: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("a2aTasks", {
      taskId: args.taskId,
      fromAgentId: args.fromAgentId,
      toAgentId: args.toAgentId,
      instruction: args.instruction,
      context: args.context,
      constraints: args.constraints,
      status: "pending",
      callbackUrl: args.callbackUrl,
      createdAt: Date.now(),
    });
  },
});

export const getTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("a2aTasks")
      .withIndex("byTaskId", (q) => q.eq("taskId", args.taskId))
      .first();
  },
});

export const updateTask = mutation({
  args: {
    taskId: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
      v.literal("timeout")
    ),
    output: v.optional(v.string()),
    artifacts: v.optional(v.array(v.object({
      type: v.union(v.literal("text"), v.literal("code"), v.literal("file"), v.literal("data")),
      content: v.string(),
      mimeType: v.optional(v.string()),
      name: v.optional(v.string()),
    }))),
    usage: v.optional(v.object({
      inputTokens: v.number(),
      outputTokens: v.number(),
      cost: v.number(),
    })),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db
      .query("a2aTasks")
      .withIndex("byTaskId", (q) => q.eq("taskId", args.taskId))
      .first();
    if (!task) throw new Error(`A2A task not found: ${args.taskId}`);

    await ctx.db.patch(task._id, {
      status: args.status,
      output: args.output,
      artifacts: args.artifacts,
      usage: args.usage,
      durationMs: args.durationMs,
      completedAt: ["success", "error", "timeout"].includes(args.status) ? Date.now() : undefined,
    });
  },
});
