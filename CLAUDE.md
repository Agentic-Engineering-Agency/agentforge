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

### 6 · Template Sync (4 locations)
Every Convex template file must be kept identical in ALL 4 locations:
```
packages/cli/templates/default/convex/  ← CANONICAL SOURCE
packages/cli/dist/default/convex/
templates/default/convex/
convex/
```
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

## Current Status (v0.11.21, March 2026)

### Architecture Redesign In Progress
5 specs written for the migration from Convex-action-Mastra to daemon architecture:
- **SPEC-020:** `packages/runtime/` package (createStandardAgent, ConvexStore memory, model registry)
- **SPEC-021:** Channel adapters (HTTP/SSE, Discord, Telegram)
- **SPEC-022:** Convex data layer cleanup (remove LLM logic, AES-256-GCM encryption)
- **SPEC-023:** CLI runtime commands (`agentforge start`, `agentforge chat`)
- **SPEC-024:** Security hardening (auth, rate limiting, env validation)

### What Works (v0.11.21)
- `agentforge create / status / agents / models / keys / tokens / threads / logs / skills / dashboard`
- All 8 LLM providers for model fetch + chat
- Convex schema deploys cleanly
- 757 unit tests passing, 0 TypeScript errors

### Key Architectural Decisions Made
- Central daemon model (like OpenClaw, not per-project)
- Channels v1: HTTP + Discord + Telegram
- Memory: ConvexStore (not LibSQL) — dashboard visibility
- Mastra runs in `packages/runtime/` — never in Convex actions

---

## Live Test Deployments
- `hallowed-stork-858` — main test project at `/tmp/af-npm-test/test-proj`
- Use `agentforge status` to check connection
