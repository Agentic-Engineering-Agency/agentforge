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
| AI Framework | Mastra (`@mastra/core ^1.5.0`) |
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

### LLM Providers Supported (Mastra model router)
All providers use `"provider/model-name"` format. No Vercel AI SDK.
`openai`, `anthropic`, `google`, `mistral`, `deepseek`, `xai`, `openrouter`, `cohere`, `meta`, `custom`

> ⚡ **Architecture Decision (Feb 22, 2026):** Vercel AI SDK removed. Mastra handles all model routing.

---

## 👥 Concurrent Development Tracks

### Track A: Lalo + Puck (Architecture & Infrastructure)
**Owns:** `convex/schema.ts`, `convex/workflows/`, `convex/migrations/`, `docs/DESIGN-*.md`
**Focus:** Database schema, infrastructure, Mastra backend, workflow engine

### Track B: Luci + Seshat (Core Engine + Product)
**Owns:** `convex/llmProviders.ts`, `convex/mastraIntegration.ts`, `convex/chat.ts`, `packages/core/`, `packages/web/`, `packages/cli/`, `packages/channels*`, `.github/workflows/`
**Focus:** LLM providers, Mastra migration, Dashboard UI, integrations, DevOps

> **Note:** Luci may work on tasks from both tracks. Coordinate via Linear.

**⚠️ Sync Point:** AGE-106 (schema, owned by Lalo/Puck) must merge before AGE-107 (files) or any feature using `projectId` can start.

---

## 🛡️ SpecSafe Workflow (MANDATORY)

```
specsafe new "<name>"          →  Create spec (gets SPEC-ID)
specsafe spec <id>             →  Validate & enhance with AI → SPEC stage
specsafe test-create <id>      →  Generate tests → TEST stage
specsafe test-apply <id>       →  Implementation guidance → CODE stage
[implement code]               →  Make tests pass (RED → GREEN → REFACTOR)
specsafe verify <id>           →  Run tests, loop on failure
specsafe qa <id>               →  QA validation → QA stage
specsafe done <id>             →  Complete & archive → DONE
```

**⚠️ DO NOT USE:** `specsafe test` (ambiguous), `specsafe complete` (deprecated), `specsafe code` (doesn't exist).

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

## 🚀 Current Sprint: Phase 0 → Phase 1

### Phase 0 — Synchronization (Immediate, sequential)
| Session | Track | Task | Branch |
|---------|-------|------|--------|
| **0.1** | B (Luci/Seshat) | Mastra-Native Migration (remove Vercel AI SDK) | `feat/session-0.1-mastra-migration` |
| **0.2** | A (Lalo/Puck) | Global vs Project Config Design Doc | `docs/session-0.2-project-config-design` |

**Session 0.1:** Remove `ai`, `@ai-sdk/*` deps. Refactor `convex/mastraIntegration.ts` + `convex/chat.ts` to use Mastra Agent.generate(). Upgrade `@mastra/core` to ^1.5.0. Rebuild CLI dist.
**Session 0.2:** Write `docs/DESIGN-PROJECT-CONFIG.md` classifying all 20 tables as global/project-scoped/both.

### Sprint 1.1 (After Phase 0 — parallel)
| Session | Track | Issue | Task | Branch |
|---------|-------|-------|------|--------|
| **1.1A** | B (Luci/Seshat) | AGE-105 | LLM Models Update (Mastra format) | `feat/AGE-105-update-llm-models` |
| **1.1B** | A (Lalo/Puck) | AGE-106 | Project-scoped Schema Refactor | `feat/AGE-106-project-scoped-schema` |

> 🔒 **SYNC POINT:** AGE-106 must merge to main before Sprint 1.2 begins.

### Sprint 1.2 (After AGE-106 merges — parallel)
| Session | Track | Issue | Task | Branch |
|---------|-------|-------|------|--------|
| **1.2A** | A (Lalo/Puck) | AGE-104 | Mastra Workflows Engine | `feat/AGE-104-mastra-workflows` |
| **1.2B** | B (Luci/Seshat) | AGE-107 | File Uploads + R2 Backend | `feat/AGE-107-file-uploads` |
| **1.2B** | B (Luci/Seshat) | AGE-108 | CI: Automate CLI Build | `feat/AGE-108-ci-build` |
| **1.2B** | B (Luci/Seshat) | AGE-41 | Discord Channel Adapter | `feat/AGE-41-discord-adapter` |

**Full execution order + Claude Code session prompts:** See Notion Concurrent Dev Plan.

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

---

## 🛡️ MANDATORY DEVELOPMENT PROCESS

> These rules apply to ALL agents, ALL sprints, ALL sessions. No exceptions.

### SpecSafe-First (NON-NEGOTIABLE)

**Order of operations — every time, no shortcuts:**

| Step | Action |
|------|--------|
| 1 | **Write tests first** — before any implementation |
| 2 | **Implement** — only after tests exist |
| 3 | **Run `pnpm test`** — all tests must pass |
| 4 | **Fix failures** — if tests fail, fix before proceeding |

```bash
# TDD workflow
specsafe new <feature>   # Create spec
# write test expectations
pnpm test                # Watch fail (red)
# implement
pnpm test                # Must be green before PR
```

### Research Official Docs First

Before implementing ANYTHING involving Mastra, Convex, or any external dependency:

1. **Read the current docs** — APIs break between minor versions
2. **Check for breaking changes** — especially Mastra (updates weekly)
3. **Never assume from prior context** — always verify

- Mastra: https://mastra.ai/docs
- Convex: https://docs.convex.dev
- @mastra/s3 (R2): https://mastra.ai/reference/workspace/s3-filesystem

### CLI-First Development

Every feature: **CLI first → dashboard second**

```bash
agentforge <command>   # 1. Implement + test here
# then replicate in dashboard/app/routes/...
```

### Mastra 1.8.0 BYOK — OpenAICompatibleConfig

```typescript
// ✅ Use OpenAICompatibleConfig (official API)
new Agent({
  model: {
    providerId: provider,                    // 'openai' | 'anthropic' | 'openrouter'
    modelId:    getBaseModelId(provider, id), // ALWAYS strip provider prefix!
    apiKey,
    url: getProviderBaseUrl(provider),       // needed for OpenRouter, Mistral, etc.
  }
})

// ❌ Never use magic strings — Mastra 1.8.0 does not strip the prefix
// 'openai/gpt-4.1' → OpenAI API receives 'openai/gpt-4.1' → 404
// 'openrouter/auto' + provider 'openrouter' → 'openrouter/openrouter/auto' → 400
```

### Convex Runtime Rules

```typescript
// "use node" files: ONLY actions/internalActions
// Default runtime: queries + mutations + regular actions

// ✅ Correct split
// chat.ts (default) — queries, mutations, actions
// chatActions.ts ("use node") — Node.js-dependent internalActions
```
