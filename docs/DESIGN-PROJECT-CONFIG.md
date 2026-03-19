---
title: "Design: Project Configuration"
description: "Internal design document for global vs project-scoped configuration, migration strategy, and UI implications."
---

# DESIGN-PROJECT-CONFIG.md — Global vs Project-Scoped Configuration

> **Session:** 0.2 (Track A — Lalo + Puck)
> **Branch:** `docs/session-0.2-project-config-design`
> **Date:** 2026-02-22
> **Status:** Design Document — no code changes
> **Implements:** AGE-106 prerequisite design

---

## Table of Contents

1. [Table Classification](#part-1-table-classification)
2. [Configuration Cascade](#part-2-configuration-cascade)
3. [API Changes](#part-3-api-changes)
4. [Migration Strategy](#part-4-migration-strategy)
5. [UI Implications](#part-5-ui-implications)
6. [Implementation Plan](#part-6-implementation-plan)

---

## Part 1: Table Classification

### Summary Table

| # | Table | Classification | projectId Field | Index |
|---|-------|---------------|----------------|-------|
| 1 | `agents` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 2 | `threads` | Project-scoped | **Already present** | **Already present** |
| 3 | `messages` | Derived (via `threads`) | None — inherits via `threadId` | — |
| 4 | `sessions` | Derived (via `threads`) | None — inherits via `threadId` | — |
| 5 | `files` | Project-scoped | **Already present** | **Already present** |
| 6 | `folders` | Project-scoped | **Already present** | **Already present** |
| 7 | `projects` | Root entity | N/A — this IS the project | — |
| 8 | `skills` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 9 | `cronJobs` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 10 | `cronJobRuns` | Derived (via `cronJobs`) | None — inherits via `cronJobId` | — |
| 11 | `mcpConnections` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 12 | `apiKeys` | Global-only | None | — |
| 13 | `usage` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 14 | `settings` | Global-only | None | — |
| 15 | `logs` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 16 | `channels` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |
| 17 | `heartbeats` | Derived (via `threads` or `agents`) | None — inherits via `threadId` / `agentId` | — |
| 18 | `vault` | Global-only | None | — |
| 19 | `vaultAuditLog` | Derived (via `vault`) | None — inherits via `vaultEntryId` | — |
| 20 | `instances` | Project-scoped | Add `projectId: v.optional(v.id("projects"))` | Add `.index("byProjectId", ["projectId"])` |

### Classification Summary

| Category | Count | Tables |
|----------|-------|--------|
| Root entity | 1 | `projects` |
| Project-scoped (already has projectId) | 3 | `threads`, `files`, `folders` |
| Project-scoped (needs projectId added) | 8 | `agents`, `skills`, `cronJobs`, `mcpConnections`, `usage`, `logs`, `channels`, `instances` |
| Derived (inherits via FK) | 5 | `messages`, `sessions`, `cronJobRuns`, `heartbeats`, `vaultAuditLog` |
| Global-only (user-scoped, no project) | 3 | `apiKeys`, `settings`, `vault` |

**Schema changes required for 8 tables:** `agents`, `skills`, `cronJobs`, `mcpConnections`, `usage`, `logs`, `channels`, `instances`.

---

### Detailed Classification Rationale

#### 1. `agents` — **Project-scoped**

Agents are the core building block of a project workspace. Each project has its own set of agents with distinct instructions, models, and tool configurations. An agent defined in Project A must not be visible or accessible from Project B — the entire purpose of the project boundary is to isolate agent contexts.

**Schema change required:**
```ts
// convex/schema.ts — agents table
agents: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byAgentId", ["id"])
  .index("byUserId", ["userId"])
  .index("byIsActive", ["isActive"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 2. `threads` — **Project-scoped** (already migrated)

Conversation threads are scoped to a project because they involve an agent (which is project-scoped) and represent work done within a specific project workspace. The `projectId` field and `byProjectId` index already exist in the schema. No schema change needed, but existing rows without `projectId` require backfill.

#### 3. `messages` — **Derived** (parent: `threads`)

Messages belong to a thread via the required `threadId: v.id("threads")` foreign key. Since `threads` is project-scoped, the project scope of any message is fully determined by looking up its parent thread. Adding a redundant `projectId` to `messages` would create denormalization and a dual source of truth for project membership.

**Query pattern:** `messages → threads.projectId`

#### 4. `sessions` — **Derived** (parent: `threads`)

Sessions have a required `threadId: v.id("threads")` field, making the project scope deterministic through the thread. Sessions are ephemeral runtime state — they are created when a thread is activated and destroyed when completed. Their project context is always the same as the thread they belong to.

**Query pattern:** `sessions → threads.projectId`

#### 5. `files` — **Project-scoped** (already migrated)

Files are uploaded into a project workspace and are browseable via the project's folder tree. The `projectId` and `byProjectId` index already exist. Files may optionally live inside a folder (`folderId`), but the project-level `projectId` is the authoritative scope anchor.

#### 6. `folders` — **Project-scoped** (already migrated)

Folders are an organizational structure owned by a project. A folder tree is entirely contained within one project. The `projectId` and `byProjectId` index already exist.

#### 7. `projects` — **Root entity**

`projects` is the project itself. All other project-scoped tables reference this table via `v.id("projects")`. It is scoped to a user via `userId`.

#### 8. `skills` — **Project-scoped**

Skills (tools in the Mastra sense) are installed and configured per project. Different projects may need different skill sets — a customer service project needs different tools than a code-generation project. The `isInstalled` and `isEnabled` flags are project-contextual; the same skill package may be enabled in one project and disabled in another.

**Schema change required:**
```ts
// convex/schema.ts — skills table
skills: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byUserId", ["userId"])
  .index("byIsInstalled", ["isInstalled"])
  .index("byCategory", ["category"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 9. `cronJobs` — **Project-scoped**

Cron jobs schedule an agent (via `agentId`) to run a prompt on a schedule. Since agents are project-scoped, cron jobs are logically project-scoped as well. A project's automation workflows should be isolated from those of another project.

**Schema change required:**
```ts
// convex/schema.ts — cronJobs table
cronJobs: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byAgentId", ["agentId"])
  .index("byUserId", ["userId"])
  .index("byIsEnabled", ["isEnabled"])
  .index("byNextRun", ["nextRun"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 10. `cronJobRuns` — **Derived** (parent: `cronJobs`)

Execution history rows reference their parent via the required `cronJobId: v.id("cronJobs")` foreign key. Since `cronJobs` is project-scoped, the project context of any run is inherited. These are immutable audit records.

**Query pattern:** `cronJobRuns → cronJobs.projectId`

#### 11. `mcpConnections` — **Project-scoped**

MCP server connections expose external tools to agents within a project. Each project may connect to different MCP servers with different credentials. Sharing MCP connections across projects would create security risks (one project could potentially access another project's external services).

**Schema change required:**
```ts
// convex/schema.ts — mcpConnections table
mcpConnections: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byUserId", ["userId"])
  .index("byIsEnabled", ["isEnabled"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 12. `apiKeys` — **Global-only**

API keys (e.g., OpenAI key, Anthropic key) are user-level credentials used to authenticate with LLM providers. They are not project-specific — the same OpenAI key funds all projects belonging to a user. Scoping API keys to a project would create unnecessary duplication and force users to re-enter the same credentials for every new project.

**No schema change.** Remains user-scoped via `userId`.

#### 13. `usage` — **Project-scoped**

Usage metrics (token counts, cost estimates) are generated per agent invocation and must be attributable to the project that consumed them. Project-level cost reporting and quota enforcement both require `projectId`. A user managing multiple projects needs per-project spend visibility.

**Schema change required:**
```ts
// convex/schema.ts — usage table
usage: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byAgentId", ["agentId"])
  .index("byUserId", ["userId"])
  .index("byTimestamp", ["timestamp"])
  .index("byProvider", ["provider"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 14. `settings` — **Global-only**

User settings (UI preferences, defaults, notification config) apply to the user's entire experience across all projects. Keys like `theme`, `language`, or `defaultModel` are user-level concerns. If project-level overrides are needed, the `projects.settings` field handles them via the config cascade (see Part 2).

**No schema change.** Remains user-scoped via `userId` + `key`.

#### 15. `logs` — **Project-scoped**

System logs record activity originating from agents, APIs, and workflows. Since all meaningful activity is project-scoped, logs should carry `projectId` to enable per-project log filtering. Without it, users debugging a specific project's agent behavior must cross-reference other tables.

**Schema change required:**
```ts
// convex/schema.ts — logs table
logs: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byLevel", ["level"])
  .index("bySource", ["source"])
  .index("byTimestamp", ["timestamp"])
  .index("byUserId", ["userId"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 16. `channels` — **Project-scoped**

Channel configurations (Telegram bot token, WhatsApp webhook URL) are connected to specific project agents. A Telegram channel connects to a particular agent in a particular project workspace. Sharing a channel across projects would route user messages to the wrong agent context.

**Schema change required:**
```ts
// convex/schema.ts — channels table
channels: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byType", ["type"])
  .index("byUserId", ["userId"])
  .index("byIsEnabled", ["isEnabled"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

#### 17. `heartbeats` — **Derived** (parent: `threads` or `agents`)

Heartbeats track the real-time status of an agent execution. They reference both `agentId` (string) and optionally `threadId: v.optional(v.id("threads"))`. When `threadId` is present, project scope is inherited from the thread. When only `agentId` is present, scope is inherited from the agent. Heartbeats are transient monitoring records.

**Query pattern:** `heartbeats → threads.projectId` (when threadId present) or `heartbeats → agents.projectId` (when only agentId present).

#### 18. `vault` — **Global-only**

The vault stores encrypted secrets (API tokens, OAuth credentials, private keys) at the user level. Secrets are shared infrastructure: an OAuth token for a GitHub integration applies to all projects that need GitHub access. Scoping vault entries to a project would force users to duplicate secrets across projects and increase the attack surface.

**No schema change.** Remains user-scoped via `userId`.

#### 19. `vaultAuditLog` — **Derived** (parent: `vault`)

Audit log entries reference their vault entry via the required `vaultEntryId: v.id("vault")` foreign key. Since `vault` is global/user-scoped, audit log scope follows the same. These are immutable compliance records that must not be filtered by project.

**Query pattern:** `vaultAuditLog → vault.userId`

#### 20. `instances` — **Project-scoped**

Agent instances represent running agent processes in multi-agent workflows. Since agents are project-scoped, their running instances are too. A project orchestrator needs to list all active instances within its project boundary to coordinate them.

**Schema change required:**
```ts
// convex/schema.ts — instances table
instances: defineTable({
  // ... existing fields ...
  projectId: v.optional(v.id("projects")),  // ADD THIS
})
  .index("byAgentId", ["agentId"])
  .index("byInstanceId", ["instanceId"])
  .index("byStatus", ["status"])
  .index("byUserId", ["userId"])
  .index("byProjectId", ["projectId"])      // ADD THIS
```

---

## Part 2: Configuration Cascade

AgentForge resolves configuration by walking a 4-level hierarchy from most specific to most general. The first non-null value found at any level wins. This prevents accidental global-scope bleed while keeping reasonable defaults in place.

```
Agent Config > Project Config > Global Config > System Defaults
```

---

### 2.1 Configuration Dimensions

#### 1. LLM Model

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | `agents.model` (string, Mastra `"provider/model"` format) | Dashboard agent editor, CLI `agentforge agent update` |
| Project | `projects.settings.defaultModel` (string) | Dashboard project settings, CLI `agentforge project config` |
| Global | `settings` table: `key="defaultModel"`, scoped to `userId` | Dashboard global settings page |
| System | Hardcoded: `"openai/gpt-4o"` | N/A |

#### 2. Temperature

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | `agents.temperature` (number, optional) | Dashboard agent editor |
| Project | `projects.settings.defaultTemperature` (number) | Dashboard project settings |
| Global | `settings` table: `key="defaultTemperature"` | Dashboard global settings |
| System | `0.7` | N/A |

#### 3. Max Tokens

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | `agents.maxTokens` (number, optional) | Dashboard agent editor |
| Project | `projects.settings.defaultMaxTokens` (number) | Dashboard project settings |
| Global | `settings` table: `key="defaultMaxTokens"` | Dashboard global settings |
| System | `4096` | N/A |

#### 4. Default Instructions (System Prompt Prefix)

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | `agents.instructions` (string, required) | Dashboard agent editor |
| Project | `projects.settings.instructionPrefix` (string) | Dashboard project settings |
| Global | `settings` table: `key="instructionPrefix"` | Dashboard global settings |
| System | `""` (empty string — no prefix injected) | N/A |

> **Note on instructions merge vs. override:** Instructions at the agent level are a full replacement, not a prefix. If a project `instructionPrefix` is set and the agent has its own `instructions`, the final system prompt is: `[projectInstructionPrefix]\n\n[agentInstructions]`. This lets projects inject compliance notices or persona context without touching individual agents.

#### 5. Failover Models

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | `agents.failoverModels` (array of `{provider, model}`) | Dashboard agent editor |
| Project | `projects.settings.failoverModels` (array) | Dashboard project settings |
| Global | `settings` table: `key="failoverModels"` (JSON array) | Dashboard global settings |
| System | `[]` (no failover — hard fail) | N/A |

> Failover chains do **not** merge across levels — the most specific non-null chain is used entirely. Merging chains from multiple levels would produce unpredictable ordering.

#### 6. API Keys

API keys are resolved by provider name. The lookup order determines which credential is used for a given provider (e.g., `"anthropic"`).

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | Not directly stored on agent. Agents reference project or global keys implicitly. | N/A |
| Project | `projects.settings.apiKeyIds` (map of `provider → vault._id`) | Dashboard project settings (select a vault entry per provider) |
| Global | `apiKeys` table (legacy) or `vault` table entries scoped to `userId` | Dashboard vault page |
| System | Environment variable fallback (`OPENAI_API_KEY`, etc.) read at Convex action runtime | `.env` / deployment config |

> **Security note:** API key values never leave the `vault` table in plaintext. The cascade resolves a vault entry ID, and the action layer decrypts it at call time using the stored IV and AES-256-GCM encrypted value.

#### 7. MCP Connections

| Level | Storage | How Set |
|-------|---------|---------|
| Agent | Agent-level MCP overrides not yet modelled (future: `agents.mcpConnectionIds`) | Planned |
| Project | `projects.settings.mcpConnectionIds` (array of `mcpConnections._id`) | Dashboard project settings |
| Global | `mcpConnections` table rows scoped to `userId` with no project association | Dashboard MCP settings |
| System | None | N/A |

> MCP connections **merge** across project and global levels — an agent gets both its project's MCP servers and any global MCP servers configured for the user. This differs from scalar fields (model, temperature) which stop at the first non-null level.

---

### 2.2 Resolution Examples

**Example: Model Resolution**

```
1. Agent "customer-support" has model: "anthropic/claude-sonnet-4-6" → USE THIS
2. Agent model is null → check project.settings.defaultModel
3. Project has defaultModel: "openai/gpt-4o-mini" → USE THIS
4. Project has no defaultModel → check settings table (key="defaultModel", userId=<user>)
5. Global settings has defaultModel: "google/gemini-2.0-flash" → USE THIS
6. No global setting exists → USE system default: "openai/gpt-4o"
```

**Example: Instructions Resolution**

```
Project instructionPrefix: "You are an assistant for Acme Corp. Always be concise."
Agent instructions: "You handle billing questions. Never reveal pricing tiers."

Final system prompt:
  "You are an assistant for Acme Corp. Always be concise.\n\nYou handle billing questions. Never reveal pricing tiers."
```

---

### 2.3 Resolution Function (TypeScript pseudocode)

```typescript
// convex/lib/configResolver.ts

import { Id } from "../_generated/dataModel";

interface AgentConfig {
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  instructions: string;
  failoverModels?: Array<{ provider: string; model: string }>;
}

interface ProjectSettings {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  instructionPrefix?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
  apiKeyIds?: Record<string, Id<"vault">>;
  mcpConnectionIds?: Array<Id<"mcpConnections">>;
}

interface ResolvedConfig {
  model: string;             // Always present — falls through to system default
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  failoverModels: Array<{ provider: string; model: string }>;
  apiKeyId?: Id<"vault">;    // For the resolved model's provider
  mcpConnectionIds: Array<Id<"mcpConnections">>;
}

const SYSTEM_DEFAULTS = {
  model: "openai/gpt-4o",
  temperature: 0.7,
  maxTokens: 4096,
  instructionPrefix: "",
  failoverModels: [],
} as const;

export async function resolveAgentConfig(
  ctx: QueryCtx,
  agent: AgentConfig,
  projectId: Id<"projects"> | undefined,
  userId: string
): Promise<ResolvedConfig> {
  // Fetch project settings if project is set
  const project = projectId ? await ctx.db.get(projectId) : null;
  const projectSettings: ProjectSettings = project?.settings ?? {};

  // Fetch global user settings (key-value table)
  const globalSettings = await fetchGlobalSettings(ctx, userId);

  // --- Scalar resolution (first non-null wins) ---

  const model =
    agent.model ||
    projectSettings.defaultModel ||
    globalSettings.defaultModel ||
    SYSTEM_DEFAULTS.model;

  const temperature =
    agent.temperature ??
    projectSettings.defaultTemperature ??
    globalSettings.defaultTemperature ??
    SYSTEM_DEFAULTS.temperature;

  const maxTokens =
    agent.maxTokens ??
    projectSettings.defaultMaxTokens ??
    globalSettings.defaultMaxTokens ??
    SYSTEM_DEFAULTS.maxTokens;

  const failoverModels =
    agent.failoverModels ??
    projectSettings.failoverModels ??
    globalSettings.failoverModels ??
    SYSTEM_DEFAULTS.failoverModels;

  // --- Instructions: prefix injection ---
  const instructionPrefix =
    projectSettings.instructionPrefix ||
    globalSettings.instructionPrefix ||
    SYSTEM_DEFAULTS.instructionPrefix;

  const systemPrompt = instructionPrefix
    ? `${instructionPrefix}\n\n${agent.instructions}`
    : agent.instructions;

  // --- API Key: resolve for primary model's provider ---
  const provider = model.split("/")[0];
  const apiKeyId =
    projectSettings.apiKeyIds?.[provider] ??
    globalSettings.apiKeyIds?.[provider];

  // --- MCP Connections: merge project + global ---
  const projectMcpIds = projectSettings.mcpConnectionIds ?? [];
  const globalMcpIds = await fetchGlobalMcpIds(ctx, userId);
  const mcpConnectionIds = [...new Set([...projectMcpIds, ...globalMcpIds])];

  return {
    model,
    temperature,
    maxTokens,
    systemPrompt,
    failoverModels,
    apiKeyId,
    mcpConnectionIds,
  };
}

async function fetchGlobalSettings(ctx: QueryCtx, userId: string) {
  const rows = await ctx.db
    .query("settings")
    .withIndex("byUserId", (q) => q.eq("userId", userId))
    .collect();

  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function fetchGlobalMcpIds(
  ctx: QueryCtx,
  userId: string
): Promise<Array<Id<"mcpConnections">>> {
  const conns = await ctx.db
    .query("mcpConnections")
    .withIndex("byUserId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("isEnabled"), true))
    .collect();
  return conns.map((c) => c._id);
}
```

---

## Part 3: API Changes

### 3.1 List Queries — projectId Filter

Every list query for project-scoped tables must accept an optional `projectId`. When provided, results are filtered to that project. When omitted, behaviour depends on the caller context: the dashboard always provides a `projectId`; direct API calls without a project get all accessible resources for the user.

**Pattern applied to each table:**

```typescript
// convex/agents.ts — updated list query
export const list = query({
  args: {
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),  // NEW
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      return await ctx.db
        .query("agents")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();
    }
    if (args.userId) {
      return await ctx.db
        .query("agents")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    return await ctx.db.query("agents").collect();
  },
});
```

**Full list of queries requiring the `projectId` arg addition:**

| File | Query | Index required (AGE-106) |
|------|-------|--------------------------|
| `convex/agents.ts` | `list`, `listActive` | `byProjectId` on `agents` |
| `convex/threads.ts` | `list` | Already has `byProjectId` |
| `convex/skills.ts` | `list` | `byProjectId` on `skills` |
| `convex/files.ts` | `list` | Already has `byProjectId` |
| `convex/folders.ts` | `list` | Already has `byProjectId` |
| `convex/cronJobs.ts` | `list` | `byProjectId` on `cronJobs` |
| `convex/mcpConnections.ts` | `list` | `byProjectId` on `mcpConnections` |
| `convex/channels.ts` | `list` | `byProjectId` on `channels` |
| `convex/usage.ts` | `list` | `byProjectId` on `usage` |
| `convex/logs.ts` | `list` | `byProjectId` on `logs` |

---

### 3.2 Create Mutations — projectId Parameter

All create mutations for project-scoped tables accept an optional `projectId`. Resources created without a `projectId` are treated as global/unscoped resources belonging to the user.

**Pattern:**

```typescript
// convex/agents.ts — updated create mutation
export const create = mutation({
  args: {
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
    userId: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),  // NEW
    failoverModels: v.optional(
      v.array(v.object({ provider: v.string(), model: v.string() }))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("agents", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

---

### 3.3 Dashboard API — Project Context

The dashboard must inject a `projectId` into all data queries automatically once the user selects a project.

**ProjectContext provider:**

```typescript
// packages/web/src/contexts/ProjectContext.tsx

import { createContext, useContext, useState, ReactNode } from "react";
import { Id } from "../../../convex/_generated/dataModel";

interface ProjectContextValue {
  projectId: Id<"projects"> | null;
  setProjectId: (id: Id<"projects"> | null) => void;
}

const ProjectContext = createContext<ProjectContextValue>({
  projectId: null,
  setProjectId: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(() => {
    const stored = localStorage.getItem("agentforge:selectedProjectId");
    return stored ? (stored as Id<"projects">) : null;
  });

  const handleSetProjectId = (id: Id<"projects"> | null) => {
    setProjectId(id);
    if (id) {
      localStorage.setItem("agentforge:selectedProjectId", id);
    } else {
      localStorage.removeItem("agentforge:selectedProjectId");
    }
  };

  return (
    <ProjectContext.Provider
      value={{ projectId, setProjectId: handleSetProjectId }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export const useProject = () => useContext(ProjectContext);
```

**Usage in a data hook:**

```typescript
// packages/web/src/hooks/useAgents.ts

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useProject } from "../contexts/ProjectContext";

export function useAgents() {
  const { projectId } = useProject();
  return useQuery(api.agents.list, {
    projectId: projectId ?? undefined,
  });
}
```

---

### 3.4 Edge Cases

#### Project Deletion

**Recommendation: Two-phase soft delete with a 30-day recovery window.**

Rationale: Agents often represent significant configuration investment. Accidental deletion is a critical UX failure. A soft delete costs little in Convex (storage is cheap) and provides a clear recovery path.

| Option | Description | Risk |
|--------|-------------|------|
| Cascade delete | Delete all resources with matching `projectId` | Irreversible data loss if user deletes by accident |
| Soft delete | Set `project.deletedAt`, hide from queries, allow recovery | Schema complexity, requires all queries to filter `deletedAt` |
| Orphan with warning | Remove `projectId` from resources, surface under "Unassigned" | Agents survive but lose project context |

```typescript
// convex/projects.ts — soft delete
export const remove = mutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // A scheduled Convex cron job purges hard-deletes after 30 days
    return { success: true, recoverable: true };
  },
});

// All list queries must filter: .filter((q) => q.eq(q.field("deletedAt"), undefined))
```

The `projects` table schema (AGE-106) must add `deletedAt: v.optional(v.number())`.

---

#### Cross-Project Resource Sharing

**Skills** can be shared: a skill with `projectId=null` is a "global" skill visible to all projects for the user. A skill with `projectId` set is project-private.

**Agents** should not be shared directly — they carry project-specific instructions and model config. Instead, expose a **clone** operation:

```typescript
// convex/agents.ts — clone across projects
export const cloneToProject = mutation({
  args: {
    sourceAgentId: v.string(),
    targetProjectId: v.id("projects"),
    newName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("agents")
      .withIndex("byAgentId", (q) => q.eq("id", args.sourceAgentId))
      .first();
    if (!source) throw new Error("Source agent not found");

    const now = Date.now();
    return await ctx.db.insert("agents", {
      ...source,
      id: `${source.id}-clone-${now}`,
      name: args.newName ?? `${source.name} (copy)`,
      projectId: args.targetProjectId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

**Skills listing merges project + global:**

```typescript
// convex/skills.ts
export const listForProject = query({
  args: { userId: v.string(), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const [projectSkills, globalSkills] = await Promise.all([
      ctx.db.query("skills")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db.query("skills")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId))
        .filter((q) => q.eq(q.field("projectId"), undefined))
        .collect(),
    ]);
    return { projectSkills, globalSkills };
  },
});
```

---

#### Default Project

CLI users and new dashboard users who have not created a project must still be able to operate. A "Default" project is automatically created on first login or first CLI `agentforge init`.

```typescript
// convex/projects.ts
export const getOrCreateDefault = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("projects")
      .withIndex("byUserId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isDefault"), true))
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("projects", {
      name: "Default",
      description: "Auto-created default project",
      userId: args.userId,
      isDefault: true,
      settings: {},
      createdAt: now,
      updatedAt: now,
    });
  },
});
```

The `projects` table schema (AGE-106) must add `isDefault: v.optional(v.boolean())`.

CLI behavior: `agentforge` commands without `--project` use the Default project. Users can override with `agentforge --project <name>` or set a default in `~/.agentforge/config.json`.

---

#### Project Switching — Active Sessions

When a user switches projects in the dashboard, active sessions for the previous project are **paused, not terminated**. Terminating active LLM calls mid-stream would produce orphaned Convex actions.

```typescript
// convex/sessions.ts
export const pauseProjectSessions = mutation({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, args) => {
    const threads = await ctx.db.query("threads")
      .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId))
      .collect();

    const threadIds = new Set(threads.map((t) => t._id.toString()));

    const activeSessions = await ctx.db.query("sessions")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();

    const toUpdate = activeSessions.filter((s) =>
      threadIds.has(s.threadId.toString())
    );

    for (const session of toUpdate) {
      await ctx.db.patch(session._id, {
        status: "paused",
        lastActivityAt: Date.now(),
      });
    }

    return { paused: toUpdate.length };
  },
});
```

---

#### Permissions — Future-Proofing for Team Access

To support multiple users per project without a breaking schema change, introduce a `projectMembers` table in AGE-106:

```typescript
// In convex/schema.ts (AGE-106 addition)
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
```

Authorization helper for future use:

```typescript
async function assertProjectAccess(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  userId: string,
  requiredRole: "viewer" | "editor" | "owner" = "viewer"
): Promise<void> {
  const roleOrder = { viewer: 0, editor: 1, owner: 2 };
  const membership = await ctx.db.query("projectMembers")
    .withIndex("byProjectAndUser", (q) =>
      q.eq("projectId", projectId).eq("userId", userId)
    )
    .first();

  if (!membership || !membership.acceptedAt) {
    throw new Error("Not a project member");
  }
  if (roleOrder[membership.role] < roleOrder[requiredRole]) {
    throw new Error(`Requires ${requiredRole} access`);
  }
}
```

---

## Part 4: Migration Strategy

### Overview

The migration adds `projectId` to 8 tables and backfills all existing rows (including the 3 tables that already have the column) into a "Default" project. Because `projectId` is `v.optional(...)` in all cases, the schema change is non-breaking — existing code that does not supply `projectId` continues to work without modification. This enables a zero-downtime phased migration.

---

### Step 1: Default Project Creation

Before any backfill can run, a "Default" project must exist for each user.

**Convex mutation: `convex/migrations/createDefaultProjects.ts`**

```ts
import { internalMutation } from "../_generated/server";

export const createDefaultProjects = internalMutation(async (ctx) => {
  // Collect all distinct userIds across tables that have userId
  const agentRows    = await ctx.db.query("agents").collect();
  const threadRows   = await ctx.db.query("threads").collect();
  const fileRows     = await ctx.db.query("files").collect();
  const folderRows   = await ctx.db.query("folders").collect();
  const skillRows    = await ctx.db.query("skills").collect();
  const cronRows     = await ctx.db.query("cronJobs").collect();
  const mcpRows      = await ctx.db.query("mcpConnections").collect();
  const channelRows  = await ctx.db.query("channels").collect();
  const instanceRows = await ctx.db.query("instances").collect();

  const allUserIds = new Set<string>();
  for (const row of [
    ...agentRows, ...threadRows, ...fileRows, ...folderRows,
    ...skillRows, ...cronRows, ...mcpRows, ...channelRows, ...instanceRows,
  ]) {
    if (row.userId) allUserIds.add(row.userId);
  }

  // For each user, check if a Default project already exists
  const defaultProjectMap = new Map<string, Id<"projects">>();
  for (const userId of allUserIds) {
    const existing = await ctx.db
      .query("projects")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("name"), "Default"))
      .first();

    if (existing) {
      defaultProjectMap.set(userId, existing._id);
    } else {
      const projectId = await ctx.db.insert("projects", {
        name: "Default",
        description: "Auto-created default project for existing data",
        userId,
        settings: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      defaultProjectMap.set(userId, projectId);
    }
  }

  // Handle rows with no userId — assign to a global "system" default
  const systemDefault = await ctx.db
    .query("projects")
    .filter((q) => q.eq(q.field("name"), "__system_default__"))
    .first();

  let systemProjectId: Id<"projects">;
  if (systemDefault) {
    systemProjectId = systemDefault._id;
  } else {
    systemProjectId = await ctx.db.insert("projects", {
      name: "__system_default__",
      description: "System default project for rows with no userId",
      settings: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return { defaultProjectMap: Object.fromEntries(defaultProjectMap), systemProjectId };
});
```

---

### Step 2: Backfill Script

Each table requiring `projectId` gets its own backfill mutation. All mutations are idempotent — they only update rows where `projectId` is currently `undefined`.

**Convex mutation: `convex/migrations/backfillProjectIds.ts`**

```ts
import { internalMutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Helper: resolve projectId for a row with userId
async function resolveProjectId(
  ctx: any,
  userId: string | undefined,
  systemProjectId: Id<"projects">
): Promise<Id<"projects">> {
  if (!userId) return systemProjectId;
  const defaultProject = await ctx.db
    .query("projects")
    .withIndex("byUserId", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.eq(q.field("name"), "Default"))
    .first();
  return defaultProject?._id ?? systemProjectId;
}

// Backfill pattern (same for all 11 tables):
export const backfillAgents = internalMutation(async (ctx) => {
  const systemProject = await ctx.db
    .query("projects")
    .filter((q: any) => q.eq(q.field("name"), "__system_default__"))
    .first();
  const systemProjectId = systemProject!._id;

  const rows = await ctx.db.query("agents")
    .filter((q: any) => q.eq(q.field("projectId"), undefined))
    .collect();

  for (const row of rows) {
    const projectId = await resolveProjectId(ctx, row.userId, systemProjectId);
    await ctx.db.patch(row._id, { projectId });
  }
  return { updated: rows.length };
});

// Same pattern repeated for: backfillSkills, backfillCronJobs,
// backfillMcpConnections, backfillUsage, backfillLogs,
// backfillChannels, backfillInstances, backfillThreads,
// backfillFiles, backfillFolders
```

---

### Step 3: Migration Order

```
WAVE 0  (prerequisite)
  └─ projects            ← create Default projects for all users

WAVE 1  (direct projectId, no FK deps on other migratable tables)
  ├─ agents              ← referenced by threads, sessions, cronJobs, usage, heartbeats, instances
  ├─ skills              ← standalone
  ├─ cronJobs            ← references agents (agentId is string, not FK)
  ├─ mcpConnections      ← standalone
  ├─ usage               ← references agentId (string, not FK)
  ├─ logs                ← standalone
  ├─ channels            ← standalone
  ├─ instances           ← references agentId (string, not FK)
  ├─ threads             ← references agents (agentId is string, not FK)
  ├─ folders             ← standalone
  └─ files               ← references folders (optional FK) — run after folders

WAVE 2  (derived tables — no schema changes, verify only)
  ├─ messages            ← inherits via threadId → threads
  ├─ sessions            ← inherits via threadId → threads
  ├─ cronJobRuns         ← inherits via cronJobId → cronJobs
  ├─ heartbeats          ← inherits via threadId or agentId
  └─ vaultAuditLog       ← inherits via vaultEntryId → vault (no migration needed)

NO MIGRATION NEEDED
  ├─ projects            ← root entity
  ├─ apiKeys             ← global-only
  ├─ settings            ← global-only
  └─ vault               ← global-only
```

---

### Step 4: Rollback Plan

Because `projectId` is `v.optional(...)` in all schema definitions, rollback is non-destructive:

1. **Do NOT remove the `projectId` column** — optional fields in Convex are zero-cost when absent.
2. **If backfill assigned wrong projectId:** Run a corrective mutation that sets `projectId = undefined` on affected rows.
3. **If schema deployment fails:** Revert `convex/schema.ts` to the previous version and `npx convex deploy`.
4. **Rollback order:** Reverse of migration order.
5. **Rollback decision threshold:** If more than 5% of rows in any table fail validation after backfill, halt and rollback that table.

---

### Step 5: Zero-Downtime Approach

1. **`projectId` is optional in all tables.** Existing queries that do not reference `projectId` continue to work.
2. **Write paths are additive.** New rows created during migration will lack `projectId` until application code is updated.
3. **Phased deployment:**
   - **Phase A — Schema deploy:** Add `projectId` fields and indexes. Deploy. Zero impact.
   - **Phase B — Backfill:** Run backfill mutations. Live traffic continues unaffected.
   - **Phase C — Application update:** Update queries and mutations to supply `projectId`. Deploy.
   - **Phase D — Validation:** Run validation queries. Confirm 100% coverage.
   - **Phase E — Enforcement (optional):** Change `v.optional(v.id("projects"))` to `v.id("projects")` (required). Coordinated with full application audit.
4. **No table locks or downtime windows.** Convex mutations are serialized per document — patching `projectId` is atomic.

---

### Step 6: Validation

```ts
// convex/migrations/validateMigration.ts

export const validateProjectIdCoverage = internalQuery(async (ctx) => {
  const tables = [
    "agents", "threads", "files", "folders",
    "skills", "cronJobs", "mcpConnections",
    "usage", "logs", "channels", "instances",
  ] as const;

  const results: Record<string, { total: number; withProjectId: number; coverage: string }> = {};

  for (const table of tables) {
    const all = await ctx.db.query(table).collect();
    const withProjectId = all.filter((row: any) => row.projectId !== undefined);
    results[table] = {
      total: all.length,
      withProjectId: withProjectId.length,
      coverage: `${((withProjectId.length / all.length) * 100).toFixed(1)}%`,
    };
  }

  return results;
});
```

**Validation checks:**

1. **Coverage:** All tables must reach 100% `projectId` coverage before Phase E.
2. **Referential integrity:** Verify every `projectId` actually exists in `projects` table.
3. **Default project sanity:** Each user has exactly one "Default" project.
4. **Derived table consistency:** Spot-check that parent rows of `messages`, `sessions`, `cronJobRuns` have `projectId` set.
5. **Smoke test:** Create a new project, agent, thread, message. Verify all carry correct `projectId`.

---

## Part 5: UI Implications

### 5.1 Project Selector (Header Component)

The project selector lives in the dashboard header and acts as the global filter for all resource views.

**Behavior:**
- Renders as a dropdown in the top navigation bar, always visible
- Defaults to the user's most recently selected project (persisted in `localStorage` under key `agentforge:selectedProjectId`)
- New users see "Default" pre-selected (the auto-created project from migration)
- Selecting a project updates React context and triggers re-fetch of all project-scoped resource lists
- "Create New Project" option appears at the bottom of the dropdown
- The selected project ID is stored in a `ProjectContext` that all resource hooks consume

---

### 5.2 Resource List Filtering

| Resource | Current behavior | Post-AGE-106 behavior |
|---|---|---|
| Agents | Global list | Filtered by `selectedProjectId` |
| Threads | Already filtered by `projectId` | No change |
| Skills | Global marketplace | Project-installed shown first; globally available with "Global" badge |
| Files / Folders | Already filtered by `projectId` | No change |
| Cron Jobs | Global list | Filtered by `selectedProjectId` |
| MCP Connections | Global list | Filtered by `selectedProjectId` |
| Channels | Global list | Filtered by `selectedProjectId` |
| Usage / Logs | Global | Filtered by `selectedProjectId` with option to view global rollup |

---

### 5.3 Project Settings Page (`/settings/project`)

**Sections:**

- **General:** Project name, description, created date (read-only)
- **LLM Defaults:** Default model (dropdown), temperature (slider 0.0–2.0), max tokens (number input), system prompt prefix (textarea)
- **Failover:** Failover model chain, retry threshold
- **Danger Zone:** Delete project button (red, with confirmation modal)

---

### 5.4 Global vs Project Settings UI

The `/settings` page is split into two tabs:

- **Global tab:** API Keys (vault), user preferences (theme, language), vault audit log
- **Project tab:** All fields from 5.3, with inheritance indicators:
  - `(inherited)` label in muted text when project has not overridden the global default
  - `(overridden)` label in accent color when project has set a custom value
  - Reset icon (↺) to clear the override and revert to global default

---

### 5.5 ASCII Wireframes

**Project Selector (Header)**

```
┌─────────────────────────────────────────────────────────────────┐
│  AgentForge      [Nav links...]          [▼ My Project Name  ] │
│                                           ├──────────────────┤ │
│                                           │ ✓ My Project      │ │
│                                           │   Other Project   │ │
│                                           │   Third Project   │ │
│                                           │ ─────────────── │ │
│                                           │ + Create New...   │ │
│                                           └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Project Settings Page**

```
┌──────────────────────────────────────────────────────────────────┐
│  Settings                                                        │
│  ┌──────────┬──────────────┐                                    │
│  │  Global  │  Project ●   │                                    │
│  └──────────┴──────────────┘                                    │
│                                                                  │
│  General                                                         │
│  ┌────────────────────────────────────────┐                     │
│  │ Project Name   [My Project            ]│                     │
│  │ Description    [Optional description  ]│                     │
│  │ Created        2026-02-22 (read-only)  │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  LLM Defaults                                                    │
│  ┌────────────────────────────────────────┐                     │
│  │ Default Model  [anthropic/claude-... ▼]│ (inherited) ↺      │
│  │ Temperature    [0.7      ] ──●─────── │ (overridden) ↺      │
│  │ Max Tokens     [4096     ]             │ (inherited) ↺      │
│  │ System Prefix  [You are a helpful ... ]│ (inherited) ↺      │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  Failover                                                        │
│  ┌────────────────────────────────────────┐                     │
│  │ Failover Model [None ▼]               │                     │
│  │ Retry Count    [3       ]             │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  ─────────────────── Danger Zone ────────────────────────────── │
│  ┌────────────────────────────────────────┐                     │
│  │  [Delete Project]  (irreversible)      │                     │
│  └────────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Implementation Plan

### Phase 1: Schema Migration (AGE-106) — Size: M

**Objective:** Add `projectId` to 8 tables and create the "Default" project.

**Files to modify:**
- `convex/schema.ts` — add `projectId: v.optional(v.id("projects"))` + `.index("byProjectId", ["projectId"])` to: `agents`, `skills`, `cronJobs`, `mcpConnections`, `usage`, `logs`, `channels`, `instances`
- Add `deletedAt: v.optional(v.number())` and `isDefault: v.optional(v.boolean())` to `projects` table

**Files to create:**
- `convex/migrations/001_add_project_id.ts` — migration: create Default projects + backfill

**Dependencies:** None — this is the first phase. All other phases depend on this.

**Risk:** Medium. Backfill runs over production data. Must be idempotent. Schema change is additive (optional field), so existing queries do not break.

**Acceptance criteria:**
- `convex/schema.ts` passes `pnpm typecheck`
- All 8 target tables have `projectId` field and `byProjectId` index
- Migration creates exactly one "Default" project per user
- Re-running produces no duplicates
- `pnpm test` passes

---

### Phase 2: Query Layer — Size: L

**Objective:** Update all Convex queries and mutations to accept and filter by `projectId`. Add `resolveConfig()` cascade helper.

**Files to modify:**
- `convex/agents.ts` — list + create accept `projectId`
- `convex/threads.ts` — verify consistency
- `convex/skills.ts` — list returns project + global skills merged
- `convex/cronJobs.ts`, `convex/mcpConnections.ts`, `convex/channels.ts`, `convex/usage.ts`, `convex/logs.ts` — list accepts `projectId`
- `convex/mastraIntegration.ts` — agent construction uses `resolveConfig()`

**Files to create:**
- `convex/lib/configResolver.ts` — cascade resolution function

**Dependencies:** Phase 1 complete and merged.

**Risk:** Low-medium. Additive changes. Main risk is inconsistent filter application.

**Acceptance criteria:**
- All list queries filter by `projectId` when provided
- All list queries return all rows when `projectId` omitted (backward compat)
- `resolveConfig()` unit tests cover all cascade levels
- `pnpm test` and `pnpm typecheck` pass

---

### Phase 3: CLI Updates — Size: M

**Objective:** Add `--project` flag to CLI commands.

**Files to modify:**
- `packages/cli/src/commands/init.ts` — `--project` flag
- `packages/cli/src/commands/config.ts` — `--project` flag
- `packages/cli/src/commands/agent.ts` — `--project` flag
- `packages/cli/src/config.ts` — local config stores `defaultProjectId`

**Dependencies:** Phase 2 complete.

**Risk:** Low. CLI changes are additive. Commands without `--project` fall back to default.

**Acceptance criteria:**
- `agentforge init --project "name"` creates project and sets as default
- `agentforge config set defaultModel "..." --project "name"` works
- Commands without `--project` use stored default
- `--help` documents the flag

---

### Phase 4: Dashboard UI — Size: L

**Objective:** Add project selector, project settings page, filter all views.

**Files to create:**
- `packages/web/src/components/ProjectSelector.tsx`
- `packages/web/src/context/ProjectContext.tsx`
- `packages/web/src/pages/settings/ProjectSettings.tsx`
- `packages/web/src/hooks/useSelectedProject.ts`

**Files to modify:**
- `packages/web/src/components/Header.tsx` — mount ProjectSelector
- `packages/web/src/App.tsx` — wrap with ProjectContextProvider
- All list page components — pass `selectedProjectId` to queries
- `packages/web/src/pages/settings/Settings.tsx` — Global/Project tabs

**Dependencies:** Phase 2 complete. Can run in parallel with Phase 3.

**Risk:** Medium. Project context is a new global state dependency.

**Acceptance criteria:**
- Project selector visible in header on all pages
- Switching projects re-fetches all resource lists
- Skills list shows project + global with distinct visual treatment
- `/settings/project` route renders and saves
- Inheritance indicators (`inherited` / `overridden` / reset) work
- `pnpm typecheck` and `pnpm test` pass

---

### Dependency Diagram

```
Phase 1: Schema Migration (AGE-106)
└── convex/schema.ts + migration script
    │
    ▼
Phase 2: Query Layer
└── convex/*.ts — filter by projectId, resolveConfig()
    │
    ├──────────────────────┐
    ▼                      ▼
Phase 3: CLI Updates   Phase 4: Dashboard UI
packages/cli/          packages/web/
(sequential)           (can run in parallel with Phase 3)
```

Phases 3 and 4 both depend on Phase 2 but are independent of each other and can be developed concurrently. Phase 1 corresponds directly to AGE-106 (Sprint 1.1B). Phases 2–4 are the implementation work unlocked after AGE-106 merges.
