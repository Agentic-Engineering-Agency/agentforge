import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Query: Get dashboard statistics for overview page
 * Returns total agents, active sessions, messages today, and total files
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    // Get total active agents
    const agents = await ctx.db
      .query("agents")
      .withIndex("byIsActive", (q) => q.eq("isActive", true))
      .collect();
    const totalAgents = agents.length;

    // Get active sessions (status = 'active' or 'paused')
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    const pausedSessions = await ctx.db
      .query("sessions")
      .withIndex("byStatus", (q) => q.eq("status", "paused"))
      .collect();
    const activeSessionCount = activeSessions.length + pausedSessions.length;

    // Get messages created today
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayStart = startOfDay.getTime();

    const allMessages = await ctx.db.query("messages").collect();
    const messagesToday = allMessages.filter((m) => m.createdAt >= todayStart).length;

    // Get total files
    const files = await ctx.db.query("files").collect();
    const totalFiles = files.length;

    return {
      totalAgents,
      activeSessions: activeSessionCount,
      messagesToday,
      totalFiles,
    };
  },
});

/**
 * Query: Get usage summary for the usage page
 * Returns token counts, costs, and agent statistics for a given date range
 */
export const getUsageSummary = query({
  args: {
    days: v.number(), // Number of days to look back (7, 30, or 90)
  },
  handler: async (ctx, args) => {
    const since = Date.now() - args.days * 24 * 60 * 60 * 1000;

    // Get usage events in the date range
    // Using the usageEvents table which has more detailed info
    const usageEvents = await ctx.db
      .query("usageEvents")
      .withIndex("byTimestamp")
      .filter((q) => q.gte(q.field("timestamp"), since))
      .collect();

    // Calculate totals
    const totalTokens = usageEvents.reduce(
      (sum, e) => sum + e.inputTokens + e.outputTokens,
      0
    );
    const totalCost = usageEvents.reduce((sum, e) => sum + e.costUsd, 0);
    const totalRequests = usageEvents.length;

    // Get unique agents that have usage in the date range
    const activeAgents = [...new Set(usageEvents.map((e) => e.agentId))].length;

    // Get per-model breakdown for charts
    const byModel: Record<
      string,
      { calls: number; inputTokens: number; outputTokens: number; totalCost: number }
    > = {};
    for (const event of usageEvents) {
      if (!byModel[event.model]) {
        byModel[event.model] = {
          calls: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
        };
      }
      byModel[event.model].calls += 1;
      byModel[event.model].inputTokens += event.inputTokens;
      byModel[event.model].outputTokens += event.outputTokens;
      byModel[event.model].totalCost += event.costUsd;
    }

    // Get per-agent breakdown for top agents list
    const byAgent: Record<
      string,
      { agentId: string; tokens: number; cost: number }
    > = {};
    for (const event of usageEvents) {
      if (!byAgent[event.agentId]) {
        byAgent[event.agentId] = {
          agentId: event.agentId,
          tokens: 0,
          cost: 0,
        };
      }
      byAgent[event.agentId].tokens += event.inputTokens + event.outputTokens;
      byAgent[event.agentId].cost += event.costUsd;
    }

    // Get agent names for display
    const agentNames: Record<string, string> = {};
    for (const agentId of Object.keys(byAgent)) {
      const agent = await ctx.db
        .query("agents")
        .withIndex("byAgentId", (q) => q.eq("id", agentId))
        .first();
      if (agent) {
        agentNames[agentId] = agent.name;
      }
    }

    return {
      totalTokens,
      totalCost,
      totalRequests,
      activeAgents,
      byModel,
      byAgent: Object.entries(byAgent).map(([agentId, data]) => ({
        agentId,
        agentName: agentNames[agentId] || agentId,
        tokens: data.tokens,
        cost: data.cost,
      })),
    };
  },
});
