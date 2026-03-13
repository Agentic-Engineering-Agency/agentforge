# CLAUDE.md — AgentForge Development Context

> Read this file completely before starting any work. All rules are mandatory.
> For deep technical reference on Convex + Mastra integration patterns, read: **`docs/TECH-REFERENCE.md`**

---

## What is AgentForge?

A self-hosted AI agent framework: central daemon (like OpenClaw) + local dashboard. Built on Mastra + Convex.

**Architecture:**
- `packages/runtime/` — Mastra daemon (persistent Node.js process, channels: HTTP/Discord/Telegram)
- `packages/cli/` — CLI: scaffold, manage, start, chat
- `packages/core/` — shared types + utilities
- `packages/cli/dist/default/` / `packages/cli/templates/default/` — what `agentforge create` scaffolds

Auth, billing, and cloud hosting are future concerns. Do not implement them now.

---

## 🚨 RULES — Non-Negotiable

### 1 · Audit Before Implementing
Before writing any code: search the codebase, look for existing implementations. Does it exist? Is it broken? Is it a stub? Document what you find first.

### 2 · SpecSafe-First Workflow
```
1. Write tests (watch them FAIL — proves tests are real)
2. Implement
3. pnpm test — must be GREEN
4. Fix any failures NOW before moving on
```

### 3 · Read docs/TECH-REFERENCE.md Before Every Sprint
Critical rules are documented there. APIs change constantly. Key links:
- Mastra: https://mastra.ai/docs
- Convex: https://docs.convex.dev
- @mastra/convex (storage): https://mastra.ai/reference/storage/convex
- get-convex/mastra (component, NOT used here): https://github.com/get-convex/mastra

### 4 · CLI First → Dashboard Second
1. `agentforge <command>` — implement and test via CLI
2. Dashboard view — comes after CLI works

### 5 · Architecture Rules

#### Mastra belongs in `packages/runtime/` — NEVER in Convex actions
Running Mastra inside Convex Node.js actions produces 10-15s cold starts, no real streaming, and broken crypto. The daemon runs as a persistent process.

```
✅ packages/runtime/ → Mastra agent runtime
✅ convex/ → data layer only (agents config, apiKeys, logs, threads display)
❌ convex/chat.ts → DELETED (never put LLM calls in Convex)
❌ convex/lib/agent.ts → DELETED
❌ convex/mastraIntegration.ts → DELETED
```

#### Memory: use ConvexStore (not LibSQL)
```typescript
// ✅ packages/runtime — use @mastra/convex for memory
import { ConvexStore } from '@mastra/convex'
import { ConvexVector } from '@mastra/convex'

// ❌ Wrong for daemon — LibSQL creates a local SQLite file per project
import { LibSQLStore } from '@mastra/libsql'
```

#### Convex runtime boundaries
```typescript
// "use node" files → ONLY action / internalAction (NEVER query/mutation)
// Default V8 files → query, mutation, internalQuery, internalMutation

// ✅ Call internal functions correctly
await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider })
// ❌ Wrong — api.* is public (client-accessible)
await ctx.runQuery(api.apiKeys.getDecryptedForProvider, { provider })
```

#### API key encryption — Node.js only
```typescript
// ✅ "use node" internalAction with node:crypto
import * as crypto from 'node:crypto'
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

// ❌ Never — crypto.subtle in V8 runtime → 10-19s latency
await crypto.subtle.deriveBits(...)  // too slow for per-request use
```

#### Agent model format
```typescript
// ✅ Mastra model router format
model: 'openai/gpt-5.1'
model: 'anthropic/claude-opus-4-6'
model: 'moonshotai/kimi-k2.5'     // default daemon model

// ❌ Old BYOK pattern — no longer needed
model: { providerId, modelId, apiKey, url }
```

#### Tools — createTool, not magic strings
```typescript
// ✅ Always use createTool from @mastra/core/tools
import { createTool } from '@mastra/core/tools'
export const myTool = createTool({
  id: 'my-tool',
  execute: async ({ query }) => { /* inputData directly, NOT { context } */ }
})
```

#### Streaming
```typescript
// ✅ Always stream for channels
const stream = await agent.stream(messages, { threadId, resourceId })
for await (const chunk of stream.fullStream) { ... }
```

### 6 · Template Sync (3 git-tracked locations)
Every Convex template file must be kept identical in these 3 git-tracked locations:
```
packages/cli/templates/default/convex/  ← CANONICAL SOURCE
templates/default/convex/
convex/
```
`packages/cli/dist/default/convex/` is gitignored — `pnpm sync-templates` handles it at build time.
Use `pnpm sync-templates` after any template change.

### 7 · File Storage
```typescript
// ✅ Real Convex file storage
const uploadUrl = await ctx.storage.generateUploadUrl()
// ❌ Never fake it
url: 'pending-upload'
```

### 8 · QA + Security After Every PR
- `pnpm test` — all green
- `tsc --noEmit` — 0 errors
- `pnpm audit` — 0 high/critical vulnerabilities
- Manual CLI test: `agentforge start`, `agentforge chat`, `agentforge status`
- No hardcoded secrets

---

## Current Status (v0.12.23, March 2026)

### Architecture Redesign Complete
All 7 specs implementing the daemon architecture have been merged:
- **SPEC-020:** `packages/runtime/` package — Done ✓
- **SPEC-021:** Channel adapters (HTTP/Discord/Telegram) — Done ✓
- **SPEC-022:** Convex data layer cleanup (AES-256-GCM encryption) — Done ✓
- **SPEC-023:** CLI runtime commands (`agentforge start`, `agentforge chat`) — Done ✓
- **SPEC-024:** Security hardening (auth guards, rate limiting) — Done ✓
- **SPEC-025:** ResearchOrchestrator Mastra v1.8 compatibility — Done ✓
- **SPEC-026:** Dashboard E2E regression fixes — Done ✓

### Sprint 2 (v0.12.23) — Security + Dashboard
- **#235:** API tokens stored as SHA-256 hashes (plaintext never persisted, `validateByHash` internalQuery)
- **#234:** 26 HTTP channel security integration tests (auth, rate limiting, CORS, sanitization)
- **#237:** Convex boundary cleanup — `crypto.subtle` → `node:crypto`, 42 `api.*` → `internal.*`
- **#233:** Settings page wired to real Convex data (replaced hardcoded state)
- **#240:** Hotfix — `censorMessage` reverted to mutation, `detectSecrets` → `internalQuery`
- **#241:** All 8 dashboard modals migrated to Radix UI Dialog (outside-click + Escape dismissal)
- **#242:** Chat-scoped model override — per-thread model picker with config cascade

### What Works (v0.12.23)
- Full daemon model: `agentforge start` → persistent Mastra runtime
- `agentforge create / status / agents / models / keys / tokens / threads / logs / skills / dashboard / chat`
- HTTP channel with OpenAI-compatible POST /api/chat + GET /api/agents
- Discord and Telegram channel adapters
- Dynamic model fetching from all 8 provider APIs
- Usage token tracking per request
- AES-256-GCM API key encryption (Node.js only, never crypto.subtle)
- SHA-256 token hashing — plaintext returned once at creation, validated by hash
- Chat-scoped model override — per-thread model selection, config cascade: request > thread > agent default
- Dashboard modals with consistent outside-click and Escape dismissal (Radix Dialog)
- Settings page with live Convex data, loading/error states
- Convex schema deploys cleanly, 0 TypeScript errors

### Key Architectural Decisions Made
- Central daemon model (like OpenClaw, not per-project)
- Channels v1: HTTP + Discord + Telegram
- Memory: ConvexStore (not LibSQL) — dashboard visibility
- Mastra runs in `packages/runtime/` — never in Convex actions
- Model override: per-thread (not per-agent) — creates temporary agent, never mutates cached agent

---

## Live Test Deployments
- `hallowed-stork-858` — main test project at `/tmp/af-npm-test/test-proj`
- Use `agentforge status` to check connection
