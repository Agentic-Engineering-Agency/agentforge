# AGENTS.md — AgentForge AI Development Team

> **For AI coding assistants:** Read `CLAUDE.md` for the full project context, rules, and SpecSafe workflow.

---

## 🚨 SCOPE (Read first)

**This repo is the complete product.** CLI + local dashboard. That's it.

- `packages/cli/` — the CLI (`agentforge` command)
- `packages/core/` — shared types and utilities
- `packages/cli/dist/default/` — local dashboard + Convex functions (what `agentforge create` scaffolds)
- `packages/cli/templates/default/` — must always be identical to `dist/default/`

Everything is built and tested here. Auth, billing, and cloud hosting are future concerns — do not implement them now.

---

## 👥 Team Structure

### Track A: Architecture & Infrastructure
- DB schema, Mastra backend, Convex functions
- Owns: `convex/schema.ts`, `convex/workflows/`, design docs

### Track B: Core Engine + Product
- CLI commands, local dashboard, Mastra integration
- Owns: `packages/cli/`, `packages/core/`, `convex/mastraIntegration.ts`

---

## 🛡️ RULES (NON-NEGOTIABLE)

### 1 · Codebase Audit First
Before writing any code, test the feature against the live Convex deployment. Does it exist? Is it broken? Is it a stub? Document findings before touching anything.

### 2 · SpecSafe-First
```
Write tests → watch them FAIL → implement → tests GREEN → ship
```
Never write code before tests. Never ship with failing tests.

### 3 · Research Official Docs Before Every Sprint
APIs change constantly. Read before implementing:
- Mastra: https://mastra.ai/docs
- Convex: https://docs.convex.dev
- Mastra Workspace / Skills: https://mastra.ai/docs/workspace/skills
- Convex file storage: https://docs.convex.dev/file-storage
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions

### 4 · CLI First → Local Dashboard Second
1. CLI command → tested against live Convex
2. Local dashboard (`dist/default/`) → view layer only

### 5 · Mastra-Native
- Skills = SKILL.md folders (agentskills.io standard) — never `createTool` arrays
- Use `Agent.stream()` / `Agent.generate()` — never raw AI SDK calls
- Use `OpenAICompatibleConfig { providerId, modelId, apiKey }` — never magic model strings
- Use Mastra Workflow API for orchestration

### 6 · Convex Runtime Boundaries
- `"use node"` files: only `action` / `internalAction`
- Default runtime: queries + mutations
- Never call `internal.*` via `api.*`

### 7 · No Hardcoded Model Lists
Fetch from provider API when key is added → cache in DB → UI reads DB. Static fallback only if fetch fails.

### 8 · No Fake Implementations
No placeholders shipped. File upload stores bytes. Streaming streams tokens. Skills are SKILL.md folders.

### 9 · QA + Security After Every Sprint
`pnpm test` all green → validate all mutation inputs → live test on `<your-convex-deployment>` → document results.

### 10 · dist/default ≡ templates/default
Any change to `dist/default/` must be made identically in `templates/default/`. Always.

### 11 · Claude Code Agent Teams (Preferred)
Z.ai is configured. Try `claude --dangerously-skip-permissions --print "..."` first. Fall back only if it actually fails.

---

## ⚠️ Convex Must Be Initialized Before Testing

```bash
npx convex dev --once   # run inside /tmp/agentforge-test/agentforge-test
```

Unit tests mock Convex. Real verification requires a live deployment.

**Confirmed working (2026-02-27):** `executeAgent`, `chat.sendMessage`, `apiKeys.create`, `agents.list`

---

## 📦 Live Test Deployment

```
Deployment: <your-convex-deployment>.convex.cloud
Dir:        /tmp/agentforge-test/agentforge-test
```
