# [SPEC-020] AgentForge Runtime Package

**Status:** Draft | **Priority:** P0 | **Assigned:** Agent A
**Created:** 2026-03-05 | **Updated:** 2026-03-05

## Overview
Create a new `packages/runtime/` package that implements Mastra as a **persistent Node.js daemon**. This replaces the broken pattern of running Mastra inside Convex actions. Adopts patterns from Koki's `chico` repo.

## Problem Statement
Mastra is a persistent runtime. Running it inside Convex "use node" actions produces:
- 10-15s cold start latency on every chat message
- No real streaming (Convex actions are request/response)
- crypto.subtle too slow in V8 runtime (XOR cipher is the only viable option currently)
- No long-lived memory/state between requests

## Goals
- `packages/runtime/` package with `createStandardAgent()` factory
- Shared memory config using LibSQL (local SQLite, like Chico)
- Full model registry with provider/capability/tier metadata
- Base tools: datetime, web-search, read-url, manage-notes
- `AgentForgeDaemon` class that loads agents from config and manages channels
- All TypeScript, ESM, zero errors

## Non-Goals
- Channel implementations (that's SPEC-021)
- Convex sync layer (that's SPEC-022)
- CLI commands (that's SPEC-023)
- Security hardening (that's SPEC-024)

## Proposed Solution

### Package Structure
```
packages/runtime/
├── package.json          # @agentforge-ai/runtime, ESM
├── tsconfig.json
├── src/
│   ├── index.ts          # Public exports
│   ├── agent/
│   │   ├── create-standard-agent.ts   # Agent factory
│   │   └── shared.ts                  # DAEMON_MODEL, createStandardMemory(), storage
│   ├── models/
│   │   └── registry.ts                # Model registry with capabilities, tiers, costs
│   ├── tools/
│   │   ├── datetime.ts
│   │   ├── web-search.ts              # Brave Search API (env: BRAVE_API_KEY)
│   │   ├── read-url.ts                # jsdom + @mozilla/readability
│   │   └── manage-notes.ts
│   └── daemon/
│       ├── daemon.ts                  # AgentForgeDaemon class
│       └── types.ts                   # DaemonConfig, ChannelAdapter interface
└── tests/
    ├── agent-factory.test.ts
    ├── model-registry.test.ts
    └── tools.test.ts
```

### `createStandardAgent()` API
```typescript
interface StandardAgentConfig {
  id: string
  name: string
  description?: string
  instructions: string
  model?: string                    // defaults to DAEMON_MODEL
  tools?: ToolsInput
  workingMemoryTemplate?: string
  disableMemory?: boolean
}

export function createStandardAgent(config: StandardAgentConfig): Agent
```

### `shared.ts` constants
```typescript
export const DAEMON_MODEL = "moonshotai/kimi-k2.5" // cheap, capable default
export const OBSERVER_MODEL = "google/gemini-2.5-flash"
export const EMBEDDING_MODEL = "google/gemini-embedding-001"

// Memory uses ConvexStore (not LibSQL) — persists to Convex for dashboard visibility
// Requires: CONVEX_URL + CONVEX_ADMIN_KEY in env
export function createStorage(): ConvexStore
export function createVector(): ConvexVector
export function createStandardMemory(opts?: StandardMemoryOptions): Memory
```

**Why ConvexStore instead of LibSQL:**
- Central daemon = one shared database, not a per-project SQLite file
- Memory (threads, messages, working memory) is visible in the real-time dashboard
- No local file management
- Caveat: 1 MiB max record size — avoid storing base64 attachments inline

### `AgentForgeDaemon` class
```typescript
class AgentForgeDaemon {
  constructor(config: DaemonConfig)
  async loadAgents(agents: AgentDefinition[]): Promise<void>
  async addChannel(adapter: ChannelAdapter): Promise<void>
  async start(): Promise<void>
  async stop(): Promise<void>
  getAgent(id: string): Agent | undefined
}
```

### `ChannelAdapter` interface
```typescript
interface ChannelAdapter {
  name: string
  start(agents: Map<string, Agent>, daemon: AgentForgeDaemon): Promise<void>
  stop(): Promise<void>
}
```

### Model Registry
Typed entries with:
- `id`, `displayName`, `provider`
- `contextWindow`, `maxOutputTokens`
- `costPerMInput`, `costPerMOutput` (USD per million tokens)
- `tier: "free" | "budget" | "standard" | "premium"`
- `capabilities: Set<"chat" | "vision" | "code" | "long-context" | "embedding">`
- `roles: Set<"agent" | "observer" | "guardrail" | "embedding">`
- `active: boolean`

Cover all 8 providers: openai, anthropic, google, mistral, deepseek, xai, openrouter, cohere + moonshotai (Kimi K2.5)

## Implementation Plan
1. Scaffold `packages/runtime/` with package.json, tsconfig
2. Implement `src/models/registry.ts` — full model data
3. Implement `src/agent/shared.ts` — storage + memory factory
4. Implement `src/agent/create-standard-agent.ts` — factory
5. Implement `src/tools/` — 4 base tools
6. Implement `src/daemon/types.ts` — interfaces
7. Implement `src/daemon/daemon.ts` — daemon class
8. Write tests (target: 30+ tests)
9. Export everything from `src/index.ts`

## Testing Plan
- Unit: `createStandardAgent()` creates Agent with correct config
- Unit: model registry returns correct models by provider/capability/tier
- Unit: each tool runs without errors (mock HTTP calls)
- Integration: daemon starts, loads 1 agent, resolves `getAgent()`
- TypeScript: `tsc --noEmit` passes

## References
- Chico implementation: `/tmp/chico/src/mastra/`
- Mastra agents: https://mastra.ai/docs/agents/overview
- Mastra memory: https://mastra.ai/docs/memory/overview
- Mastra tools reference: https://mastra.ai/reference/tools/tool
- @mastra/convex storage: https://mastra.ai/reference/storage/convex
- @mastra/convex vectors: https://mastra.ai/reference/vectors/convex
- Tech reference: `docs/TECH-REFERENCE.md` (sections 3, 5, 7)
