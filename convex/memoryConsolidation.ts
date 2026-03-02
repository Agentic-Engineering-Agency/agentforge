"use node";

/**
 * Memory Consolidation Action for AgentForge
 *
 * This module provides the core consolidation action that runs in Node.js
 * to perform LLM-based memory summarization.
 *
 * NOTE: Queries and mutations are in memoryConsolidationMutations.ts (non-Node runtime).
 * This file only contains the action that runs in Node.js runtime.
 *
 * Provides short-term → long-term memory consolidation by:
 * 1. Fetching conversation memories older than shortTermTTL
 * 2. Grouping them by thread
 * 3. Using an LLM to summarize groups of 10+ messages
 * 4. Storing the summary as a high-importance "summary" type memory
 * 5. Recording the consolidation in memoryConsolidations table
 * 6. Deleting the original short-term memories
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Agent } from "./lib/agent";

const CONSOLIDATION_MODEL = "openrouter/openai/gpt-4o-mini";
const CONSOLIDATION_SYSTEM_PROMPT =
  "You are a memory consolidation assistant. Summarize the following conversation memories into a concise, factual summary. Preserve key information, decisions, and context. Output only the summary text — no preamble or meta-commentary.";

const MIN_MESSAGES_TO_CONSOLIDATE = 10;
const DEFAULT_SHORT_TERM_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Consolidate old short-term memories into summaries.
 * Intended to be called periodically via a Convex cron job.
 */
export const consolidate = action({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
    shortTermTTL: v.optional(v.number()), // ms; defaults to 24h
  },
  handler: async (ctx, args): Promise<{ consolidated: number; summariesCreated: number }> => {
    const ttl = args.shortTermTTL ?? DEFAULT_SHORT_TERM_TTL;
    const cutoff = Date.now() - ttl;

    // 1. Fetch conversation-type memories older than shortTermTTL
    const allMemories = await ctx.runQuery(
      internal.memoryConsolidationMutations.listConversationMemoriesForConsolidation,
      {
        agentId: args.agentId,
        projectId: args.projectId,
        createdBefore: cutoff,
      }
    );

    if (allMemories.length < MIN_MESSAGES_TO_CONSOLIDATE) {
      return { consolidated: 0, summariesCreated: 0 };
    }

    // 2. Group by thread (memories without a thread go into a "global" bucket)
    const groups = new Map<string, typeof allMemories>();
    for (const memory of allMemories) {
      const key = memory.threadId ?? "__global__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(memory);
    }

    let totalConsolidated = 0;
    let summariesCreated = 0;

    // Create a single reusable LLM agent for consolidation
    const consolidationAgent = new Agent({
      name: "agentforge-consolidator",
      instructions: CONSOLIDATION_SYSTEM_PROMPT,
      model: {
        providerId: "openrouter",
        modelId: "openai/gpt-4o-mini",
        apiKey: "", // Will use default API key from context
      },
    });

    // 3. Process each group that has enough messages
    for (const [, groupMemories] of groups) {
      if (groupMemories.length < MIN_MESSAGES_TO_CONSOLIDATE) continue;

      // Build the text to summarize
      const memoryText = groupMemories
        .map((m) => m.content)
        .join("\n---\n");

      try {
        // 4. Use LLM to generate a summary
        const llmResult = await consolidationAgent.generate(
          [{ role: "user", content: memoryText }],
          {} as any
        );
        const summaryText = llmResult.text?.trim();
        if (!summaryText) continue;

        // 5. Store the summary as a "summary" type memory with high importance
        const summaryId = (await ctx.runMutation(api.memory.add, {
          content: summaryText,
          type: "summary",
          agentId: args.agentId,
          projectId: args.projectId,
          importance: 0.8,
          metadata: {
            consolidatedFrom: groupMemories.length,
            consolidatedAt: Date.now(),
          },
        })) as Id<"memoryEntries">;

        // 6. Record the consolidation
        const sourceIds = groupMemories.map((m) => m._id as Id<"memoryEntries">);
        await ctx.runMutation(
          internal.memoryConsolidationMutations.insertConsolidationRecord,
          {
            agentId: args.agentId,
            projectId: args.projectId,
            sourceMemoryIds: sourceIds,
            resultMemoryId: summaryId,
            strategy: "summarize",
          }
        );

        // 7. Delete the original short-term memories
        await ctx.runMutation(internal.memoryConsolidationMutations.bulkRemoveMemories, {
          ids: sourceIds,
        });

        totalConsolidated += groupMemories.length;
        summariesCreated++;
      } catch (error) {
        console.warn("[memoryConsolidation] Failed to consolidate group:", error);
        // Continue with other groups — don't let one failure block the rest
      }
    }

    return { consolidated: totalConsolidated, summariesCreated };
  },
});
