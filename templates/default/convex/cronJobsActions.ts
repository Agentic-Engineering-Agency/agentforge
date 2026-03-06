"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getNextCronRun } from "./lib/cron";

/**
 * Internal action: Execute a single cron job.
 * Runs in Node.js runtime so it can import lib/agent (also "use node").
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
      // Import Agent class (also "use node" — safe from this Node.js action)
      const { Agent: AgentClass, getBaseModelId, getProviderBaseUrl } = await import("./lib/agent");

      // Get the agent configuration
      const agent = await ctx.runQuery(api.agents.get, { id: job.agentId });
      if (!agent) {
        throw new Error(`Agent not found: ${job.agentId}`);
      }

      // Get API key for the provider (internalAction — must use ctx.runAction, not ctx.runQuery)
      const apiKeyData = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, {
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

    // Update the existing run record
    await ctx.runMutation(api.cronJobs.updateRun, {
      runId: args.runId,
      status,
      ...(output && { output }),
      ...(error && { error }),
    });

    // Calculate the next run time for this cron job and update the job
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
