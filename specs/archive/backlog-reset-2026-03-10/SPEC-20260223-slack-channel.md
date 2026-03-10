# SPEC-20260223-slack-channel

## Title
Slack Channel Adapter (AGE-49)

## Status
CODE

## Summary
Implement a Slack channel adapter for AgentForge using Slack Bolt.js with Socket Mode
and Events API support. The adapter bridges Slack workspaces to the AgentForge agent
execution pipeline, supporting Block Kit rich messages, slash commands, app_mention events,
signature verification (HMAC-SHA256), and rate limiting.

## Requirements

### Functional
- SlackAdapter class extending ChannelAdapter base class
- Socket Mode (WebSocket) and HTTP Events API support via @slack/bolt
- Config validation using Zod schema (botToken, appToken, signingSecret)
- Message sending: text, Block Kit blocks, threaded replies
- Event handling: message, app_mention, slash commands
- Message editing and deletion
- Emoji reactions
- Signature verification using HMAC-SHA256 via crypto.subtle (no node:crypto)
- Rate limiting with queue and delay (50 msg/sec tier 3 limit)

### Non-Functional
- SlackChannel class routes messages through Convex chat pipeline
- Thread mapping: Slack channel+user → Convex threadId
- CLI command: `agentforge channel:slack` (start, configure, status)
- Graceful shutdown on SIGINT/SIGTERM

## Architecture
- `packages/channels-slack/src/types.ts` — TypeScript types and Zod schemas
- `packages/channels-slack/src/slack-adapter.ts` — SlackAdapter (ChannelAdapter impl)
- `packages/channels-slack/src/slack-channel.ts` — SlackChannel (pipeline router)
- `packages/channels-slack/src/index.ts` — Public exports
- `packages/cli/src/commands/channel-slack.ts` — CLI command

## Test Plan
- 45 tests in `packages/channels-slack/src/slack-adapter.test.ts`
- Config validation: missing token, invalid prefix, defaults
- Lifecycle: start/stop, error handling
- sendMessage: correct payload, threading, markdown, failure
- sendBlocks: Block Kit rendering
- app_mention: event handler invocation
- Slash commands: registration and execution
- Rate limiting: throttle behavior
- Signature verification: valid HMAC, invalid HMAC, expired timestamp
- Delete/edit/reaction operations
- Health check: healthy, disconnected, API failure
- Capabilities reporting
- Event emission: message routing, bot skip, subtype skip

## Dependencies
- @slack/bolt ^4.1.0
- @slack/web-api ^7.8.0
- zod ^3.22.0
- @agentforge-ai/core (peer)

## Linear Issue
AGE-49
