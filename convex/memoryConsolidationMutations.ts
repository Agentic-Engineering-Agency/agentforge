/**
 * Memory Consolidation Mutations for AgentForge
 *
 * These functions run in the default Convex runtime (not Node.js).
 * They handle database operations for memory consolidation.
 */
import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// ---------------------------------------------------------------------------
// Internal helpers (used by consolidate action)
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
        .take(100);
    }

    return await ctx.db
      .query("memoryConsolidations")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(100);
  },
});
