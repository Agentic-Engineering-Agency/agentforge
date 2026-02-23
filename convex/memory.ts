import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

// Mutation: Add a new memory entry
export const add = mutation({
  args: {
    content: v.string(),
    type: v.union(
      v.literal("conversation"),
      v.literal("fact"),
      v.literal("summary"),
      v.literal("episodic")
    ),
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    embedding: v.optional(v.array(v.float64())),
    importance: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("memoryEntries", {
      content: args.content,
      type: args.type,
      agentId: args.agentId,
      threadId: args.threadId,
      projectId: args.projectId,
      userId: args.userId,
      embedding: args.embedding,
      importance: args.importance ?? 0.5,
      accessCount: 0,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Query: Get a single memory by its _id
export const get = query({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Query: List memories for an agent with pagination
export const listByAgent = query({
  args: {
    paginationOpts: paginationOptsValidator,
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
    type: v.optional(
      v.union(
        v.literal("conversation"),
        v.literal("fact"),
        v.literal("summary"),
        v.literal("episodic")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("memoryEntries")
        .withIndex("byAgentAndType", (q) =>
          q.eq("agentId", args.agentId).eq("type", args.type!)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    if (args.projectId) {
      return await ctx.db
        .query("memoryEntries")
        .withIndex("byAgentAndProject", (q) =>
          q.eq("agentId", args.agentId).eq("projectId", args.projectId!)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("memoryEntries")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Query: List memories for a thread with pagination
export const listByThread = query({
  args: {
    paginationOpts: paginationOptsValidator,
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memoryEntries")
      .withIndex("byThreadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Mutation: Update a memory entry
export const update = mutation({
  args: {
    id: v.id("memoryEntries"),
    content: v.optional(v.string()),
    importance: v.optional(v.number()),
    metadata: v.optional(v.any()),
    embedding: v.optional(v.array(v.float64())),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (fields.content !== undefined) updates.content = fields.content;
    if (fields.importance !== undefined) updates.importance = fields.importance;
    if (fields.metadata !== undefined) updates.metadata = fields.metadata;
    if (fields.embedding !== undefined) updates.embedding = fields.embedding;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Mutation: Delete a memory entry
export const remove = mutation({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Mutation: Increment accessCount and update lastAccessedAt
export const recordAccess = mutation({
  args: { id: v.id("memoryEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error(`Memory entry ${args.id} not found`);
    }
    await ctx.db.patch(args.id, {
      accessCount: entry.accessCount + 1,
      lastAccessedAt: Date.now(),
    });
    return { success: true };
  },
});

// Mutation: Add multiple memories at once
export const bulkAdd = mutation({
  args: {
    entries: v.array(
      v.object({
        content: v.string(),
        type: v.union(
          v.literal("conversation"),
          v.literal("fact"),
          v.literal("summary"),
          v.literal("episodic")
        ),
        agentId: v.string(),
        threadId: v.optional(v.id("threads")),
        projectId: v.optional(v.id("projects")),
        userId: v.optional(v.string()),
        embedding: v.optional(v.array(v.float64())),
        importance: v.optional(v.number()),
        metadata: v.optional(v.any()),
        expiresAt: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids = await Promise.all(
      args.entries.map((entry) =>
        ctx.db.insert("memoryEntries", {
          content: entry.content,
          type: entry.type,
          agentId: entry.agentId,
          threadId: entry.threadId,
          projectId: entry.projectId,
          userId: entry.userId,
          embedding: entry.embedding,
          importance: entry.importance ?? 0.5,
          accessCount: 0,
          metadata: entry.metadata,
          expiresAt: entry.expiresAt,
          createdAt: now,
          updatedAt: now,
        })
      )
    );
    return ids;
  },
});

// Mutation: Delete memories past their expiresAt (batched to avoid unbounded collect)
export const deleteExpired = mutation({
  args: {
    agentId: v.string(),
    now: v.number(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.batchSize ?? 100;
    const entries = await ctx.db
      .query("memoryEntries")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .take(limit * 5); // over-fetch since we filter client-side

    const expired = entries.filter(
      (e) => e.expiresAt !== undefined && e.expiresAt < args.now
    );

    const toDelete = expired.slice(0, limit);
    await Promise.all(toDelete.map((e) => ctx.db.delete(e._id)));
    return { deleted: toDelete.length, hasMore: expired.length > limit };
  },
});

// Query: List recent memories for an agent (used by text search)
export const listRecent = query({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 500;

    if (args.projectId) {
      return await ctx.db
        .query("memoryEntries")
        .withIndex("byAgentAndProject", (q) =>
          q.eq("agentId", args.agentId).eq("projectId", args.projectId!)
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("memoryEntries")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
  },
});

// Query: Get memory statistics for an agent
export const getStats = query({
  args: {
    agentId: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    let entries;
    if (args.projectId) {
      entries = await ctx.db
        .query("memoryEntries")
        .withIndex("byAgentAndProject", (q) =>
          q.eq("agentId", args.agentId).eq("projectId", args.projectId!)
        )
        .collect();
    } else {
      entries = await ctx.db
        .query("memoryEntries")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
        .collect();
    }

    const countByType: Record<string, number> = {
      conversation: 0,
      fact: 0,
      summary: 0,
      episodic: 0,
    };

    let totalImportance = 0;
    for (const entry of entries) {
      countByType[entry.type] = (countByType[entry.type] ?? 0) + 1;
      totalImportance += entry.importance;
    }

    return {
      total: entries.length,
      countByType,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
    };
  },
});
