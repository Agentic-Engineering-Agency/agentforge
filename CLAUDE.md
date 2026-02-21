# AgentForge — Claude Code Configuration

You are working on **AgentForge**, a minimalist framework for collaborative AI agents.
This project uses **SpecSafe spec-driven development (SDD)** — no code is written without a spec.

---

## 📋 Always Read First

1. **`PROJECT_STATE.md`** — Active specs, their stages, next tasks, track assignments
2. **`CONCURRENT_PLAN.md`** — Full development roadmap (Track A / Track B)
3. **`specs/active/*.md`** — The spec you are working on

---

## 🏗️ Project Architecture

### Monorepo Structure
```
agentforge/
├── packages/
│   ├── core/          # @agentforge-ai/core — Agent primitives, sandbox, MCP server
│   ├── cli/           # @agentforge-ai/cli — CLI tool (agentforge init/deploy/etc.)
│   ├── channels/      # @agentforge-ai/channels — Base messaging channel abstractions
│   ├── channels-telegram/ # @agentforge-ai/channels-telegram — Telegram adapter
│   ├── sandbox/       # Sandbox execution environment
│   └── web/           # Dashboard UI (React/Vite)
├── convex/            # Convex serverless backend (database + actions + mutations)
│   ├── schema.ts      # ⚠️ Database schema — Track B owns this (AGE-106)
│   ├── agents.ts      # Agent CRUD operations
│   ├── projects.ts    # Project management
│   ├── threads.ts     # Conversation threads
│   ├── messages.ts    # Message storage
│   ├── files.ts       # File storage
│   ├── skills.ts      # Skills registry
│   ├── mastraIntegration.ts  # Mastra AI framework integration
│   └── workflows/     # Mastra Workflows engine (stub — needs implementation)
├── specs/
│   ├── active/        # Current specs in progress
│   ├── completed/     # Finished specs
│   └── archive/       # Historical specs (pre-SpecSafe)
└── tests/             # E2E tests
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Language | TypeScript (ESM, strict) |
| Package Manager | pnpm 9.15.4 (workspaces) |
| Backend | Convex (serverless DB + realtime) |
| AI Framework | Mastra (`@mastra/core ^1.4.0`) |
| Test Runner | Vitest |
| Frontend | React + Vite (packages/web) |
| Sandbox | Docker (E2B-compatible) |
| Browser Automation | Playwright (packages/core/browser-tool.ts) |
| Channels | WhatsApp, Telegram (packages/channels-*) |
| CI/CD | GitHub Actions |
| Node Version | >=18.0.0 |

### Key Exported APIs (packages/core)
- `Agent` — Core agent class with multi-provider LLM + failover
- `SandboxManager` — Docker container isolation
- `MCPServer` — MCP server for tool exposure
- `BrowserSessionManager` / `BrowserActionExecutor` — Browser automation

### LLM Providers Supported
`openai`, `openrouter`, `anthropic`, `google`, `venice`, `custom`

---

## 👥 Concurrent Development Tracks

### Track A: Luci + Seshat (Core Engine)
**Owns:** `convex/llmProviders.ts`, `convex/mastraIntegration.ts`, `convex/workflows/`, `packages/core/`
**Focus:** LLM provider registry, core framework, Mastra backend, workflow engine

### Track B: Lalo + Puck (Architecture + Product)
**Owns:** `convex/schema.ts`, `packages/web/`, `packages/channels*`, `packages/cli/`, `.github/workflows/`
**Focus:** Database schema, Dashboard UI, channel integrations, DevOps

**⚠️ Sync Point:** AGE-106 (schema, owned by Lalo/Puck) must merge before AGE-107 (files) or any feature using `projectId` can start.

---

## 🛡️ SpecSafe Workflow (MANDATORY)

```
specsafe new "<name>"     →  Create spec  (gets SPEC-ID)
specsafe spec <id>        →  Define requirements, move to SPEC stage
specsafe test <id>        →  Generate tests, move to TEST stage
[implement code]          →  Make tests pass (RED → GREEN → REFACTOR)
specsafe qa <id>          →  Validate, move to QA stage
specsafe complete <id>    →  Archive spec, move to COMPLETE
```

### Rules

✅ **ALWAYS** read `PROJECT_STATE.md` before touching any code  
✅ **ALWAYS** run `specsafe status` to see what's active  
✅ **ALWAYS** reference spec ID in commit messages: `feat(AGE-106): ...`  
✅ **ALWAYS** run tests: `pnpm test` before marking complete  
✅ **ALWAYS** work on a branch: `feat/AGE-{number}-{description}` or `fix/AGE-{number}-{description}`  
✅ **ALWAYS** push branch directly to main (no develop branch)  

❌ **NEVER** edit `PROJECT_STATE.md` directly — use `specsafe` CLI  
❌ **NEVER** write code before a spec exists  
❌ **NEVER** commit without a passing test  
❌ **NEVER** push to `main` directly — always use a feature branch  
❌ **NEVER** edit files owned by the other track without coordination  

---

## 🚀 Current Sprint: Phase 1

### Sprint 1.1 (Active — parallel start)
| Track | Task | Branch |
|-------|------|--------|
| **A (Luci/Seshat)** | AGE-105 — Update LLM models list | `feat/AGE-105-update-llm-models` |
| **B (Lalo/Puck)** | AGE-106 — Project-scoped Convex schema | `feat/AGE-106-project-scoped-schema` |

**AGE-105:** `convex/llmProviders.ts` — add Mistral (large/small), DeepSeek (chat/coder), Claude 4.6 (opus/sonnet/haiku), Gemini 3 (Pro/Flash).
**AGE-106:** `convex/schema.ts` — add `projectId` to agents, sessions, skills, files, mcpConnections. `projects` table exists. Migration script needed.

### Sprint 1.2 (Starts after AGE-106 merges — SYNC POINT)
```
Track A ─────────────────────── AGE-104 (Mastra Workflows Engine)
Track B ─┬─ AGE-108 (CI)          ← independent, start immediately
          ├─ AGE-41  (Discord)     ← independent, start immediately
          └─ AGE-107 (Files UI)   ← requires AGE-106 schema first
```
| Track | Task | Branch |
|-------|------|--------|
| **A (Luci/Seshat)** | AGE-104 — Mastra Workflows Engine | `feat/AGE-104-mastra-workflows` |
| **B (Lalo/Puck)** | AGE-107 — File Uploads (R2) | `feat/AGE-107-file-uploads` |
| **B (Lalo/Puck)** | AGE-108 — CI: Automate CLI Build | `feat/AGE-108-ci-build` |
| **B (Lalo/Puck)** | AGE-41 — Discord Channel Adapter | `feat/AGE-41-discord-adapter` |

**AGE-104:** `convex/workflows/` — implement Mastra Workflows engine, replace stub, register in `mastra.ts`.
**AGE-107:** `packages/web` + `convex/files.ts` — file explorer UI, R2 upload action, requires `projectId`.
**AGE-108:** `.github/workflows/` — pnpm build on CLI templates in CI.
**AGE-41:** `packages/channels-discord/` — Discord.js v14 adapter mirroring Telegram structure.

---

## 🔧 Useful Commands

```bash
pnpm test              # Run all tests
pnpm test:core         # Run core package tests only
pnpm build             # Build all packages
pnpm typecheck         # TypeScript check
specsafe status        # Show SpecSafe project status
specsafe list          # List all specs
```
