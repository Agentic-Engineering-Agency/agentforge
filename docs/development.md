# Development Guide

> For AI coding assistants: read `CLAUDE.md` for all project rules and `docs/TECH-REFERENCE.md` for Convex + Mastra technical constraints.

---

## Architecture Overview

```
packages/runtime/       <- Mastra daemon (PERSISTENT process)
  src/agent/            <- createStandardAgent() factory
  src/models/registry   <- model registry (capabilities, costs, tiers)
  src/tools/            <- reusable tools (web-search, read-url, datetime, notes)
  src/channels/         <- HTTP (SSE), Discord, Telegram
  src/daemon/           <- AgentForgeDaemon class

packages/cli/           <- CLI (agentforge command)
  templates/default/    <- CANONICAL template source
    convex/             <- Data layer ONLY (no LLM logic)
    dashboard/          <- React UI
    agentforge.config.ts <- daemon config

packages/core/          <- shared types + utilities

convex/                 <- local dev copy (sync with templates/default/convex/)
```

Auth, billing, and cloud hosting are future concerns. Do not implement now.

---

## Development Tracks

### Track A: Runtime & Data Layer
- `packages/runtime/` -- daemon, createStandardAgent(), channels, memory
- `convex/` -- schema, queries/mutations (data-only, no LLM logic)

### Track B: CLI & Dashboard
- `packages/cli/` -- all CLI commands
- `packages/cli/templates/default/dashboard/` -- React UI

---

## Key Rules

### 1. Audit Before Implementing
Before writing any code: search the codebase. Does the feature exist? Is it broken? Is it a stub? Document findings first. Never guess.

### 2. SpecSafe-First Workflow
```
Write tests (watch FAIL) -> implement -> tests GREEN -> PR
Never write code before tests. Never ship with failing tests.
```

### 3. Mastra Never in Convex Actions
```
packages/runtime/   -> where Mastra lives (persistent daemon)
convex/             -> data layer ONLY (no LLM calls, no Mastra imports)
```
Rationale: Convex Node.js actions have cold starts (10-15s), cannot stream, and `crypto.subtle` is too slow for per-request crypto.

### 4. Convex Runtime Boundaries
```typescript
// "use node" files -> ONLY action/internalAction (NEVER query/mutation)
// Default V8 files -> query, mutation, internalQuery, internalMutation

// Use internal.* for server-to-server calls
await ctx.runQuery(internal.agents.getById, { id })
// Never use api.* for internal calls
```

### 5. Memory = ConvexStore (not LibSQL)
```typescript
import { ConvexStore, ConvexVector } from '@mastra/convex'
// Requires: CONVEX_URL + CONVEX_ADMIN_KEY in daemon env
```

### 6. Model Strings
```typescript
model: 'moonshotai/kimi-k2.5'      // default
model: 'openai/gpt-5.1'
model: 'anthropic/claude-opus-4-6'
```

### 7. Tools
```typescript
// execute receives inputData DIRECTLY (not { context })
execute: async ({ query, limit }) => { ... }  // correct
execute: async ({ context: { query } }) => { ... }  // wrong
```

### 8. Template Sync
Every file in `packages/cli/templates/default/convex/` must also exist in:
- `templates/default/convex/`
- `convex/`

Run `pnpm sync-templates` after any change.

---

## QA Gate (Mandatory Before Every PR)

- `pnpm test` -- ALL passing
- `tsc --noEmit` -- 0 errors
- `pnpm audit` -- 0 high/critical
- `agentforge start` + `agentforge chat -m "hello"` -- works end-to-end

---

## Branch & PR Workflow

```bash
git checkout -b feat/my-feature
# work, commit
git push -u origin feat/my-feature
gh pr create
```

Never push directly to `main`.
