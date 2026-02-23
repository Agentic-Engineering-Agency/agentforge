import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Core agent definitions
  agents: defineTable({
    id: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    instructions: v.string(),
    model: v.string(),
    provider: v.string(), // "openai", "openrouter", "anthropic", "google", "venice", "custom"
    tools: v.optional(v.any()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    userId: v.optional(v.string()),
    // Model failover configuration (per-agent)
    failoverModels: v.optional(
      v.array(
        v.object({
          provider: v.string(),
          model: v.string(),
        })
      )
    ),
    projectId: v.optional(v.id("projects")),
  })
    .index("byAgentId", ["id"])
    .index("byUserId", ["userId"])
    .index("byIsActive", ["isActive"])
    .index("byProjectId", ["projectId"])
    .index("byProjectAndActive", ["projectId", "isActive"]),

  // Conversation threads
  threads: defineTable({
    name: v.optional(v.string()),
    agentId: v.string(),
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byAgentId", ["agentId"])
    .index("byUserId", ["userId"])
    .index("byProjectId", ["projectId"]),

  // Messages in threads
  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    tool_calls: v.optional(v.any()),
    tool_results: v.optional(v.any()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  }).index("byThread", ["threadId"]),

  // Active sessions
  sessions: defineTable({
    sessionId: v.string(),
    threadId: v.id("threads"),
    agentId: v.string(),
    userId: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("error")
    ),
    channel: v.optional(v.string()), // "dashboard", "api", "webhook", etc.
    metadata: v.optional(v.any()),
    startedAt: v.number(),
    lastActivityAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("bySessionId", ["sessionId"])
    .index("byThreadId", ["threadId"])
    .index("byAgentId", ["agentId"])
    .index("byStatus", ["status"])
    .index("byUserId", ["userId"]),

  // File storage metadata (files stored in Cloudflare R2)
  files: defineTable({
    name: v.string(),
    originalName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    url: v.string(), // Cloudflare R2 URL
    folderId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    uploadedAt: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("byFolderId", ["folderId"])
    .index("byProjectId", ["projectId"])
    .index("byUserId", ["userId"]),

  // Folder organization
  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.id("folders")),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byParentId", ["parentId"])
    .index("byProjectId", ["projectId"])
    .index("byUserId", ["userId"]),

  // Projects/Workspaces
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
    settings: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    isDefault: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
  }).index("byUserId", ["userId"]),

  // Project membership / access control
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.string(),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("byProjectId", ["projectId"])
    .index("byUserId", ["userId"])
    .index("byProjectAndUser", ["projectId", "userId"]),

  // Skills/Tools marketplace
  skills: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    category: v.string(),
    version: v.string(),
    author: v.optional(v.string()),
    repository: v.optional(v.string()),
    documentation: v.optional(v.string()),
    code: v.string(), // The actual skill code
    schema: v.optional(v.any()), // JSON schema for skill parameters
    isInstalled: v.boolean(),
    isEnabled: v.boolean(),
    userId: v.optional(v.string()),
    installedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    projectId: v.optional(v.id("projects")),
  })
    .index("byUserId", ["userId"])
    .index("byIsInstalled", ["isInstalled"])
    .index("byCategory", ["category"])
    .index("byProjectId", ["projectId"]),

  // Cron jobs/scheduled tasks
  cronJobs: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    schedule: v.string(), // Cron expression
    agentId: v.string(),
    prompt: v.string(), // What to execute
    isEnabled: v.boolean(),
    lastRun: v.optional(v.number()),
    nextRun: v.optional(v.number()),
    userId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    projectId: v.optional(v.id("projects")),
  })
    .index("byAgentId", ["agentId"])
    .index("byUserId", ["userId"])
    .index("byIsEnabled", ["isEnabled"])
    .index("byNextRun", ["nextRun"])
    .index("byProjectId", ["projectId"]),

  // Cron job execution history
  cronJobRuns: defineTable({
    cronJobId: v.id("cronJobs"),
    status: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("running")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("byCronJobId", ["cronJobId"])
    .index("byStatus", ["status"]),

  // MCP (Model Context Protocol) connections
  mcpConnections: defineTable({
    name: v.string(),
    serverUrl: v.string(),
    protocol: v.string(), // "mcp", "custom"
    isConnected: v.boolean(),
    isEnabled: v.boolean(),
    credentials: v.optional(v.any()), // Encrypted
    capabilities: v.optional(v.any()),
    userId: v.optional(v.string()),
    lastConnectedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    projectId: v.optional(v.id("projects")),
  })
    .index("byUserId", ["userId"])
    .index("byIsEnabled", ["isEnabled"])
    .index("byProjectId", ["projectId"]),

  // API keys and credentials (encrypted)
  apiKeys: defineTable({
    provider: v.string(), // "openai", "openrouter", "anthropic", etc.
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

  // Usage tracking for metrics
  usage: defineTable({
    agentId: v.string(),
    sessionId: v.optional(v.string()),
    provider: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.optional(v.number()), // Estimated cost in USD
    userId: v.optional(v.string()),
    timestamp: v.number(),
    projectId: v.optional(v.id("projects")),
  })
    .index("byAgentId", ["agentId"])
    .index("byUserId", ["userId"])
    .index("byTimestamp", ["timestamp"])
    .index("byProvider", ["provider"])
    .index("byProjectId", ["projectId"]),

  // User settings and configuration
  settings: defineTable({
    userId: v.string(),
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index("byUserId", ["userId"])
    .index("byUserIdAndKey", ["userId", "key"]),

  // System logs for debugging
  logs: defineTable({
    level: v.union(
      v.literal("debug"),
      v.literal("info"),
      v.literal("warn"),
      v.literal("error")
    ),
    source: v.string(), // "agent", "system", "api", etc.
    message: v.string(),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
    timestamp: v.number(),
    projectId: v.optional(v.id("projects")),
  })
    .index("byLevel", ["level"])
    .index("bySource", ["source"])
    .index("byTimestamp", ["timestamp"])
    .index("byUserId", ["userId"])
    .index("byProjectId", ["projectId"])
    .index("byProjectAndTimestamp", ["projectId", "timestamp"]),

  // Channels for multi-platform support
  channels: defineTable({
    name: v.string(),
    type: v.string(), // "dashboard", "api", "webhook", "whatsapp", etc.
    isEnabled: v.boolean(),
    configuration: v.optional(v.any()),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    projectId: v.optional(v.id("projects")),
  })
    .index("byType", ["type"])
    .index("byUserId", ["userId"])
    .index("byIsEnabled", ["isEnabled"])
    .index("byProjectId", ["projectId"]),

  // Heartbeat system for ongoing task tracking
  heartbeats: defineTable({
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    status: v.string(), // "active", "waiting", "completed", "error"
    currentTask: v.optional(v.string()),
    pendingTasks: v.array(v.string()),
    context: v.string(), // Markdown-formatted context
    lastCheck: v.number(),
    nextCheck: v.number(),
    metadata: v.optional(v.any()),
  })
    .index("byAgentId", ["agentId"])
    .index("byStatus", ["status"])
    .index("byNextCheck", ["nextCheck"]),

  // Secure Vault for encrypted secrets storage
  vault: defineTable({
    name: v.string(), // Display name (e.g., "OpenAI API Key")
    category: v.string(), // "api_key", "token", "secret", "credential"
    provider: v.optional(v.string()), // Associated provider
    encryptedValue: v.string(), // AES-256-GCM encrypted value
    iv: v.string(), // Initialization vector for decryption
    maskedValue: v.string(), // e.g., "sk-...abc123"
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

  // Audit log for vault access
  vaultAuditLog: defineTable({
    vaultEntryId: v.id("vault"),
    action: v.string(), // "created", "accessed", "updated", "deleted", "auto_captured"
    source: v.string(), // "dashboard", "chat", "api", "agent"
    userId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("byVaultEntryId", ["vaultEntryId"])
    .index("byUserId", ["userId"])
    .index("byTimestamp", ["timestamp"]),

  // Agent instances for multi-agent workflows
  instances: defineTable({
    agentId: v.string(),
    instanceId: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error")
    ),
    configuration: v.optional(v.any()),
    userId: v.optional(v.string()),
    startedAt: v.number(),
    stoppedAt: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
  })
    .index("byAgentId", ["agentId"])
    .index("byInstanceId", ["instanceId"])
    .index("byStatus", ["status"])
    .index("byUserId", ["userId"])
    .index("byProjectId", ["projectId"]),

  // Mastra Workflow definitions
  workflowDefinitions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    steps: v.string(), // JSON-serialized step definitions
    triggers: v.optional(v.string()), // JSON-serialized trigger config
    inputSchema: v.optional(v.string()), // JSON-serialized Zod schema description
    outputSchema: v.optional(v.string()), // JSON-serialized Zod schema description
    isActive: v.boolean(),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byProjectId", ["projectId"])
    .index("byUserId", ["userId"])
    .index("byIsActive", ["isActive"]),

  // Workflow execution runs
  workflowRuns: defineTable({
    workflowId: v.id("workflowDefinitions"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("suspended"),
      v.literal("completed"),
      v.literal("failed")
    ),
    input: v.optional(v.string()), // JSON-serialized input
    output: v.optional(v.string()), // JSON-serialized output
    currentStepIndex: v.number(),
    suspendedAt: v.optional(v.string()), // Step ID where suspended
    suspendPayload: v.optional(v.string()), // JSON-serialized suspend data
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    projectId: v.optional(v.id("projects")),
    userId: v.optional(v.string()),
  })
    .index("byWorkflowId", ["workflowId"])
    .index("byStatus", ["status"])
    .index("byProjectId", ["projectId"])
    .index("byUserId", ["userId"]),

  // Individual step records for a workflow run
  workflowSteps: defineTable({
    runId: v.id("workflowRuns"),
    stepId: v.string(),
    name: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped"),
      v.literal("suspended")
    ),
    input: v.optional(v.string()), // JSON-serialized
    output: v.optional(v.string()), // JSON-serialized
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("byRunId", ["runId"])
    .index("byStatus", ["status"]),
});
