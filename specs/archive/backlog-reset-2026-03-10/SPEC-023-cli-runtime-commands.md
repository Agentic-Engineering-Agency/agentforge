# [SPEC-023] CLI Runtime Commands

**Status:** Draft | **Priority:** P1 | **Assigned:** Agent A (after SPEC-021)
**Created:** 2026-03-05 | **Updated:** 2026-03-05
**Depends on:** SPEC-020, SPEC-022

## Overview
Add `agentforge start` to boot the daemon, fix `agentforge chat` to stream via HTTP, update `agentforge status` to check runtime health. Remove or implement stub commands (`voice`, `browser`, `usage`). Fix documented but non-existent flags.

## Goals
- `agentforge start` — boots the AgentForge daemon (runtime + channels)
- `agentforge chat <agent-id>` — real streaming via HTTP endpoint (replaces broken Convex action call)
- `agentforge status` — checks runtime + Convex connection health
- `agentforge deploy` — deploys Convex schema only (no runtime needed)
- Remove `voice` / `browser` stubs OR implement basic versions
- Fix `research --format` flag (remove from docs if not implemented)

## Non-Goals
- Full voice implementation (future)
- Browser automation (future)
- Channel management UI in dashboard (future)

## Proposed Solution

### `agentforge start`
```
agentforge start [options]

Options:
  --port <n>        HTTP channel port (default: 3001)
  --discord         Enable Discord channel (requires DISCORD_BOT_TOKEN)
  --telegram        Enable Telegram channel (requires TELEGRAM_BOT_TOKEN)
  --no-http         Disable HTTP channel
  --agent <id>      Load specific agent(s) only (repeatable)
  --dev             Dev mode: verbose logging, no process.exit on error

Examples:
  agentforge start
  agentforge start --discord --telegram
  agentforge start --port 8080 --agent my-agent
```

Implementation:
1. Read `agentforge.config.ts` in project root (agent definitions + channel config)
2. Optionally load agent configs from Convex (if `CONVEX_URL` is set)
3. Instantiate `AgentForgeDaemon` from `@agentforge-ai/runtime`
4. Add requested channel adapters
5. Call `daemon.start()`
6. Handle SIGTERM/SIGINT gracefully

### `agentforge.config.ts` (new scaffolded file)
```typescript
import { defineConfig } from "@agentforge-ai/runtime"

export default defineConfig({
  daemon: {
    defaultModel: "moonshotai/kimi-k2.5",
    dbUrl: "file:./agentforge.db",
  },
  channels: {
    http: { port: 3001 },
    discord: { enabled: false, defaultAgentId: "main" },
    telegram: { enabled: false, defaultAgentId: "main" },
  },
  agents: [
    {
      id: "main",
      name: "Main Agent",
      instructions: "You are a helpful assistant.",
    },
  ],
})
```

### `agentforge chat`
```
agentforge chat [agent-id] [options]

Options:
  --message, -m <text>   Send single message (non-interactive)
  --thread <id>          Continue existing thread
  --port <n>             Runtime port (default: 3001)

Examples:
  agentforge chat                    # interactive, uses default agent
  agentforge chat my-agent -m "hello"  # single message, print response
```

Implementation:
- Connect to local HTTP endpoint (`http://localhost:3001/v1/chat/completions`)
- Stream response via SSE
- Interactive mode: readline loop
- Non-interactive (`-m`): single message, print response, exit 0

### `agentforge status` (update)
Add runtime health check:
```
● Convex backend    ✓ connected (hallowed-stork-858)
● Runtime daemon    ✓ running on :3001 (3 agents loaded)
● Discord channel   ✓ connected
● Telegram channel  ✗ not configured
● OpenAI key        ✓ configured
● Anthropic key     ✓ configured
```

### `agentforge deploy` (new, replaces `convex deploy`)
```
agentforge deploy

Deploys Convex schema and functions.
Does NOT start the runtime.
```

### Remove / Fix
- `agentforge voice` — remove command entirely (no stubs)
- `agentforge browser` — remove command entirely (no stubs)
- `agentforge research --format` — remove `--format` flag doc/code
- `agentforge usage` — implement basic usage summary from Convex logs table, or remove

### Update `agentforge create`
Scaffold now generates:
- `agentforge.config.ts` — daemon config
- `.env.example` with all required env vars documented
- `convex/` — data layer only (no LLM files)

## Implementation Plan
1. Add `agentforge.config.ts` to template scaffold
2. Implement `agentforge start` command
3. Fix `agentforge chat` — HTTP streaming instead of Convex action
4. Update `agentforge status` — add runtime health check
5. Add `agentforge deploy` command
6. Remove `voice`, `browser` stubs
7. Fix or remove `usage` command
8. Remove `--format` from `research` if not implementing it

## Testing Plan
- Unit: config file parsing
- Unit: `agentforge chat --message "hi"` prints response (mock HTTP)
- Integration: `agentforge start` → `agentforge status` shows runtime running
- Integration: `agentforge chat -m "hello"` against live runtime returns response
- Manual: run full flow: `agentforge deploy` → `agentforge start` → `agentforge chat`
