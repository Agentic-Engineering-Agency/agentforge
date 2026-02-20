# Architecture Analysis: Per-Project vs Global Configuration

**Date**: 2026-02-20
**Focus**: Improvement point 3 — Per-project vs global configuration
**Analyst**: Architecture Analyst (Teammate 2)

---

## Current Config Architecture

### AgentForge (Self-Hosted Framework)

The self-hosted framework (`/agentforge`) uses **Convex** as its backend database. Configuration is distributed across two layers:

#### 1. File-Based Config: `agentforge.config.ts`
Located at: `/packages/cli/templates/default/agentforge.config.ts`

This is the primary developer-facing config file scaffolded when users run `agentforge create`. It contains:

```typescript
export default {
  name: 'my-agent-project',
  version: '1.0.0',
  workspace: { basePath, skills, search, autoIndexPaths },
  failover: { defaultChain, retryPolicy, circuitBreaker, timeoutMs, trackCost, trackLatency },
  agents: [ { id, name, model, provider, instructions, failoverModels, tools } ],
  sandbox: { provider, docker: { image, resourceLimits, timeout } },
  env: { SUPPORT_EMAIL, COMPANY_NAME },
};
```

**Scope**: This is a single monolithic config file with no concept of projects. All agents in the codebase live in this single array. There is no mechanism to split config by project.

#### 2. Database-Backed Config: Convex Tables

The Convex schema (`/convex/schema.ts`) defines these configuration tables:

| Table | Primary Index | Notes |
|-------|---------------|-------|
| `agents` | `byUserId`, `byIsActive` | No `projectId` field |
| `skills` | `byUserId`, `byCategory` | No `projectId` field |
| `cronJobs` | `byUserId`, `byAgentId` | No `projectId` field |
| `sessions` | `byUserId`, `byAgentId` | No `projectId` field |
| `mcpConnections` | `byUserId`, `byIsEnabled` | No `projectId` field |
| `apiKeys` | `byUserId`, `byProvider` | No `projectId` field |
| `vault` | `byUserId`, `byCategory` | No `projectId` field |
| `settings` | `byUserId`, `byUserIdAndKey` | User-scoped key-value store |
| `projects` | `byUserId` | Has `name`, `description`, `settings: any` |
| `files` | `byProjectId` | Has `projectId` (optional) |
| `folders` | `byProjectId` | Has `projectId` (optional) |
| `threads` | `byProjectId` | Has `projectId` (optional) |

**Critical observation**: The `projects` table exists in the schema and several entities (`files`, `folders`, `threads`) already have an optional `projectId` foreign key. However, **agents, skills, cronJobs, sessions, and mcpConnections have NO `projectId` field** — they are purely user-scoped.

#### 3. Workspace Config: `AgentForgeWorkspace`
Located at: `/packages/core/src/workspace.ts`

The workspace is configured globally per agent instantiation:
- `basePath`: single filesystem root
- `skills`: directories to auto-discover
- `search`: BM25 keyword indexing
- `sandbox`: local or cloud execution

There is **no per-project workspace isolation** — all agents share the same workspace root.

---

### AgentForge Cloud

The cloud platform (`/agentforge-cloud`) has a significantly more mature multi-tenant architecture:

#### Convex Schema Hierarchy
```
Organization → Project → Agent
                      → Thread
                      → Deployment
                      → ApiKey (optional projectId)
                      → UsageRecord (optional projectId)
```

Key schema relationships:
- `organizations` — top-level tenant with `maxProjects`, `maxAgents`, `maxMembers` limits
- `projects` — scoped to `organizationId`, has `llmProvider`, `llmModel`, `llmApiKey` (BYOK per project), `settings: any`
- `agents` — scoped to both `projectId` AND `organizationId`
- `threads` — scoped to both `projectId` AND `organizationId`
- `deployments` — scoped to both `projectId` AND `organizationId`

#### Cloud Project Creation Flow
The UI at `/dashboard/organizations/$orgId/projects/index.tsx` creates projects with only:
- `name`
- `slug`
- `description`

The `updateProject` mutation supports additional config:
- `llmProvider`
- `llmModel`
- `llmApiKey` (encrypted BYOK)
- `settings: any` (freeform)
- `status` (active/paused/archived)

---

## Project Model Analysis

### AgentForge (Self-Hosted)

```typescript
// Current projects table
projects: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  userId: v.optional(v.string()),
  settings: v.optional(v.any()),  // Freeform — no defined structure
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

**Problems**:
1. `settings` is typed as `any` with no defined schema — no validation, no discoverability
2. No relationship between projects and agents (no `projectId` on agents table)
3. No relationship between projects and skills, cronJobs, sessions, or mcpConnections
4. The `projects:remove` mutation only cascades to `threads`, `files`, and `folders` — NOT agents, skills, or cronJobs
5. The CLI `projects switch` command stores the active project in `settings:set` with key `activeProject` but no CLI commands respect this active project when listing agents, cron jobs, etc.

### AgentForge Cloud

```typescript
// Cloud projects table
projects: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  status: projectStatus,
  settings: v.optional(v.any()),
  llmProvider: v.optional(v.string()),   // Per-project BYOK
  llmModel: v.optional(v.string()),      // Per-project default model
  llmApiKey: v.optional(v.string()),     // Encrypted
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

**Cloud is more mature** with typed LLM config per project, but it still lacks explicit per-project config for:
- Skills
- Cron jobs
- MCP connections
- Channels/integrations
- Sandbox settings
- Failover configuration

---

## What's Global vs Per-Project Today

### Global (not scoped to any project)
| Resource | Location | Scoping |
|----------|----------|---------|
| Agents | `agents` table | `userId` only |
| Skills | `skills` table | `userId` only |
| Cron jobs | `cronJobs` table | `userId` only |
| Sessions | `sessions` table | `userId` + `agentId` only |
| MCP connections | `mcpConnections` table | `userId` only |
| API keys (vault) | `vault` + `apiKeys` tables | `userId` only |
| Workspace config | `agentforge.config.ts` | File-level (whole project) |
| Failover chains | `agentforge.config.ts` | File-level (whole project) |
| Sandbox config | `agentforge.config.ts` | File-level (whole project) |
| Channels | `channels` table | `userId` only |

### Per-Project (partially implemented)
| Resource | Location | Scoping |
|----------|----------|---------|
| Files | `files` table | `userId` + optional `projectId` |
| Folders | `folders` table | `userId` + optional `projectId` |
| Threads | `threads` table | `userId` + optional `projectId` |
| Projects | `projects` table | `userId` only (self-referential) |

### Per-Project (cloud-only, not in self-hosted)
| Resource | Location | Scoping |
|----------|----------|---------|
| Agents | `agents` table (cloud) | `projectId` + `organizationId` |
| Threads | `threads` table (cloud) | `projectId` + `organizationId` |
| Deployments | `deployments` table (cloud) | `projectId` + `organizationId` |
| Usage records | `usageRecords` table (cloud) | optional `projectId` |
| LLM config (BYOK) | `projects` table (cloud) | per-project `llmProvider/Model/Key` |

---

## Missing Per-Project Configuration

The following resources exist but are **not project-scoped in the self-hosted framework**:

### 1. Agents
- **Gap**: Agents have no `projectId`. You cannot list "agents in project X" or prevent an agent from being used in another project.
- **Impact**: When you switch projects, all agents from all projects are still visible/callable.

### 2. Cron Jobs
- **Gap**: Cron jobs have no `projectId`. A scheduled task referencing an agent doesn't inherit project context.
- **Impact**: No way to pause all cron jobs for a project, or see only the scheduled tasks for the current project.

### 3. Skills
- **Gap**: Skills are user-global. There's no concept of "skills available only in project X."
- **Impact**: Every agent in every project sees the same skill catalog. Project-specific tools cannot be isolated.

### 4. Sessions
- **Gap**: Sessions have no `projectId`. You cannot filter "active sessions in project X."
- **Impact**: Session dashboards show all sessions across all projects.

### 5. MCP Connections / Integrations
- **Gap**: MCP connections have no `projectId`. A connection to a third-party tool is global to the user.
- **Impact**: Cannot have different MCP tool sets for different projects (e.g., dev project uses sandbox MCP, prod project uses production MCP).

### 6. API Keys / Vault
- **Gap**: API keys and vault entries have no `projectId`. All secrets are user-global.
- **Impact**: Cannot scope LLM API keys, webhooks, or credentials to a specific project.

### 7. Workspace Configuration
- **Gap**: The `agentforge.config.ts` file is a single monolithic config. No per-project workspace roots, skills directories, or sandbox configs.
- **Impact**: If you have two projects (dev + prod), they share the same workspace filesystem, sandbox settings, and skill registry.

### 8. Failover Chains
- **Gap**: The global `failover.defaultChain` in `agentforge.config.ts` applies to all agents across all projects.
- **Impact**: Cannot configure "project A uses only OpenAI, project B uses only Anthropic" at the project level.

### 9. Channels / Integrations
- **Gap**: Telegram, WhatsApp, and other channels are user-global with no project scoping.
- **Impact**: Cannot have a Telegram bot scoped to project A and a WhatsApp integration scoped to project B.

### 10. Project Settings Schema
- **Gap**: `projects.settings` is `v.any()` with no defined structure.
- **Impact**: No type safety, no discoverability of what project settings are supported.

---

## Proposed Architecture

### Design Principles
1. **Backward compatibility**: Global (user-level) resources continue to work as today.
2. **Opt-in project scoping**: Adding `projectId` is additive. Resources without `projectId` are treated as global/shared.
3. **Explicit project config**: Replace `settings: v.any()` with a typed `ProjectConfig` structure.
4. **CLI awareness**: All CLI commands should accept `--project <id>` and default to the active project from settings.
5. **Config cascade**: Per-project config overrides global config (agent failover > project failover > global failover).

---

### 1. Enhanced Project Schema

```typescript
// Proposed: projects table with typed settings
projects: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  userId: v.optional(v.string()),

  // Lifecycle
  status: v.union(v.literal("active"), v.literal("paused"), v.literal("archived")),

  // LLM configuration (per-project BYOK — mirrors cloud)
  llmProvider: v.optional(v.string()),
  llmModel: v.optional(v.string()),
  llmApiKeyRef: v.optional(v.id("vault")),  // Reference to vault entry

  // Workspace configuration
  workspaceConfig: v.optional(v.object({
    basePath: v.optional(v.string()),
    skills: v.optional(v.array(v.string())),
    search: v.optional(v.boolean()),
  })),

  // Failover configuration override
  failoverConfig: v.optional(v.object({
    defaultChain: v.optional(v.array(v.object({
      provider: v.string(),
      model: v.string(),
    }))),
    timeoutMs: v.optional(v.number()),
  })),

  // Sandbox configuration override
  sandboxConfig: v.optional(v.object({
    provider: v.optional(v.string()),
    dockerImage: v.optional(v.string()),
    timeoutSeconds: v.optional(v.number()),
  })),

  // Environment variables for agents in this project
  env: v.optional(v.any()),

  // Arbitrary extra settings (backwards compat)
  settings: v.optional(v.any()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
```

---

### 2. Add `projectId` to All Configurable Resources

```typescript
// agents: add optional projectId
agents: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW

// skills: add optional projectId
skills: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
  scope: v.optional(v.union(v.literal("global"), v.literal("project"))),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW

// cronJobs: add optional projectId
cronJobs: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW

// sessions: add optional projectId
sessions: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW

// mcpConnections: add optional projectId
mcpConnections: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW

// vault / apiKeys: add optional projectId
vault: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW

// channels: add optional projectId
channels: defineTable({
  ...existing,
  projectId: v.optional(v.id("projects")),  // NEW
})
  .index("byProjectId", ["projectId"])  // NEW
```

---

### 3. Config Cascade Logic

When resolving config for an agent, apply this cascade:

```
Agent config
  └─ overrides Project config
        └─ overrides Global config (agentforge.config.ts)
              └─ overrides System defaults
```

Example for failover:
```typescript
function resolveFailoverChain(agent, project, globalConfig) {
  // Agent-level failoverModels take priority
  if (agent.failoverModels?.length) return agent.failoverModels;
  // Project-level failover config next
  if (project?.failoverConfig?.defaultChain?.length)
    return project.failoverConfig.defaultChain;
  // Global config default chain
  if (globalConfig.failover?.defaultChain?.length)
    return globalConfig.failover.defaultChain;
  // System default: no failover
  return [];
}
```

---

### 4. CLI Enhancement: Project-Aware Commands

All resource-management CLI commands should gain `--project` flags and respect the active project:

```bash
# Current (no project awareness)
agentforge agents list
agentforge cron list
agentforge skills list

# Proposed (project-scoped)
agentforge agents list --project <id>        # List only agents in project
agentforge agents create --project <id>      # Create agent in project
agentforge cron list --project <id>          # List only cron jobs in project
agentforge skills install web-search --project <id>  # Install skill for project only
agentforge mcp list --project <id>           # List MCP connections in project
agentforge keys list --project <id>          # List secrets scoped to project
```

The `projects switch` command already stores `activeProject` in settings. CLI commands should read this to default to the active project when `--project` is not specified:

```typescript
async function resolveProjectId(opts: { project?: string }): Promise<string | undefined> {
  if (opts.project) return opts.project;
  // Read active project from settings
  const setting = await client.query('settings:get', { userId: 'cli', key: 'activeProject' });
  return setting?.value;
}
```

---

### 5. `agentforge.config.ts` Multi-Project Support

The config file should support per-project overrides:

```typescript
export default {
  name: 'my-workspace',
  version: '1.0.0',

  // Global defaults
  workspace: { basePath: './workspace', skills: ['/skills'], search: true },
  failover: { defaultChain: [...], retryPolicy: {...} },
  sandbox: { provider: 'local', docker: {...} },
  env: { COMPANY_NAME: 'Acme Inc' },

  // Per-project configuration (NEW)
  projects: {
    'production': {
      // Override workspace for this project
      workspace: { basePath: './workspace/prod', skills: ['/skills', '/prod-skills'] },
      // Override failover for this project
      failover: { defaultChain: [{ provider: 'anthropic', model: 'claude-opus-4-6' }] },
      // Override sandbox
      sandbox: { provider: 'e2b' },
      // Project-level env vars
      env: { API_ENDPOINT: 'https://api.prod.example.com' },
      // Scoped agents (only these agents are available in this project)
      agents: ['customer-support', 'billing-agent'],
      // Scoped skills
      skills: ['web-search', 'api-tester'],
    },
    'development': {
      workspace: { basePath: './workspace/dev' },
      sandbox: { provider: 'local' },
      agents: ['dev-assistant', 'code-reviewer'],
    },
  },

  // Agents list (unchanged — agents can also declare projectId)
  agents: [...],
};
```

---

### 6. Project Deletion Cascade

The current `projects:remove` mutation only cascades to threads, files, and folders. It must be extended:

```typescript
// Proposed cascade on project delete:
// 1. Disable all cronJobs with projectId
// 2. Terminate all active sessions with projectId
// 3. Deactivate all agents with projectId (soft delete)
// 4. Optionally uninstall project-scoped skills
// 5. Revoke project-scoped API keys / vault entries
// 6. Remove project-scoped MCP connections
// 7. Delete threads and files (existing behavior)
// 8. Delete the project record
```

---

## Existing Linear Coverage

Based on the issue IDs mentioned, cross-referencing with findings:

### AGE-81: Workspace CLI Commands
- **Overlap**: The `projects switch` command stores `activeProject` in settings but no CLI command consumes it. Per-project workspace config (proposed `workspaceConfig` field on projects) would directly address this — workspace commands should respect the active project.
- **Gap**: Workspace commands (`agentforge workspace ...`) don't exist yet. The proposed architecture adds per-project `workspaceConfig` with `basePath`, `skills`, `search` fields.

### AGE-80: Tool Safety
- **Overlap**: Per-project `sandboxConfig` addresses tool safety by scoping sandbox providers per project. The project-level failover config (agent tool choices per project) is adjacent.
- **Gap**: Tool safety currently applies globally. Per-project config would allow stricter sandbox settings in production projects vs. development projects.

### AGE-79: LocalSandbox
- **Overlap**: The proposed `sandboxConfig` per project field (`provider: 'local' | 'docker' | 'e2b' | 'none'`) directly extends LocalSandbox configuration to be per-project.
- **Gap**: Today `sandbox.provider` in `agentforge.config.ts` is global. Adding per-project override is the key enhancement.

### AGE-74: Consolidate E2B Sandbox
- **Overlap**: E2B sandbox is one of the `sandboxConfig.provider` options in the proposed per-project config. Consolidating E2B into the sandbox abstraction (AGE-74) should happen before or alongside per-project sandbox config to avoid adding E2B-specific fields to the project schema.
- **Recommendation**: Complete AGE-74 first, then add the consolidated sandbox config to the per-project settings.

### AGE-75: Agent Skills Specification
- **Overlap**: Skills are currently user-global with no project scoping. The proposed `skills` table enhancement (add `projectId` and `scope: 'global' | 'project'`) is the data model change needed to support project-scoped skills installation. The SKILL.md format from AGE-75 remains unchanged.
- **Gap**: The `skills install` CLI command has no `--project` flag. Project-scoped skills install is a new capability needed on top of AGE-75's specification work.

---

## Summary of Findings

| Area | Self-Hosted Status | Cloud Status | Gap |
|------|-------------------|--------------|-----|
| Agents per project | Not scoped | Fully scoped | Add `projectId` to agents table |
| Skills per project | Not scoped | Not in schema | Add `projectId` + `scope` to skills |
| Cron jobs per project | Not scoped | Not in schema | Add `projectId` to cronJobs |
| Sessions per project | Not scoped | Not in schema | Add `projectId` to sessions |
| MCP connections per project | Not scoped | Not in schema | Add `projectId` to mcpConnections |
| API keys/vault per project | Not scoped | Optional projectId | Add `projectId` to vault |
| Channels per project | Not scoped | Not in schema | Add `projectId` to channels |
| LLM config per project | Not present | `llmProvider/Model/Key` | Port cloud pattern to self-hosted |
| Workspace config per project | Not present | Not present | New: `workspaceConfig` on projects |
| Failover config per project | Not present | Not present | New: `failoverConfig` on projects |
| Sandbox config per project | Not present | Not present | New: `sandboxConfig` on projects |
| CLI project awareness | `switch` only | N/A | Add `--project` flag to all commands |
| Project deletion cascade | Partial | Soft delete only | Extend cascade to all resources |
| Project settings schema | `any` (untyped) | `any` (untyped) | Define typed ProjectConfig structure |
