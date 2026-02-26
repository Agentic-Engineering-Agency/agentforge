# AGENTS.md — AgentForge AI Development Team

> **For AI coding assistants:** Read `CLAUDE.md` for the full project context and SpecSafe workflow.  
> This file documents the human+AI team structure and agent configuration.

---

## 👥 Team Structure

### Track A: Architecture & Infrastructure (Lalo + Puck)

| | |
|---|---|
| **Humans** | Lalo |
| **AI Agent** | Puck (Claude Code, claude-opus-4-6 lead / claude-sonnet-4-6 teammates) |
| **Role** | Architecture & Infrastructure |
| **Focus** | Database schema, infrastructure design, Mastra backend, workflow engine |

**Owned files/directories:**
- `convex/schema.ts` — Convex database schema (source of truth for all tables)
- `convex/workflows/` — Workflow engine (Mastra Workflows)
- `docs/DESIGN-*.md` — Architecture design documents
- `convex/migrations/` — Data migration scripts

**Current task:** Session 0.2 — Global vs Project Config Design
**Next tasks:** AGE-106 (Schema Refactor), AGE-104 (Mastra Workflows)

---

### Track B: Core Engine + Product (Luci + Seshat)

| | |
|---|---|
| **Humans** | Luci (Fernando Ramos) |
| **AI Agent** | Seshat (Claude Code, claude-opus-4-6 lead / claude-sonnet-4-6 teammates) |
| **Role** | Core Engine + Product |
| **Focus** | LLM providers, Mastra migration, Dashboard UI, integrations, DevOps |

**Owned files/directories:**
- `convex/llmProviders.ts` — LLM provider + model registry
- `convex/mastraIntegration.ts` — Mastra AI framework bridge (Mastra-native, no Vercel AI SDK)
- `convex/chat.ts` — Chat endpoint
- `packages/core/` — `@agentforge-ai/core` (Agent, SandboxManager, MCPServer, browser tools)
- `packages/web/` — Dashboard frontend (React + Vite + TanStack Router)
- `packages/cli/` — `@agentforge-ai/cli` — `agentforge` CLI tool
- `packages/channels/` — Channel adapters
- `.github/workflows/` — GitHub Actions CI/CD

**Current task:** Session 0.1 — Mastra-Native Migration (remove Vercel AI SDK)
**Next tasks:** AGE-105 (LLM Models Update), AGE-107 (Files), AGE-108 (CI), AGE-41 (Discord)

> **Note:** Luci may work on tasks from both tracks. Coordinate via Linear to avoid conflicts.

---

## 🤖 Claude Code Agent Teams Configuration

```bash
# Required environment variable
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1

# Launch team lead
claude --model claude-opus-4-6
```

### Spawning a team

```
Create an agent team for [task].
Use claude-opus-4-6 as the team lead and claude-sonnet-4-6 for each teammate.

Teammates should own separate files — never have two teammates editing the same file.
All work must follow SpecSafe TDD: spec → test → code → qa → complete.
```

### Agent roles by task type

| Task type | Lead | Teammates |
|-----------|------|-----------|
| LLM models / core engine | Track A lead (Opus) | providers-teammate, test-teammate |
| Schema refactor | Track B lead (Opus) | schema-teammate, migration-teammate, test-teammate |
| UI feature | Track B lead (Opus) | frontend-teammate, api-teammate, test-teammate |
| Bug fix | Either lead | investigator-teammate × 2–3 (competing hypotheses) |
| Code review | Either lead | security-reviewer, perf-reviewer, test-reviewer |

---

## 🏗️ Tech Stack Reference

### Runtime & Build
| Tool | Version / Notes |
|------|----------------|
| Node.js | >=18.0.0 (tested on v25.6.1) |
| pnpm | 9.15.4 (workspaces) |
| TypeScript | Strict, ESM modules |
| Vitest | Test runner (`pnpm test`) |
| Vite | Frontend bundler |

### Backend
| Tool | Role |
|------|------|
| **Convex** | Serverless DB + realtime subscriptions + actions |
| **Mastra** (`@mastra/core ^1.5.0`) | AI agent orchestration, workflows, tools, 2400+ models via model router |
| **Docker** | Sandbox container execution (E2B-compatible) |
| **Playwright** | Browser automation inside agents |

> ⚡ **Architecture Decision (Feb 22, 2026):** Vercel AI SDK (`ai`, `@ai-sdk/*`) has been removed.
> Mastra handles all model routing natively via `model: "provider/model-name"` format.
> See Notion Concurrent Dev Plan for details.

### Convex Schema (current tables)
| Table | Description | Multi-tenant? |
|-------|-------------|---------------|
| `agents` | Agent definitions (model, instructions, tools) | ⚠️ Needs `projectId` (AGE-106) |
| `projects` | Project workspace container | ✅ Root entity |
| `threads` | Conversation threads | ✅ Has `projectId` |
| `messages` | Messages in threads | via thread |
| `sessions` | Agent sessions | ⚠️ Needs `projectId` (AGE-106) |
| `skills` | Installed skills per workspace | ⚠️ Needs `projectId` (AGE-106) |
| `files` | Uploaded files | ⚠️ Needs `projectId` (AGE-106) |
| `mcpConnections` | MCP server connections | ⚠️ Needs `projectId` (AGE-106) |
| `llmProviders` | Provider + model config | needs update (AGE-105) |

### LLM Providers (Mastra model router format)
All providers use `"provider/model-name"` syntax. Mastra auto-reads env vars.
Supported: `openai`, `anthropic`, `google`, `mistral`, `deepseek`, `xai`, `openrouter`, `cohere`, `meta`, `custom`

Models to add (AGE-105): Full latest catalog from each provider via Mastra's 2400+ model directory.

### Frontend (packages/web)
- React + Vite + TanStack Router 1.x
- Dashboard: agent management, thread viewer, file explorer, skill marketplace
- Note: `@tanstack/router-plugin` has peer dep warning (1.161 expects router 1.160+)

### Published npm Packages
| Package | Status |
|---------|--------|
| `@agentforge-ai/core` | ✅ Active — v0.5.4 |
| `@agentforge-ai/cli` | ✅ Active — v0.5.4 |
| `@agentforge-ai/convex-adapter` | ⚠️ Archived — optional Convex plugin |
| `@agentforge-ai/cloud-client` | ❌ Deprecated — zero dependents |

---

## 📋 SpecSafe Workflow

```
specsafe new "description"        →  Create spec (get SPEC-ID)
specsafe spec <id>                →  Validate & enhance with AI → SPEC stage
specsafe test-create <id>         →  Generate tests → TEST stage
specsafe test-apply <id>          →  Implementation guidance → CODE stage
[write code to pass tests]
specsafe verify <id>              →  Run tests, loop on failure
specsafe qa <id>                  →  QA validation → QA stage
specsafe done <id>                →  Complete & archive → DONE
```

**⚠️ DO NOT USE:** `specsafe test` (ambiguous), `specsafe complete` (deprecated), `specsafe code` (doesn't exist).

**Run `specsafe status` to see active specs. Run `specsafe doctor` to check project health.**

---

## 🌿 Branching Strategy

```
feat/AGE-{number}-{short-description}   →  main
fix/AGE-{number}-{short-description}    →  main
```

- **No develop branch** — feature branches push directly to main
- **One spec per branch**
- **Commit format:** `feat(AGE-106): add projectId to agents table`
- **Sync points:** AGE-106 (Track B) must merge before AGE-107 starts (needs `projectId`). AGE-108 and AGE-41 are independent and can start Sprint 1.2 immediately.

---

## 🚀 Phase 1 Sprint Overview

### Phase 0 — Synchronization (Immediate, sequential)
| Session | Track | Task | Branch |
|---------|-------|------|--------|
| **0.1** | B (Luci/Seshat) | Mastra-Native Migration (remove Vercel AI SDK) | `feat/session-0.1-mastra-migration` |
| **0.2** | A (Lalo/Puck) | Global vs Project Config Design Doc | `docs/session-0.2-project-config-design` |

### Sprint 1.1 — After Phase 0 (parallel)
| Session | Track | Issue | Task | Branch |
|---------|-------|-------|------|--------|
| **1.1A** | B (Luci/Seshat) | AGE-105 | LLM Models Update (Mastra format) | `feat/AGE-105-update-llm-models` |
| **1.1B** | A (Lalo/Puck) | AGE-106 | Schema Refactor (multi-tenancy) | `feat/AGE-106-project-scoped-schema` |

> 🔒 **SYNC POINT:** AGE-106 must merge to main before Sprint 1.2 begins.

### Sprint 1.2 — After AGE-106 merges (parallel)
| Session | Track | Issue | Task | Branch |
|---------|-------|-------|------|--------|
| **1.2A** | A (Lalo/Puck) | AGE-104 | Mastra Workflows Engine | `feat/AGE-104-mastra-workflows` |
| **1.2B** | B (Luci/Seshat) | AGE-107 | File Uploads + R2 Backend | `feat/AGE-107-file-uploads` |
| **1.2B** | B (Luci/Seshat) | AGE-108 | CI: Automate CLI Build | `feat/AGE-108-ci-build` |
| **1.2B** | B (Luci/Seshat) | AGE-41 | Discord Channel Adapter | `feat/AGE-41-discord-adapter` |

---

## 🔗 Resources

- **Linear:** https://linear.app/agentic-engineering/project/feature-parity-roadmap-1c3d0bf871f8/overview
- **Feature Parity Comparison:** https://www.notion.so/Feature-Parity-Manus-vs-OpenClaw-vs-AgentForge-30a20287fd618160b054d463cd8911a3
- **Concurrent Dev Plan:** `CONCURRENT_PLAN.md` (this repo)
- **Project State:** `PROJECT_STATE.md` (this repo)
- **GitHub:** https://github.com/Agentic-Engineering-Agency/agentforge

---

## 🛡️ MANDATORY DEVELOPMENT PROCESS

### Rule 1: SpecSafe-First (NON-NEGOTIABLE)
**Every implementation must follow this exact order:**

1. **Write tests FIRST** — before any code exists, before planning implementation details
2. **Implement** — write the feature/fix only after tests are written
3. **Run tests** — `pnpm test`
4. **Fix failures** — if any test fails, dev agents must fix before proceeding
5. **Never skip** — no exceptions, no "I'll add tests later"

```bash
# Correct order
specsafe new my-feature    # 1. Create spec
# ... write tests in spec ...
pnpm test                  # 2. Watch tests fail (TDD)
# ... implement ...
pnpm test                  # 3. Tests must pass
```

### Rule 2: Research Official Docs (ALWAYS)
APIs change fast. Before implementing ANYTHING:
- **Mastra**: https://mastra.ai/docs (check current version — breaking changes are common)
- **Convex**: https://docs.convex.dev (runtime rules change)
- **Never** rely on memory or prior sessions — always fetch current docs

### Rule 3: CLI-First Development
Every new feature must be implemented in this order:
1. **CLI first** — `agentforge <command>` (testable, no UI dependency)
2. **Dashboard second** — replicate the same logic in the local web UI

The CLI is the source of truth. The dashboard is a view layer.

### Rule 4: Convex Runtime Boundaries
- `"use node"` files: ONLY `action` / `internalAction` functions (no queries, no mutations)
- Default runtime: queries + mutations + non-Node actions
- Never mix runtimes in the same file

### Rule 5: Mastra 1.8.0 Model Config (BYOK)
Use `OpenAICompatibleConfig` — never magic model strings:
```typescript
// ✅ Correct
new Agent({ model: { providerId: 'openai', modelId: 'gpt-4.1', apiKey } })

// ❌ Wrong — Mastra 1.8.0 does NOT strip provider prefix before calling API
new Agent({ model: 'openai/gpt-4.1' })
```
