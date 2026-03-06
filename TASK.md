# TASK: SPEC-021 — Channel Adapters (HTTP + Discord + Telegram)

## Context
You are implementing SPEC-021 for the AgentForge project. This spec adds three channel adapters to the runtime package: HTTP (OpenAI-compatible API), Discord, and Telegram.

**SPEC-020 (runtime) is already merged into `plan/architecture-redesign`.** You are on branch `feat/spec-021-channels` based on that.

## What to Build

### 1. HTTP Channel (`packages/runtime/src/channels/http.ts`)
- Hono-based server with SSE streaming
- OpenAI-compatible `/v1/chat/completions` endpoint
- `/health`, `/v1/agents`, `/v1/threads` endpoints
- Bearer token auth

### 2. Discord Channel (`packages/runtime/src/channels/discord.ts`)
- discord.js bot with progressive streaming (edit message every 1.5s)
- Responds to @mentions and auto-channels
- Splits messages > 2000 chars
- Posts "💭 Pensando..." then edits

### 3. Telegram Channel (`packages/runtime/src/channels/telegram.ts`)
- grammy bot with progressive streaming
- Allowed chat ID whitelist
- MarkdownV2 formatting

### 4. Shared utilities (`packages/runtime/src/channels/shared.ts`)
- `progressiveStream()` function used by all channels
- `splitMessage()` for Discord/Telegram limits

### 5. Export from `packages/runtime/src/index.ts`

## Read First
- `specs/active/SPEC-021-channel-adapters.md` — full spec
- `packages/runtime/src/` — existing runtime code from SPEC-020
- `TECH-REFERENCE.md` — architecture overview

## Dependencies to Add
- `grammy` — Telegram bot framework
- `discord.js` should already be in template deps

## Quality Requirements
- TypeScript strict mode, 0 errors
- Tests for: splitMessage, HTTP SSE format, /health endpoint
- No hardcoded secrets
- All channels implement the `ChannelAdapter` interface

## Branch
Already on `feat/spec-021-channels`. Commit with descriptive messages prefixed with `feat(channels):`.

## When Done
- Run `pnpm run typecheck` and ensure 0 errors
- Run `pnpm test` and ensure all pass
- Commit and push to remote
- Report completion
