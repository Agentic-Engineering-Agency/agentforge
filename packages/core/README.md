# @agentforge-ai/core

Shared AgentForge primitives for agents, sandboxing, channels, MCP, skills, A2A, research, voice, and workflow composition.

## Installation

```bash
npm install @agentforge-ai/core
```

## Export Surface

The package exports are assembled from [`src/index.ts`](/Users/eduardojaviergarcialopez/AgenticEngineering/agentforge/packages/core/src/index.ts).

### Agent And Workspace

- `Agent`
- `AgentForgeWorkspace`
- `LocalWorkspaceProvider`
- `R2WorkspaceProvider`
- `createWorkspaceProvider`
- `createWorkspace`

### Sandbox And Execution

- Sandbox manager and providers from `./sandbox`
- `GitTool`
- Browser automation helpers:
  `BrowserSessionManager`, `BrowserActionExecutor`, `createBrowserTool`, `registerBrowserTool`

### MCP And Connectors

- `MCPServer`
- `MCPExecutor`
- everything exported from `./mcp`
- everything exported from `./connectors`

### Channels

- Base channel abstractions:
  `ChannelAdapter`, `ChannelRegistry`, `MessageNormalizer`
- Telegram:
  `TelegramChannel`, `startTelegramChannel`
- WhatsApp:
  `WhatsAppChannel`, `startWhatsAppChannel`
- Discord exports from `./channels/discord`
- Slack exports from `./channels/slack`

### Multi-Agent And Failover

- `SwarmOrchestrator`, `InMemorySwarmStore`, `SubTaskRunner`, `ResultAggregator`
- `FailoverChain`, `FailoverExhaustedError`
- `A2AAgentRegistry`, `A2AClient`, `A2AServer`

### Skills

- Parsing and discovery:
  `parseSkillManifest`, `discoverSkills`, `fetchSkillFromGitHub`
- Bundled skill registry exports:
  `BundledSkillRegistry`, `bundledSkillRegistry`, `BUNDLED_SKILLS`
- Marketplace client exports:
  `fetchFeaturedSkills`, `searchSkills`, `getSkill`, `publishSkill`, `installFromMarketplace`

### Voice, Research, Workflows, Streaming

- Voice:
  `textToSpeech`, `speechToText`, `createVoiceTool`, TTS engine helpers
- Research:
  `ResearchOrchestrator`
- Workflows:
  `AgentPipeline`
- Streaming:
  `SSEStreamParser`, `streamToAsyncIterator`, `consumeStream`

## Intended Role In The Repo

`@agentforge-ai/core` holds shared framework primitives. The persistent Mastra daemon logic lives in `@agentforge-ai/runtime`, while CLI orchestration and scaffolding live in `@agentforge-ai/cli`.

## Development

```bash
pnpm --filter @agentforge-ai/core build
pnpm --filter @agentforge-ai/core test
pnpm --filter @agentforge-ai/core typecheck
```

## License

Apache-2.0
