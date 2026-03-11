# Architecture

AgentForge is built on three pillars: **Mastra** for LLM orchestration, **Convex** for real-time state, and a persistent **daemon runtime** that separates concerns correctly.

## System Overview

```
                    ┌──────────────────────────┐
                    │      User Interfaces      │
                    │  CLI │ Dashboard │ Channels│
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │   AgentForgeDaemon        │
                    │   (packages/runtime/)     │
                    │                          │
                    │  HTTP Channel (Hono/SSE)  │
                    │  Discord Channel          │
                    │  Telegram Channel         │
                    │                          │
                    │  createStandardAgent()    │
                    │  ┌─────────────────────┐ │
                    │  │  Mastra Agent        │ │
                    │  │  (LLM Router)        │ │
                    │  │  8+ providers        │ │
                    │  └──────────┬──────────┘ │
                    │             │             │
                    │  ┌──────┐ ┌▼─────┐       │
                    │  │Tools │ │Memory│       │
                    │  │(MCP) │ │Convex│       │
                    │  └──────┘ └──────┘       │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │    Convex Backend         │
                    │   (Data Layer ONLY)       │
                    │                          │
                    │  agents, apiKeys, logs    │
                    │  threads, messages        │
                    │  ConvexStore (memory)     │
                    └──────────────────────────┘
```

## Data Flow

A typical message flows through the system:

1. **User sends a message** via CLI (`agentforge chat`) or HTTP (`POST /api/chat`)
2. **HTTP Channel** (Hono server on port 4111) receives the request
3. **AgentForgeDaemon** routes to the correct Mastra agent
4. **createStandardAgent()** initializes agent with ConvexStore memory
5. **Mastra** routes to the configured LLM (`"provider/model"` format), streams response
6. **Response stored** in Convex (threads, messages, usage tracking)
7. **SSE stream** flows back to the client

## Package Structure

```
agentforge/
├── packages/
│   ├── runtime/            # @agentforge-ai/runtime
│   │   └── src/
│   │       ├── agent/           # createStandardAgent() factory
│   │       ├── channels/        # HTTP (Hono/SSE), Discord, Telegram
│   │       ├── daemon/          # AgentForgeDaemon class
│   │       ├── models/registry  # model registry (capabilities, costs)
│   │       └── tools/           # web-search, read-url, datetime, notes
│   │
│   ├── cli/                # @agentforge-ai/cli
│   │   ├── src/
│   │   │   ├── index.ts         # CLI entry point (commander)
│   │   │   └── commands/        # Individual command handlers
│   │   └── templates/default/   # CANONICAL scaffold template
│   │       ├── convex/          # Data layer only (no LLM logic)
│   │       └── dashboard/       # React UI
│   │
│   └── core/               # @agentforge-ai/core (shared types)
│
├── convex/                 # Local dev copy (sync with templates/)
│   ├── schema.ts           # Database schema
│   ├── agents.ts           # Agent CRUD
│   ├── apiKeys.ts          # Encrypted key storage
│   ├── threads.ts          # Conversation threads
│   ├── messages.ts         # Message storage
│   └── http.ts             # HTTP endpoints (data only)
│
└── docs/                   # Documentation
```

## Key Design Decisions

### Mastra runs in packages/runtime/ — never in Convex actions

Running Mastra inside Convex Node.js actions produces 10-15s cold starts, no real streaming, and broken crypto. The daemon is a persistent Node.js process that starts once and handles all requests:

```
✅ packages/runtime/ → Mastra agent runtime (persistent daemon)
✅ convex/           → data layer only (agents config, apiKeys, logs, threads)
❌ convex/chat.ts    → DELETED (never put LLM calls in Convex)
❌ convex/lib/agent.ts → DELETED
❌ convex/mastraIntegration.ts → DELETED
```

### Memory: ConvexStore (not LibSQL)

```typescript
// ✅ Daemon uses @mastra/convex for memory — visible in dashboard
import { ConvexStore } from '@mastra/convex'

// ❌ LibSQL creates a local SQLite file — wrong for central daemon
import { LibSQLStore } from '@mastra/libsql'
```

### HTTP Channel: OpenAI-compatible API

The daemon exposes a Hono server on port 4111 with two key endpoints:

- `GET /api/agents` — list all agents
- `POST /api/chat` — chat with an agent (SSE streaming)

This OpenAI-compatible format lets any client that speaks HTTP talk to AgentForge agents.

### AES-256-GCM encryption for API keys

API keys are encrypted using Node.js `crypto` (never `crypto.subtle`):

```typescript
// ✅ Node.js crypto in "use node" internalAction
import * as crypto from 'node:crypto'
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

// ❌ crypto.subtle in V8 runtime → 10-19s latency
await crypto.subtle.deriveBits(...)
```

### Convex for state (not Postgres)

Convex provides real-time subscriptions for the dashboard and eliminates infrastructure management. It is used **only** as a data layer — all LLM logic runs in `packages/runtime/`.

## Supported LLM Providers

| Provider | Format | Example |
|----------|--------|---------|
| OpenAI | `openai/model` | `openai/gpt-4o` |
| Anthropic | `anthropic/model` | `anthropic/claude-opus-4-6` |
| Google | `google/model` | `google/gemini-2.0-flash` |
| Mistral | `mistral/model` | `mistral/mistral-large-latest` |
| DeepSeek | `deepseek/model` | `deepseek/deepseek-chat` |
| xAI | `xai/model` | `xai/grok-2` |
| Cohere | `cohere/model` | `cohere/command-r-plus` |
| MoonshotAI | `moonshotai/model` | `moonshotai/kimi-k2.5` |
