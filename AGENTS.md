# AGENTS.md — AgentForge AI Development Team

> **For AI coding assistants:** Read `CLAUDE.md` for all project rules. Read `docs/TECH-REFERENCE.md` for Convex + Mastra technical constraints.

---

## 🚨 SCOPE

This repo is the complete product: `packages/runtime/` (daemon) + `packages/cli/` (CLI) + `packages/core/` (shared) + `packages/cli/dist/default/` (scaffolded project template).

Auth, billing, and cloud hosting are future concerns. Do not implement now.

---

## Architecture Overview

```
packages/runtime/       ← Mastra daemon (PERSISTENT process)
  src/agent/            ← createStandardAgent() factory
  src/models/registry   ← model registry (capabilities, costs, tiers)
  src/tools/            ← reusable tools (web-search, read-url, datetime, notes)
  src/channels/         ← HTTP (SSE), Discord, Telegram
  src/daemon/           ← AgentForgeDaemon class

packages/cli/           ← CLI (agentforge command)
  templates/default/    ← CANONICAL template source
    convex/             ← Data layer ONLY (no LLM logic)
    dashboard/          ← React UI
    agentforge.config.ts ← daemon config

packages/core/          ← shared types + utilities

convex/                 ← local dev copy (sync with templates/default/convex/)
```

---

## 👥 Team Structure

### Track A: Runtime & Data Layer
- `packages/runtime/` — daemon, createStandardAgent(), channels, memory
- `convex/` — schema, queries/mutations (data-only, no LLM logic)
- Owns SPEC-020 (runtime), SPEC-021 (channels), SPEC-022 (Convex cleanup)

### Track B: CLI & Dashboard
- `packages/cli/` — all CLI commands
- `packages/cli/templates/default/dashboard/` — React UI
- Owns SPEC-023 (CLI runtime commands), SPEC-024 (security hardening)

---

## 🛡️ NON-NEGOTIABLE RULES

### 1 · Audit First
Before writing any code: search the codebase. Does the feature exist? Is it broken? Is it a stub? Document findings first. Never guess.

### 2 · SpecSafe-First
```
Write tests (watch FAIL) → implement → tests GREEN → PR
Never write code before tests. Never ship with failing tests.
```

### 3 · Read TECH-REFERENCE.md Before Every Sprint
`docs/TECH-REFERENCE.md` — covers:
- Convex runtime boundaries (V8 vs Node.js)
- Mastra Agent API (model strings, memory, tools, streaming)
- @mastra/convex (ConvexStore + ConvexVector) — correct integration
- AES-256-GCM encryption pattern for Convex Node.js actions
- createStandardAgent() pattern
- Channel adapter pattern + progressive streaming

### 4 · The Most Important Rule: Mastra Never in Convex Actions
```
✅ packages/runtime/ → where Mastra lives (persistent daemon)
❌ convex/chat.ts → DELETED — never put LLM calls in Convex actions
❌ convex/lib/agent.ts → DELETED
❌ convex/mastraIntegration.ts → DELETED
```
Rationale: Convex Node.js actions have cold starts (10-15s), can't stream, and crypto.subtle is too slow for per-request crypto. Mastra is a persistent runtime, not a serverless function.

### 5 · Convex Runtime Rules
```typescript
// "use node" files → ONLY action/internalAction (NEVER query/mutation)
// Default V8 files → query, mutation, internalQuery, internalMutation

// ✅ Internal function calls
await ctx.runQuery(internal.agents.getById, { id })
// ❌ Wrong pattern
await ctx.runQuery(api.agents.getById, { id })
```

### 6 · Memory = ConvexStore (not LibSQL)
```typescript
// ✅ Central daemon uses @mastra/convex for memory
import { ConvexStore, ConvexVector } from '@mastra/convex'
// Requires: CONVEX_URL + CONVEX_ADMIN_KEY in daemon env

// ❌ LibSQL = local SQLite file, wrong for central daemon
import { LibSQLStore } from '@mastra/libsql'
```

### 7 · Model Strings
```typescript
// ✅ Mastra format: provider/model
model: 'moonshotai/kimi-k2.5'      // default
model: 'openai/gpt-5.1'
model: 'anthropic/claude-opus-4-6'

// ❌ Old pattern — removed
model: { providerId, modelId, apiKey, url }
```

### 8 · Tools
```typescript
// execute receives inputData DIRECTLY (not { context })
execute: async ({ query, limit }) => { ... }  // ✅
execute: async ({ context: { query } }) => { ... }  // ❌
```

### 9 · Template Sync
Every file in `packages/cli/templates/default/convex/` must also exist in:
- `packages/cli/dist/default/convex/`
- `templates/default/convex/`
- `convex/`
Run `pnpm sync-templates` after any change.

### 10 · Branch + PR — NEVER push to main
```bash
git checkout -b feat/spec-020-runtime
# work, commit
git push -u origin feat/spec-020-runtime
gh pr create
```

### 11 · QA Gate — Mandatory Before Every PR
- `pnpm test` — ALL passing
- `tsc --noEmit` — 0 errors
- `pnpm audit` — 0 high/critical
- `agentforge start` + `agentforge chat -m "hello"` — works end-to-end

---

## Active Specs (Priority Order)

| Spec | Track | Status | Description |
|------|-------|--------|-------------|
| SPEC-020 | A | Ready | `packages/runtime/` — daemon, createStandardAgent, ConvexStore memory, model registry |
| SPEC-021 | A | Blocked on 020 | Channel adapters: HTTP/SSE, Discord, Telegram |
| SPEC-022 | B | Ready | Convex data layer: remove LLM, AES-256-GCM encryption, fix data leak |
| SPEC-023 | B | Blocked on 020+022 | CLI: `agentforge start`, `agentforge chat`, `agentforge deploy` |
| SPEC-024 | B | Blocked on 022 | Security: auth, rate limiting, env validation |
