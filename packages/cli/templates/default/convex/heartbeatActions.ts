"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Execute a single pending heartbeat task via Mastra.
 * Called by processCheck for each task string in heartbeat.pendingTasks.
 */
export const executeTask = internalAction({
  args: {
    agentId: v.string(),
    task: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; response?: string; error?: string }> => {
    // Load agent config for model/provider
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId as any });
    if (!agent) {
      return { success: false, error: `Agent ${args.agentId} not found` };
    }

    const provider = (agent as any).provider || "openai";
    const modelId = (agent as any).model || "gpt-4o-mini";

    try {
      // NOTE: LLM execution moved to runtime daemon (SPEC-020).
      // Store the task as a message; daemon processes it asynchronously.
      await ctx.runMutation(api.messages.create, {
        threadId: args.threadId as any,
        content: args.task,
        role: "user" as const,
      });

      return { success: true, response: "Message queued for daemon processing" };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  },
});
