# AgentForge — Project State & Architecture Redesign

**Last Updated:** March 5, 2026  
**Authors:** Seshat (audit) + Luci (architecture decision)  
**Status:** v0.11.21 published — full architectural refactor approved and planned

---

## Part 1 — What Was Built (v0.11.21)

### Published Packages
| Package | Version |
|---------|---------|
| `@agentforge-ai/core` | 0.11.21 |
| `@agentforge-ai/cli` | 0.11.21 |

### What Works
- `agentforge create <name>` — scaffolds a project
- `agentforge status / agents list / models list / keys / tokens / threads / logs / skills / dashboard`
- All 8 LLM providers: OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI, OpenRouter, Cohere
- Convex schema deploys cleanly (25+ tables, 108 indexes, 0 TS errors)
- 757 unit tests passing
- Dashboard Vite server starts, Convex real-time queries work

### What Doesn't Work Well
| Issue | Root Cause |
|-------|------------|
| Chat latency 10-15s | Mastra running inside Convex "use node" actions — cold starts |
| No real streaming | Convex actions are request/response, not streams |
| XOR encryption on API keys | crypto.subtle too slow in V8 runtime for proper AES |
| No auth/authorization | Any caller can access all Convex data |
| No rate limiting | Unbounded LLM calls |
| `voice` / `browser` commands empty | Not implemented |
| 4-way template sync | Manual, error-prone, caused most regressions this week |

---

## Part 2 — The Architectural Problem

### The Core Mistake
Mastra is a **persistent runtime**. It maintains in-memory state, streams responses, and manages long-lived memory. We have been running it inside Convex actions — serverless functions with cold starts, execution time limits, and no streaming support.

This is like running an Express server inside a Lambda function. It works barely, but it's wrong by design.

### Evidence
- **Chico** (Koki's repo, reviewed March 5): correct Mastra usage — persistent Node.js process, LibSQL memory, streaming Discord responses, <1s latency
- **AgentForge**: Mastra inside `convex/lib/agent.ts` ("use node" action) → 10-15s cold starts, no streaming, crypto.subtle too slow for real encryption

### What Convex Is Good For
- Real-time reactive data (great for dashboards)
- Config storage (agents, API keys, files, settings)
- Audit logs + usage tracking
- Schema + validation

### What Convex Is Bad For
- Running LLM calls
- Persistent processes
- Streaming
- Crypto operations (V8 runtime is slow)

---

## Part 3 — New Architecture

### Decision (confirmed by Luci, March 5, 2026)
- **Central daemon** model (like OpenClaw, not per-project like Chico)
- **One AgentForge instance** manages multiple agents
- **Channels v1:** HTTP, Discord, Telegram

```
┌──────────────────────────────────────────────────────────┐
│  AgentForge Daemon  (persistent Node.js process)          │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Mastra Core                                        │  │
│  │  ├── createStandardAgent() factory                  │  │
│  │  ├── createStandardMemory() — LibSQL (local)        │  │
│  │  ├── models/registry.ts — capability/tier metadata  │  │
│  │  └── tools/ — web-search, read-url, datetime, etc.  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Channels:                                                │
│  ├── HTTP  → /v1/chat/completions (OpenAI-compatible)     │
│  │           /health, /v1/agents, /v1/threads             │
│  ├── Discord → bot.ts, progressive streaming              │
│  └── Telegram → grammy, progressive streaming             │
│                                                           │
│  Sync Layer:                                              │
│  ├── reads agent config from Convex on startup            │
│  ├── writes logs/usage/messages to Convex in real-time    │
│  └── hot-reload on Convex config changes                  │
└───────────────────────────┬──────────────────────────────┘
                            │ Convex HTTP client
┌───────────────────────────▼──────────────────────────────┐
│  Convex Backend  (data layer ONLY — no LLM logic)         │
│                                                           │
│  Tables: agents, apiKeys, threads, messages,              │
│          files, settings, logs, usage, tokens             │
│                                                           │
│  Removed: chat.ts, mastraIntegration.ts, lib/agent.ts    │
│           modelFetcher.ts (moves to runtime)              │
└───────────────────────────┬──────────────────────────────┘
                            │ Convex real-time
┌───────────────────────────▼──────────────────────────────┐
│  Dashboard  (React + Vite)                                │
│  agent management, API keys, logs, usage, channels        │
└──────────────────────────────────────────────────────────┘
```

### Key Pattern: `createStandardAgent()` (from Chico)
```typescript
// packages/runtime/src/agent/create-standard-agent.ts
export function createStandardAgent(config: {
  id: string
  name: string
  instructions: string
  model?: string
  tools?: ToolsInput
  workingMemoryTemplate?: string
}): Agent {
  const memory = createStandardMemory(config)
  return new Agent({
    id: config.id,
    name: config.name,
    model: config.model ?? DAEMON_MODEL,
    memory,
    tools: config.tools ?? {},
    inputProcessors: [new UnicodeNormalizer(), new TokenLimiterProcessor(...)],
    instructions: config.instructions,
  })
}
```

### Key Pattern: Channel Adapter Interface
```typescript
interface ChannelAdapter {
  name: string
  start(agents: Map<string, Agent>): Promise<void>
  stop(): Promise<void>
}
// Implementations: HttpChannel, DiscordChannel, TelegramChannel
```

---

## Part 4 — Migration Plan (SpecSafe Specs)

All specs follow SpecSafe workflow: `spec → test → code → qa → complete`

### SPEC-020 — Runtime Package Foundation
**Priority:** P0 — blocks everything else  
**What:** New `packages/runtime/` package with:
- `src/agent/create-standard-agent.ts` — factory (from Chico)
- `src/agent/shared.ts` — DAEMON_MODEL, createStandardMemory(), LibSQL storage
- `src/models/registry.ts` — full model registry (providers, capabilities, tiers, costs)
- `src/tools/` — datetime, web-search (Gemini grounding or Brave), read-url (jsdom+Readability), manage-notes
- `src/daemon.ts` — AgentForgeDaemon class: loads agents from Convex, starts channels, handles shutdown

**Tests:** Unit tests for factory, registry, tools. Integration test: daemon starts and loads a test agent.

### SPEC-021 — Channel Adapters (HTTP + Discord + Telegram)
**Priority:** P0  
**Depends on:** SPEC-020  
**What:**
- `src/channels/http.ts` — Hono server, `/v1/chat/completions` (OpenAI-compatible streaming), `/health`, `/v1/agents`
- `src/channels/discord.ts` — discord.js, progressive streaming (edit every 1.5s), mention + DM support
- `src/channels/telegram.ts` — grammy, streaming via message edits

**Tests:** Unit tests for message splitting/formatting. Integration: HTTP endpoint responds correctly.

### SPEC-022 — Convex Data Layer Refactor
**Priority:** P1  
**Depends on:** SPEC-020 (can run parallel to SPEC-021)  
**What:**
- Remove from Convex: `chat.ts`, `mastraIntegration.ts`, `lib/agent.ts`, `modelFetcher.ts` (all LLM logic)
- Convex becomes: agents CRUD, apiKeys (AES-256-GCM via Node.js `node:crypto`), threads, messages, files, logs, usage
- New `src/sync/convex.ts` in runtime — reads agent configs, writes logs/messages back
- Fix `getActiveForProvider` — remove `decryptedKey` from public query (security fix)
- Move encryption to a Convex `"use node"` action (real AES-256-GCM, fast in Node.js)

**Tests:** Encryption round-trip. Sync layer reads agent from Convex correctly.

### SPEC-023 — CLI Runtime Commands
**Priority:** P1  
**Depends on:** SPEC-020, SPEC-022  
**What:**
- `agentforge start [--port 3000] [--discord] [--telegram]` — boots daemon
- `agentforge chat <agent-id>` — streams via HTTP (replaces Convex action call)
- `agentforge status` — checks runtime health + Convex connection
- `agentforge deploy` — deploys Convex schema (data layer only, no runtime needed)
- Update `agentforge create` — scaffolds both Convex schema AND runtime config

**Tests:** CLI integration tests against live HTTP endpoint.

### SPEC-024 — Security Hardening
**Priority:** P1  
**Depends on:** SPEC-022  
**What:**
- AES-256-GCM encryption for API keys (in Convex `"use node"` action, not V8)
- Rate limiting on HTTP channel (per-agent, per-token)
- Basic auth check on Convex functions (token validation)
- Input sanitization on all channel adapters
- `npm audit` clean (already clean at v0.11.21 — maintain it)

**Tests:** Encryption benchmark. Auth bypass tests. Rate limit tests.

---

## Part 5 — Overnight Work Plan

### Strategy
- Write specs now (synchronously, this session)
- Spawn 2 parallel Claude Code agents via tmux
- Agent A: SPEC-020 (runtime foundation)
- Agent B: SPEC-022 (Convex cleanup — can start before runtime is done)
- Each agent: spec → test → code → qa → PR (never push to main)
- Morning: review PRs, merge, start SPEC-021 (channels)

### Order of Operations
```
Night 1 (now)
  ├── Agent A: SPEC-020 runtime package
  └── Agent B: SPEC-022 Convex data layer refactor

Morning review
  └── Merge PRs after review

Night 2 (tomorrow)
  ├── Agent A: SPEC-021 HTTP + Discord channels
  └── Agent B: SPEC-021 Telegram channel + SPEC-023 CLI

Night 3
  ├── Agent A: SPEC-024 security hardening
  └── Agent B: integration testing, dashboard verification

Release: v0.12.0 — new runtime architecture
```

### Quality Gates (mandatory per spec)
1. `pnpm test` — all tests pass (must add tests, not skip them)
2. `tsc --noEmit` — 0 TypeScript errors
3. `pnpm audit` — 0 high/critical vulnerabilities
4. Manual CLI test: `agentforge start`, `agentforge chat`, `agentforge status`
5. Manual dashboard test: agents load, real-time updates work

---

## Part 6 — What to Preserve vs Rebuild

### Keep (good patterns)
- Convex schema (tables are solid, just remove LLM logic from functions)
- Dashboard React components (mostly fine, just update API calls)
- CLI command structure (add `start`, fix `chat`)
- `agentforge create` scaffolding
- `agentforge upgrade` command
- All 757 existing unit tests (add to, don't remove)

### Remove / Replace
| File | Why | Replacement |
|------|-----|-------------|
| `convex/lib/agent.ts` | Mastra in Convex action | `packages/runtime/src/agent/` |
| `convex/mastraIntegration.ts` | Same | Runtime sync layer |
| `convex/modelFetcher.ts` | Runs in V8 | `packages/runtime/src/models/registry.ts` |
| `convex/chat.ts` | LLM in Convex | HTTP channel → runtime |
| `packages/web/` | Legacy, unused | Delete |
| `packages/cloud-client/` | Empty | Delete |
| `packages/convex-adapter/` | Empty | Delete |
| `packages/sandbox/` | Empty | Delete |

### Fix
- 4-way template sync → automate with `pnpm sync-templates` script or single source
- `voice` / `browser` CLI stubs → implement or remove
- `research --format` flag → remove non-existent flag from docs

---

## Part 7 — Reference: Chico (Koki's Implementation)

Repo: `https://github.com/Agentic-Engineering-Agency/chico`  
Reviewed: March 5, 2026

**Patterns to directly adopt:**
- `createStandardAgent()` factory + `shared.ts` — clean agent abstraction
- `models/registry.ts` — typed model metadata (provider, context window, cost, capabilities, roles)
- `delegation.ts` event emitter — inter-agent comms without tight coupling
- `discord/bot.ts` progressive streaming — edit message every 1.5s while streaming
- `tools/web-search.ts` — Gemini Search grounding (or adapt for Brave API)
- `tools/read-url.ts` — jsdom + Mozilla Readability for URL content extraction
- `TokenLimiterProcessor` — prevent context overflow
- `UnicodeNormalizer` — basic input safety (guardrails disabled: Gemini rejects schemas)

**Model:** Kimi K2.5 (`moonshotai/kimi-k2.5`) — cheap, capable, recommended default

---

## Part 8 — Known Issues Carried Forward

These are NOT fixed in the current architecture and must be addressed in SPEC-022/024:

1. **API key encryption is XOR** — `apiKeys.ts` in current template
2. **`getActiveForProvider` leaks decrypted keys** — public query vulnerability
3. **No auth on Convex functions** — any caller reads all data
4. **No rate limiting** on any endpoint
5. **Template 4-way sync** — manual, fragile
6. **CHANGELOG.md** — not updated (v0.10.18 → v0.11.21 entries missing)

---

## Appendix — Test Deployments

| Project | Purpose | Status |
|---------|---------|--------|
| `brazen-bulldog-292` | First v0.11.16 test | Can delete |
| `hallowed-stork-858` | Main audit test (v0.11.20+) | Keep for SPEC-022 testing |

---

*AgentForge — building the right thing, the right way.*
