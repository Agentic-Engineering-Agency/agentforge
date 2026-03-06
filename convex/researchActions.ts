"use node";

/**
 * Research Actions for AgentForge
 *
 * This file contains only actions that run in Node.js runtime.
 * Queries and mutations are in researchMutations.ts.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ResearchOrchestrator } from "./lib/research";
import { getProviderBaseUrl } from "./lib/agent";

/**
 * Action: Start a research job using ResearchOrchestrator.
 *
 * Uses the local ResearchOrchestrator implementation.
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
    const jobId = await ctx.runMutation(internal.researchMutations.createInternal, {
      topic: args.topic,
      depth: args.depth,
      agentCount,
      userId: args.userId,
      projectId: args.projectId,
    });

    // Update status to running
    await ctx.runMutation(internal.researchMutations.update, {
      jobId,
      status: "running",
    });

    try {
      // Get default agent config from API keys
      const apiKeyData = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, {
        provider: "openrouter",
      });

      if (!apiKeyData) {
        throw new Error("No API key found for provider: openrouter");
      }

      // Create orchestrator and run research
      const orchestrator = new ResearchOrchestrator({
        topic: args.topic,
        depth: args.depth,
      });

      const report = await orchestrator.run({
        providerId: "openrouter",
        modelId: "openai/gpt-4o-mini",
        apiKey: apiKeyData,
        url: getProviderBaseUrl("openrouter"),
      });

      // Map findings to the expected schema
      const findings = report.findings.map((f, i) => ({
        questionId: `q-${i}`,
        question: f.question,
        answer: f.answer,
      }));

      // Update job with results
      await ctx.runMutation(internal.researchMutations.update, {
        jobId,
        status: "completed",
        results: JSON.stringify(report.findings, null, 2),
        synthesis: report.synthesis,
        findings,
        completedAt: Date.now(),
      });

      return { success: true, jobId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update job with error
      await ctx.runMutation(internal.researchMutations.update, {
        jobId,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      });

      throw error;
    }
  },
});
