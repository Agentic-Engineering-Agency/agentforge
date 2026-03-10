# @agentforge-ai/runtime

Persistent Mastra runtime package for AgentForge.

## What This Package Exports

The public surface is defined in [`src/index.ts`](/Users/eduardojaviergarcialopez/AgenticEngineering/agentforge/packages/runtime/src/index.ts).

### Agent Factory And Memory

- `createStandardAgent`
- `initStorage`
- `getStorage`
- `getVector`
- `createStandardMemory`
- `isStorageInitialized`
- runtime defaults:
  `DAEMON_MODEL`, `OBSERVER_MODEL`, `EMBEDDING_MODEL`, `DEFAULT_TOKEN_LIMIT`

These helpers implement the repo’s Convex-backed memory pattern using `@mastra/convex`.

### Model Registry

- `getModel`
- `getModelsByProvider`
- `getActiveModels`
- `getContextLimit`
- `resolveModel`

### Built-In Tools

- `datetimeTool`
- `webSearchTool`
- `readUrlTool`
- `manageNotesTool`

### Daemon And Channels

- `AgentForgeDaemon`
- channel abstractions:
  `ChannelAdapter`, `AgentDefinition`, `DaemonConfig`
- channel implementations:
  `HttpChannel`, `DiscordChannel`, `TelegramChannel`
- shared streaming helpers:
  `progressiveStream`, `splitMessage`, `formatSSEChunk`, `generateThreadId`

## Current Runtime Shape

In this repo, the runtime package is the home of the persistent daemon architecture. The CLI `start` command lazily imports this package to instantiate agents, initialize optional Convex-backed memory, and boot the HTTP channel.

Channel status in the current CLI flow:

- HTTP channel: started by `agentforge start`
- Discord channel: export exists, CLI wiring is present, but the current start command reports it as not yet implemented
- Telegram channel: export exists, CLI wiring is present, but the current start command reports it as not yet implemented

## Development

```bash
pnpm --filter @agentforge-ai/runtime build
pnpm --filter @agentforge-ai/runtime test
pnpm --filter @agentforge-ai/runtime typecheck
```

## License

Apache-2.0
