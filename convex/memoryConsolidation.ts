/**
 * Memory Consolidation for AgentForge.
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
import { mutation, action, query, internalMutation, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { Agent } from "@mastra/core/agent";

const CONSOLIDATION_MODEL = "openrouter/openai/gpt-4o-mini";
const CONSOLIDATION_SYSTEM_PROMPT =
  "You are a memory consolidation assistant. Summarize the following conversation memories into a concise, factual summary. Preserve key information, decisions, and context. Output only the summary text — no preamble or meta-commentary.";

const MIN_MESSAGES_TO_CONSOLIDATE = 10;
const DEFAULT_SHORT_TERM_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch conversation memories for an agent older than a cutoff timestamp.
 * Used exclusively by the consolidate action.
 */
export const listConversationMemoriesForConsolidation = internalQuery({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
    createdBefore: v.number(),
  },
  handler: async (ctx, args) => {
    // Use take() with a reasonable limit instead of collect() to bound memory
    const entries = await ctx.db
      .query("memoryEntries")
      .withIndex("byAgentAndType", (q) =>
        q.eq("agentId", args.agentId).eq("type", "conversation")
      )
      .take(1000);

    return entries.filter(
      (e) =>
        e.createdAt < args.createdBefore &&
        (args.projectId === undefined || e.projectId === args.projectId)
    );
  },
});

/**
 * Delete a batch of memory entries by ID.
 * Used exclusively by the consolidate action after summarization.
 */
export const bulkRemoveMemories = internalMutation({
  args: {
    ids: v.array(v.id("memoryEntries")),
  },
  handler: async (ctx, args) => {
    await Promise.all(args.ids.map((id) => ctx.db.delete(id)));
    return { deleted: args.ids.length };
  },
});

/**
 * Insert a consolidation record into the memoryConsolidations table.
 */
export const insertConsolidationRecord = internalMutation({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
    sourceMemoryIds: v.array(v.id("memoryEntries")),
    resultMemoryId: v.id("memoryEntries"),
    strategy: v.union(
      v.literal("summarize"),
      v.literal("merge"),
      v.literal("deduplicate")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("memoryConsolidations", {
      agentId: args.agentId,
      projectId: args.projectId,
      sourceMemoryIds: args.sourceMemoryIds,
      resultMemoryId: args.resultMemoryId,
      strategy: args.strategy,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
      internal.memoryConsolidation.listConversationMemoriesForConsolidation,
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
      model: CONSOLIDATION_MODEL,
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
          {}
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
          internal.memoryConsolidation.insertConsolidationRecord,
          {
            agentId: args.agentId,
            projectId: args.projectId,
            sourceMemoryIds: sourceIds,
            resultMemoryId: summaryId,
            strategy: "summarize",
          }
        );

        // 7. Delete the original short-term memories
        await ctx.runMutation(internal.memoryConsolidation.bulkRemoveMemories, {
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

/**
 * Clean up expired memories for an agent.
 */
export const cleanupExpired = mutation({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args): Promise<{ deleted: number }> => {
    const now = Date.now();
    // Use take() instead of collect() to bound the query
    const entries = await ctx.db
      .query("memoryEntries")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .take(500);

    let deleted = 0;
    for (const memory of entries) {
      if (memory.expiresAt !== undefined && memory.expiresAt < now) {
        await ctx.db.delete(memory._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/**
 * Get consolidation history for an agent.
 */
export const getConsolidationHistory = query({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("memoryConsolidations")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("memoryConsolidations")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .collect();
  },
});
