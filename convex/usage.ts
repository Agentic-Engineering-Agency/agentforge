import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get usage records
export const list = query({
  args: {
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    agentId: v.optional(v.string()),
    provider: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let records;

    if (args.projectId) {
      records = await ctx.db
        .query("usage")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
    } else if (args.provider) {
      records = await ctx.db
        .query("usage")
        .withIndex("byProvider", (q) => q.eq("provider", args.provider!))
        .collect();
    } else if (args.agentId) {
      records = await ctx.db
        .query("usage")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else if (args.userId) {
      records = await ctx.db
        .query("usage")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      records = await ctx.db.query("usage").collect();
    }
    
    // Filter by time range if provided
    if (args.startTime) {
      records = records.filter((r) => r.timestamp >= args.startTime!);
    }
    if (args.endTime) {
      records = records.filter((r) => r.timestamp <= args.endTime!);
    }
    
    return records;
  },
});

// Query: Get usage statistics
export const getStats = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let records;
    
    if (args.agentId) {
      records = await ctx.db
        .query("usage")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else if (args.userId) {
      records = await ctx.db
        .query("usage")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      records = await ctx.db.query("usage").collect();
    }
    
    // Filter by time range
    if (args.startTime) {
      records = records.filter((r) => r.timestamp >= args.startTime!);
    }
    if (args.endTime) {
      records = records.filter((r) => r.timestamp <= args.endTime!);
    }
    
    // Calculate statistics
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalRequests = records.length;
    
    const byProvider: Record<string, { tokens: number; cost: number; requests: number }> = {};
    const byModel: Record<string, { tokens: number; cost: number; requests: number }> = {};
    
    for (const record of records) {
      // By provider
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = { tokens: 0, cost: 0, requests: 0 };
      }
      byProvider[record.provider].tokens += record.totalTokens;
      byProvider[record.provider].cost += record.cost || 0;
      byProvider[record.provider].requests += 1;
      
      // By model
      if (!byModel[record.model]) {
        byModel[record.model] = { tokens: 0, cost: 0, requests: 0 };
      }
      byModel[record.model].tokens += record.totalTokens;
      byModel[record.model].cost += record.cost || 0;
      byModel[record.model].requests += 1;
    }
    
    return {
      totalTokens,
      totalCost,
      totalRequests,
      byProvider,
      byModel,
    };
  },
});

// Query: Get usage by time period
export const getByTimePeriod = query({
  args: {
    userId: v.optional(v.string()),
    period: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let startTime: number;
    
    switch (args.period) {
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
    }
    
    let records;
    if (args.userId) {
      records = await ctx.db
        .query("usage")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      records = await ctx.db.query("usage").collect();
    }
    
    records = records.filter((r) => r.timestamp >= startTime);
    
    return records;
  },
});

// Mutation: Record usage
export const record = mutation({
  args: {
    agentId: v.string(),
    sessionId: v.optional(v.string()),
    provider: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.optional(v.number()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const usageId = await ctx.db.insert("usage", {
      ...args,
      timestamp: Date.now(),
    });
    return usageId;
  },
});

// Mutation: Delete old usage records
export const cleanup = mutation({
  args: {
    olderThan: v.number(), // Timestamp
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("usage")
      .withIndex("byTimestamp")
      .collect();
    
    const toDelete = records.filter((r) => r.timestamp < args.olderThan);
    
    for (const record of toDelete) {
      await ctx.db.delete(record._id);
    }
    
    return { deleted: toDelete.length };
  },
});
