# AGENTS.md — AgentForge AI Development Team

> **For AI coding assistants:** Read `CLAUDE.md` for the full project context and SpecSafe workflow.  
> This file documents the human+AI team structure and agent configuration.

---

## 👥 Team Structure

### Track A: Core Engine (Luci + Seshat)

| | |
|---|---|
| **Humans** | Luci (Fernando Ramos) |
| **AI Agent** | Seshat (Claude Code, claude-opus-4-6 lead / claude-sonnet-4-6 teammates) |
| **Role** | Core Engine |
| **Focus** | LLM provider registry, core framework, Mastra backend, workflow engine |

**Owned files/directories:**
- `convex/llmProviders.ts` — LLM provider + model registry
- `convex/mastraIntegration.ts` — Mastra AI framework bridge
- `convex/workflows/` — Workflow engine (Mastra Workflows)
- `packages/core/` — `@agentforge-ai/core` (Agent, SandboxManager, MCPServer, browser tools)
- `specs/active/SPEC-AGE-105*.md`

**Active task:** AGE-105 — Update LLM models list (Mistral, DeepSeek, Claude 4.6, Gemini 3)

---

### Track B: Architecture + Product (Lalo + Puck)

| | |
|---|---|
| **Humans** | Lalo |
| **AI Agent** | Puck (Claude Code, claude-opus-4-6 lead / claude-sonnet-4-6 teammates) |
| **Role** | Architecture + Product |
| **Focus** | Database schema, Dashboard UI, channel integrations, DevOps |

**Owned files/directories:**
- `convex/schema.ts` — Convex database schema (source of truth for all tables)
- `packages/web/` — Dashboard frontend (React + Vite + TanStack Router)
- `packages/cli/` — `@agentforge-ai/cli` — `agentforge` CLI tool
- `packages/channels/` — `@agentforge-ai/channels` — Base channel abstractions
- `packages/channels-telegram/` — `@agentforge-ai/channels-telegram`
- `.github/workflows/` — GitHub Actions CI/CD
- `specs/active/SPEC-AGE-106*.md`, `SPEC-AGE-107*.md`, `SPEC-AGE-108*.md`, `SPEC-AGE-41*.md`

**Active task:** AGE-106 — Project-scoped Convex schema refactor (multi-tenancy)
**Next tasks (Sprint 1.2):** AGE-107 (Files UI), AGE-108 (CI), AGE-41 (Discord Adapter)

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
| **Mastra** (`@mastra/core ^1.4.0`) | AI agent orchestration, workflows, tools |
| **Docker** | Sandbox container execution (E2B-compatible) |
| **Playwright** | Browser automation inside agents |

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

### LLM Providers (convex/llmProviders.ts)
`openai`, `openrouter`, `anthropic`, `google`, `venice`, `custom`

Models to add (AGE-105): Mistral (large/small), DeepSeek (chat/coder), Claude 4.6 (opus/sonnet/haiku), Gemini 3 (Pro/Flash)

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
specsafe new "description"   →  Create spec (get SPEC-ID)
specsafe spec <id>           →  Define requirements → SPEC stage
specsafe test <id>           →  Generate tests → TEST stage
[write code to pass tests]
specsafe qa <id>             →  Validate → QA stage
specsafe complete <id>       →  Done → COMPLETE
```

**Claude Code slash commands available:**
- `/specsafe` — Show project status
- `/spec <id>` — Show spec details
- `/validate` — Validate implementation against active spec

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

### Sprint 1.1 — Active (parallel)
| Track | Issue | Task | Branch |
|-------|-------|------|--------|
| **A (Luci/Seshat)** | AGE-105 | LLM Models Update | `feat/AGE-105-update-llm-models` |
| **B (Lalo/Puck)** | AGE-106 | Schema Refactor (multi-tenancy) | `feat/AGE-106-project-scoped-schema` |

### Sprint 1.2 — After AGE-106 merges
```
Track A ──── AGE-104  Mastra Workflows Engine
Track B ──┬─ AGE-108  CI: Automate CLI Build    ← independent, start immediately
           ├─ AGE-41   Discord Channel Adapter   ← independent, start immediately
           └─ AGE-107  File Uploads (R2)         ← wait for AGE-106 schema
```
| Track | Issue | Task | Branch |
|-------|-------|------|--------|
| **A (Luci/Seshat)** | AGE-104 | Mastra Workflows Engine | `feat/AGE-104-mastra-workflows` |
| **B (Lalo/Puck)** | AGE-107 | File Uploads + R2 Backend | `feat/AGE-107-file-uploads` |
| **B (Lalo/Puck)** | AGE-108 | CI: Automate CLI Build | `feat/AGE-108-ci-build` |
| **B (Lalo/Puck)** | AGE-41 | Discord Channel Adapter | `feat/AGE-41-discord-adapter` |

---

## 🔗 Resources

- **Linear:** https://linear.app/agentic-engineering/project/feature-parity-roadmap-1c3d0bf871f8/overview
- **Feature Parity Comparison:** https://www.notion.so/Feature-Parity-Manus-vs-OpenClaw-vs-AgentForge-30a20287fd618160b054d463cd8911a3
- **Concurrent Dev Plan:** `CONCURRENT_PLAN.md` (this repo)
- **Project State:** `PROJECT_STATE.md` (this repo)
- **GitHub:** https://github.com/Agentic-Engineering-Agency/agentforge
