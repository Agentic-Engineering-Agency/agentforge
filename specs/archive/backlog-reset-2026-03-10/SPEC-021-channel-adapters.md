# [SPEC-021] Channel Adapters: HTTP + Discord + Telegram

**Status:** Draft | **Priority:** P0 | **Assigned:** Agent A (after SPEC-020)
**Created:** 2026-03-05 | **Updated:** 2026-03-05
**Depends on:** SPEC-020

## Overview
Implement the three v1 channel adapters for the AgentForge daemon: HTTP (OpenAI-compatible), Discord, and Telegram. Each adapter implements the `ChannelAdapter` interface from SPEC-020.

## Goals
- HTTP channel: OpenAI-compatible `/v1/chat/completions` with real streaming (SSE)
- Discord channel: bot with progressive streaming (edit message every 1.5s)
- Telegram channel: bot with progressive streaming (edit message)
- All channels route messages to the correct agent by config
- Progressive streaming: users see the response build in real-time, not wait for full completion

## Non-Goals
- WhatsApp, Slack (future specs)
- Voice channels (future)
- Multi-agent routing/delegation (future — Phase 2)

## Proposed Solution

### HTTP Channel (`packages/runtime/src/channels/http.ts`)
- Built on **Hono** (already in use, fast, edge-compatible)
- Endpoints:
  - `GET /health` — `{ status: "ok", agents: string[], version: string }`
  - `GET /v1/agents` — list loaded agents
  - `POST /v1/chat/completions` — OpenAI-compatible, SSE streaming
  - `POST /v1/threads` — create thread
  - `GET /v1/threads/:id/messages` — list messages in thread
- Auth: Bearer token (reads from Convex tokens table, or env `AGENTFORGE_API_KEY` for local dev)
- Streaming: `text/event-stream`, `data: {"choices":[{"delta":{"content":"..."}}]}`

```typescript
// Request body
{
  model: string,          // agent id (e.g. "my-agent")
  messages: Message[],
  stream?: boolean,       // default true
  thread_id?: string,     // optional Convex thread ID
}
```

### Discord Channel (`packages/runtime/src/channels/discord.ts`)
```typescript
export class DiscordChannel implements ChannelAdapter {
  name = "discord"
  constructor(token: string, config: DiscordChannelConfig) {}
  async start(agents: Map<string, Agent>): Promise<void>
  async stop(): Promise<void>
}
```

Config:
```typescript
interface DiscordChannelConfig {
  defaultAgentId: string          // which agent handles Discord by default
  autoChannels?: string[]         // channel names where bot responds without @mention
  teamChannel?: string            // channel for delegation event visibility
  editIntervalMs?: number         // default 1500
}
```

Bot behavior:
- Responds when @mentioned OR in auto-channels
- Posts "💭 Pensando..." immediately, then edits with streamed content
- Splits messages > 2000 chars (Discord limit)
- Delegation events posted to #team channel if configured

### Telegram Channel (`packages/runtime/src/channels/telegram.ts`)
```typescript
export class TelegramChannel implements ChannelAdapter {
  name = "telegram"
  constructor(token: string, config: TelegramChannelConfig) {}
}
```

Config:
```typescript
interface TelegramChannelConfig {
  defaultAgentId: string
  allowedChatIds?: number[]       // whitelist (empty = allow all)
  editIntervalMs?: number         // default 1000
}
```

Bot behavior:
- Responds to any message in allowed chats
- Posts "💭 Pensando..." immediately, edits with streamed content
- Uses grammy (lightweight, TypeScript-first Telegram bot framework)
- Handles MarkdownV2 formatting for Telegram

### Common Streaming Pattern
```typescript
// Shared utility: progressiveStream()
async function progressiveStream(
  agent: Agent,
  message: string,
  opts: { threadId?: string; resourceId?: string },
  onChunk: (text: string) => Promise<void>,
  onError: (err: Error) => Promise<void>
): Promise<string>
```

### Routing
Each channel gets a `defaultAgentId`. Future: message prefix `@agentname` routes to specific agent.

## Implementation Plan
1. Add deps: `grammy`, `discord.js` already in template
2. Implement `src/channels/http.ts` — Hono server with SSE streaming
3. Implement `src/channels/discord.ts` — discord.js bot
4. Implement `src/channels/telegram.ts` — grammy bot
5. Implement `src/channels/shared.ts` — progressiveStream() utility
6. Export from `src/index.ts`
7. Write tests

## Testing Plan
- Unit: `splitMessage()` handles >2000 char strings correctly
- Unit: HTTP SSE format matches OpenAI spec
- Integration: HTTP `/health` returns 200
- Integration: HTTP `/v1/chat/completions` streams response for test agent
- Manual: Discord bot responds in test server
- Manual: Telegram bot responds in test chat

## Env Variables Required
```
# HTTP channel
AGENTFORGE_API_KEY=        # local dev auth token
AGENTFORGE_PORT=3001       # default port (3000 is dashboard)

# Discord
DISCORD_BOT_TOKEN=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_CHAT_IDS= # comma-separated, optional
```

## References
- grammy docs: https://grammy.dev
- discord.js docs: https://discord.js.org
- Hono SSE: https://hono.dev/docs/helpers/streaming
- Chico Discord implementation: `/tmp/chico/src/discord/bot.ts`
- OpenAI streaming format: https://platform.openai.com/docs/api-reference/streaming
