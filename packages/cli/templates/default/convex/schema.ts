import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * AgentForge Database Schema
 *
 * This schema defines all the tables needed for your AgentForge project.
 * Customize it to fit your needs — add new tables, fields, or indexes.
 *
 * IMPORTANT: Index names cannot be "by_id" or "by_creation_time" (reserved by Convex).
 * Use camelCase names like "byAgentId", "byUserId", etc.
 */
export default defineSchema({
  // ─── Agent Definitions ───────────────────────────────────────────────
  agents: defineTable({
    id: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    instructions: v.string(),
    model: v.string(),
    provider: v.string(),
    tools: v.optional(v.any()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.optional(v.string()),
  })
    .index("byAgentId", ["id"])
    .index("byUserId", ["userId"])
    .index("byIsActive", ["isActive"]),

  // ─── Conversation Threads ────────────────────────────────────────────
  threads: defineTable({
    name: v.optional(v.string()),
    agentId: v.string(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    status: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byAgentId", ["agentId"])
    .index("byUserId", ["userId"])
    .index("byStatus", ["status"]),

  // ─── Messages ────────────────────────────────────────────────────────
  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    toolCalls: v.optional(v.any()),
    toolResults: v.optional(v.any()),
    tokenUsage: v.optional(v.any()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("byThreadId", ["threadId"])
    .index("byTimestamp", ["timestamp"]),

  // ─── Sessions ────────────────────────────────────────────────────────
  sessions: defineTable({
    name: v.string(),
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    status: v.string(),
    userId: v.optional(v.string()),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("byAgentId", ["agentId"])
    .index("byUserId", ["userId"])
    .index("byStatus", ["status"]),

  // ─── Files ───────────────────────────────────────────────────────────
  files: defineTable({
    name: v.string(),
    folderId: v.optional(v.string()),
    mimeType: v.string(),
    size: v.number(),
    storageId: v.optional(v.string()),
    url: v.optional(v.string()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("byFolderId", ["folderId"])
    .index("byUserId", ["userId"])
    .index("byProjectId", ["projectId"]),

  // ─── Folders ─────────────────────────────────────────────────────────
  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.string()),
    userId: v.optional(v.string()),
    projectId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("byParentId", ["parentId"])
    .index("byUserId", ["userId"]),

  // ─── Projects / Workspaces ───────────────────────────────────────────
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    userId: v.optional(v.string()),
    settings: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUserId", ["userId"])
    .index("byStatus", ["status"]),

  // ─── Skills ──────────────────────────────────────────────────────────
  skills: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    version: v.string(),
    isInstalled: v.boolean(),
    configuration: v.optional(v.any()),
    agentId: v.optional(v.string()),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byAgentId", ["agentId"])
    .index("byCategory", ["category"])
    .index("byIsInstalled", ["isInstalled"]),

  // ─── Cron Jobs ───────────────────────────────────────────────────────
  cronJobs: defineTable({
    name: v.string(),
    schedule: v.string(),
    agentId: v.string(),
    action: v.string(),
    isEnabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byAgentId", ["agentId"])
    .index("byIsEnabled", ["isEnabled"])
    .index("byUserId", ["userId"]),

  // ─── MCP Connections ─────────────────────────────────────────────────
  mcpConnections: defineTable({
    name: v.string(),
    type: v.string(),
    endpoint: v.string(),
    isConnected: v.boolean(),
    isEnabled: v.boolean(),
    credentials: v.optional(v.any()),
    capabilities: v.optional(v.any()),
    userId: v.optional(v.string()),
    lastConnectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUserId", ["userId"])
    .index("byIsEnabled", ["isEnabled"]),

  // ─── API Keys ────────────────────────────────────────────────────────
  apiKeys: defineTable({
    provider: v.string(),
    keyName: v.string(),
    encryptedKey: v.string(),
    isActive: v.boolean(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("byProvider", ["provider"])
    .index("byUserId", ["userId"])
    .index("byIsActive", ["isActive"]),

  // ─── Usage Tracking ──────────────────────────────────────────────────
  usage: defineTable({
    agentId: v.string(),
    sessionId: v.optional(v.string()),
    provider: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.optional(v.number()),
    userId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("byAgentId", ["agentId"])
    .index("byUserId", ["userId"])
    .index("byTimestamp", ["timestamp"])
    .index("byProvider", ["provider"]),

  // ─── Settings ────────────────────────────────────────────────────────
  settings: defineTable({
    userId: v.string(),
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index("byUserId", ["userId"])
    .index("byUserIdAndKey", ["userId", "key"]),

  // ─── System Logs ─────────────────────────────────────────────────────
  logs: defineTable({
    level: v.union(
      v.literal("debug"),
      v.literal("info"),
      v.literal("warn"),
      v.literal("error")
    ),
    source: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("byLevel", ["level"])
    .index("bySource", ["source"])
    .index("byTimestamp", ["timestamp"]),

  // ─── Heartbeat (Task Continuation) ───────────────────────────────────
  heartbeats: defineTable({
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    status: v.string(),
    currentTask: v.optional(v.string()),
    pendingTasks: v.array(v.string()),
    context: v.string(),
    lastCheck: v.number(),
    nextCheck: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("byAgentId", ["agentId"])
    .index("byStatus", ["status"])
    .index("byNextCheck", ["nextCheck"]),

  // ─── Secure Vault ────────────────────────────────────────────────────
  vault: defineTable({
    name: v.string(),
    category: v.string(),
    provider: v.optional(v.string()),
    encryptedValue: v.string(),
    iv: v.string(),
    maskedValue: v.string(),
    isActive: v.boolean(),
    expiresAt: v.optional(v.number()),
    lastAccessedAt: v.optional(v.number()),
    accessCount: v.number(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byUserId", ["userId"])
    .index("byCategory", ["category"])
    .index("byProvider", ["provider"])
    .index("byIsActive", ["isActive"]),
});
