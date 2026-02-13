import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * FinForge Convex Schema
 *
 * This schema extends the base AgentForge schema with financial-specific
 * tables for tracking portfolios, watchlists, and market analysis.
 */
export default defineSchema({
  // --- Core AgentForge Tables ---
  agents: defineTable({
    agentId: v.string(),
    name: v.string(),
    instructions: v.string(),
    model: v.string(),
    status: v.union(v.literal('active'), v.literal('inactive'), v.literal('error')),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_agentId', ['agentId']),

  threads: defineTable({
    threadId: v.string(),
    agentId: v.string(),
    title: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('archived')),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_threadId', ['threadId'])
    .index('by_agentId', ['agentId']),

  messages: defineTable({
    messageId: v.string(),
    threadId: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant'), v.literal('system'), v.literal('tool')),
    content: v.string(),
    toolCalls: v.optional(v.any()),
    toolResults: v.optional(v.any()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index('by_threadId', ['threadId'])
    .index('by_messageId', ['messageId']),

  // --- FinForge-Specific Tables ---

  /**
   * Watchlists — Track stocks/assets the user is monitoring.
   */
  watchlists: defineTable({
    userId: v.string(),
    symbol: v.string(),
    name: v.string(),
    sector: v.optional(v.string()),
    addedAt: v.number(),
    notes: v.optional(v.string()),
  })
    .index('by_userId', ['userId'])
    .index('by_symbol', ['symbol']),

  /**
   * Market Analysis — Store AI-generated market analysis reports.
   */
  analyses: defineTable({
    analysisId: v.string(),
    agentId: v.string(),
    threadId: v.string(),
    symbol: v.string(),
    type: v.union(
      v.literal('fundamental'),
      v.literal('technical'),
      v.literal('sentiment'),
      v.literal('risk')
    ),
    summary: v.string(),
    data: v.any(),
    confidence: v.number(),
    createdAt: v.number(),
  })
    .index('by_symbol', ['symbol'])
    .index('by_type', ['type'])
    .index('by_agentId', ['agentId']),

  /**
   * Alerts — Price alerts and market event notifications.
   */
  alerts: defineTable({
    userId: v.string(),
    symbol: v.string(),
    condition: v.union(v.literal('above'), v.literal('below'), v.literal('change_pct')),
    targetValue: v.number(),
    triggered: v.boolean(),
    triggeredAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_symbol', ['symbol']),
});
