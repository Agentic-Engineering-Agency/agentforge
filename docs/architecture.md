# Architecture

AgentForge is built on three pillars: **Mastra** for LLM orchestration, **Convex** for real-time state, and **Cloudflare** for edge deployment.

## System Overview

```
                    ┌──────────────────────────┐
                    │      User Interfaces      │
                    │  CLI │ Web │ Channels      │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │    Channel Adapters       │
                    │  Telegram │ WhatsApp      │
                    │  Slack    │ Discord       │
                    │                          │
                    │  Normalized InboundMsg    │
                    │  → OutboundMsg pipeline   │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │    Agent Pipeline         │
                    │                          │
                    │  ┌─────────────────────┐ │
                    │  │  Mastra Agent        │ │
                    │  │  (LLM Router)        │ │
                    │  │  8+ providers        │ │
                    │  └──────────┬──────────┘ │
                    │             │             │
                    │  ┌──────┐ ┌▼─────┐ ┌───┐ │
                    │  │Skills│ │MCP   │ │A2A│ │
                    │  │      │ │Tools │ │   │ │
                    │  └──────┘ └──────┘ └───┘ │
                    │                          │
                    │  Voice │ Browser │ Git    │
                    │  Sandbox │ Workspace      │
                    └───────────┬──────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │    Convex Backend         │
                    │                          │
                    │  Real-time DB (20+ tables)│
                    │  Serverless Functions     │
                    │  Subscriptions            │
                    │  File Storage (R2)        │
                    └──────────────────────────┘
```

## Data Flow

A typical message flows through the system like this:

1. **User sends a message** via a channel (Telegram, Slack, CLI, etc.)
2. **Channel Adapter** normalizes it into a standard `InboundMessage` format
3. **Agent Pipeline** receives the message and invokes the Mastra Agent
4. **Mastra** routes to the configured LLM provider (`"provider/model"` format)
5. **Tools execute** — skills, MCP tools, browser actions, sandbox code, etc.
6. **Response stored** in Convex (thread, messages, usage tracking)
7. **OutboundMessage** sent back through the channel adapter to the user

## Config Cascade

Configuration resolves in priority order:

```
Agent Config  >  Project Config  >  Global Config  >  System Defaults
```

- **Agent Config** — Per-agent model, instructions, skills, tools
- **Project Config** — `agentforge.config.ts` in the project root
- **Global Config** — User-level settings (`agentforge config`)
- **System Defaults** — Framework defaults (e.g., `openai/gpt-4o`)

## Package Structure

```
agentforge/
├── packages/
│   ├── core/               # @agentforge-ai/core
│   │   ├── src/
│   │   │   ├── agent.ts           # Agent class (Mastra wrapper)
│   │   │   ├── mcp-server.ts      # MCP server for tool registration
│   │   │   ├── mcp/
│   │   │   │   ├── mcp-client.ts       # MCP client (stdio/HTTP/SSE)
│   │   │   │   └── mcp-dynamic-tools.ts # Dynamic tool loader
│   │   │   ├── channel-adapter.ts  # Base channel + registry
│   │   │   ├── channels/
│   │   │   │   ├── telegram.ts    # Telegram adapter
│   │   │   │   └── whatsapp.ts    # WhatsApp adapter
│   │   │   ├── a2a/
│   │   │   │   ├── a2a-client.ts  # A2A task delegation
│   │   │   │   ├── a2a-server.ts  # A2A task handler
│   │   │   │   └── a2a-registry.ts # Agent discovery
│   │   │   ├── skills/
│   │   │   │   ├── skill-loader.ts    # Load skill definitions
│   │   │   │   ├── skill-registry.ts  # Skill management
│   │   │   │   └── skill-discovery.ts # Discovery mechanisms
│   │   │   ├── sandbox.ts         # E2B sandbox manager
│   │   │   ├── workspace.ts       # File workspace (local/R2)
│   │   │   ├── browser-tool.ts    # Playwright browser automation
│   │   │   ├── git-tool.ts        # Git operations tool
│   │   │   └── swarm.ts           # Multi-agent orchestration
│   │   └── package.json
│   │
│   ├── cli/                # @agentforge-ai/cli
│   │   └── src/
│   │       ├── index.ts           # CLI entry point (commander)
│   │       └── commands/          # Individual command handlers
│   │
│   ├── channels-slack/     # @agentforge-ai/channels-slack
│   ├── channels-discord/   # @agentforge-ai/channels-discord
│   ├── tools-voice/        # @agentforge-ai/tools-voice
│   ├── sandbox/            # @agentforge-ai/sandbox
│   └── web/                # @agentforge-ai/web (React dashboard)
│
├── convex/                 # Convex serverless backend
│   ├── schema.ts           # Database schema (20+ tables)
│   ├── agents.ts           # Agent CRUD
│   ├── chat.ts             # Chat/generation logic
│   ├── threads.ts          # Conversation threads
│   ├── messages.ts         # Message storage
│   ├── mastraIntegration.ts # Mastra agent execution
│   ├── llmProviders.ts     # LLM provider management
│   ├── skills.ts           # Skills registry
│   ├── mcpConnections.ts   # MCP server connections
│   ├── vault.ts            # Secret storage
│   └── http.ts             # HTTP endpoints
│
└── docs/                   # Documentation
```

## Key Design Decisions

### Mastra for LLM routing (not Vercel AI SDK)

AgentForge uses Mastra's model router directly. All models use the `"provider/model-name"` format (e.g., `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`). This gives us:

- Single dependency for all LLM providers
- Built-in agent orchestration
- Tool execution framework
- No Vercel AI SDK dependency

### Convex for state (not Postgres)

Convex provides real-time subscriptions out of the box, which means the web dashboard and channel adapters get live updates without polling. The serverless function model also eliminates infrastructure management.

### Channel adapter normalization

All channels share a common message format (`InboundMessage` / `OutboundMessage`). This means agent logic is channel-agnostic — the same agent works across Telegram, Slack, WhatsApp, and Discord without modification.

### Project-scoped multi-tenancy

Every resource (agents, threads, files, skills, etc.) belongs to a `projectId`. This enables:

- Multiple isolated workspaces per user
- Team collaboration with role-based access (owner/editor/viewer)
- Clean data boundaries for compliance

## Supported LLM Providers

| Provider | Format | Example |
|----------|--------|---------|
| OpenAI | `openai/model` | `openai/gpt-4o` |
| Anthropic | `anthropic/model` | `anthropic/claude-sonnet-4-20250514` |
| Google | `google/model` | `google/gemini-2.0-flash` |
| Mistral | `mistral/model` | `mistral/mistral-large-latest` |
| DeepSeek | `deepseek/model` | `deepseek/deepseek-chat` |
| xAI | `xai/model` | `xai/grok-2` |
| Cohere | `cohere/model` | `cohere/command-r-plus` |
| OpenRouter | `openrouter/model` | `openrouter/auto` |
