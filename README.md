# AgentForge

**The open-source, self-hosted autonomous agent framework.**

> The self-hosted Manus alternative for teams that own their data.

AgentForge is a TypeScript framework for building, deploying, and managing autonomous AI agents. It combines [Mastra](https://mastra.ai) for LLM orchestration, [Convex](https://convex.dev) for real-time state, and [Cloudflare](https://cloudflare.com) for edge deployment — giving you a production-ready agent platform you fully control.

---

## Features

| Category | What you get |
|----------|-------------|
| **Multi-Provider LLM** | OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI, Cohere, OpenRouter — hot-swap models with `"provider/model"` format |
| **Channel Adapters** | Telegram, WhatsApp Cloud API, Slack (Bolt.js), Discord — unified message format across all platforms |
| **Memory & State** | Convex real-time backend with conversation threads, memory consolidation, and project-scoped multi-tenancy |
| **Skills Marketplace** | Install, create, and publish agent skills — 6 built-in skills included |
| **MCP Integration** | Connect external MCP servers, dynamic tool loading at runtime, stdio/HTTP/SSE transports |
| **Agent-to-Agent (A2A)** | Delegate tasks between agents with the A2A protocol — registry, streaming, whitelist security |
| **Voice** | Text-to-speech (ElevenLabs) and speech-to-text (Whisper) as Mastra-compatible tools |
| **Browser Automation** | Playwright-based browser tool — navigate, click, type, screenshot, evaluate JS |
| **Git Tools** | Built-in git tool for repo inspection, branching, commits, diffs, and stash management |
| **Sandbox Execution** | Docker container isolation (E2B-compatible) for secure code execution |
| **Observability** | Usage tracking, cost estimation, structured logging, heartbeat monitoring |
| **Web Dashboard** | React + Vite dashboard with real-time chat, agent management, and run monitoring |

---

## Quick Start

### 1. Install

```bash
npm install -g @agentforge-ai/cli
```

### 2. Create a project

```bash
agentforge create my-agent
cd my-agent
```

### 3. Configure

```bash
cp .env.example .env.local
```

Add your LLM provider key (any supported provider works):

```env
OPENROUTER_API_KEY=sk-or-...
# Or use a direct provider:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# CONVEX_URL is set automatically by npx convex dev
```

### 4. Start development

```bash
# Terminal 1: Start AgentForge (Convex backend)
agentforge run

# Terminal 2: Launch the web dashboard (localhost:3000)
agentforge dashboard
```

### 5. Chat with your agent

```bash
agentforge chat
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Channel Adapters                       │
│  Telegram │ WhatsApp │ Slack │ Discord │ Web Dashboard │ CLI│
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Agent Pipeline                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Skills  │  │MCP Tools │  │  Voice   │  │  Browser   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                             │
│  ┌──────────────────────┐  ┌────────────────────────────┐   │
│  │   Mastra (LLM Router)│  │  A2A (Agent Delegation)    │   │
│  │   8+ LLM providers   │  │  Registry + Streaming      │   │
│  └──────────────────────┘  └────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Convex Backend                          │
│  Real-time DB │ Serverless Functions │ Subscriptions        │
│  20+ tables   │ Multi-tenancy        │ File storage (R2)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@agentforge-ai/core`](packages/core) | v0.11.21 | Core agent primitives, sandbox integration, MCP server, and channel adapters |
| [`@agentforge-ai/cli`](packages/cli) | v0.11.21 | CLI tool for creating, running, and managing AgentForge projects |

---

## CLI Commands

### Project Lifecycle
```bash
agentforge create <name>     # Scaffold a new project
agentforge run               # Start dev server (Convex backend)
agentforge deploy            # Deploy to production
agentforge upgrade           # Sync convex/ with latest template
```

### Cloud & Authentication
```bash
agentforge workspace         # Workspace management
agentforge models            # LLM model management
agentforge tokens            # Usage token tracking
```

### Agent Management
```bash
agentforge agents list       # List all agents
agentforge agents create     # Create agent interactively
agentforge agents show       # Show agent details
agentforge agents delete     # Delete an agent
agentforge chat              # Interactive agent chat
```

### Skills & Tools
```bash
agentforge skills            # Skills marketplace (search, publish, featured)
agentforge skill             # Manage individual skills
agentforge cron              # Cron job management
agentforge workflows         # Workflow orchestration
```

### Data & State
```bash
agentforge sessions          # Chat session management
agentforge threads           # Conversation thread management
agentforge files             # File and folder management
agentforge projects          # Project/workspace management
```

### Integrations
```bash
agentforge mcp               # MCP server connections
agentforge channel-telegram  # Telegram bot setup
agentforge channel-whatsapp  # WhatsApp Cloud API setup
agentforge channel-slack     # Slack Bolt.js setup
agentforge channel-discord   # Discord bot setup
```

### Tools & Utilities
```bash
agentforge sandbox           # E2B sandbox management
agentforge browser           # Browser automation
agentforge voice             # Voice (TTS/STT) tools
agentforge research          # Research orchestrator
```

### Configuration
```bash
agentforge config            # Project configuration
agentforge vault             # Secrets management
agentforge keys              # LLM provider API keys
agentforge status            # System health check
```

See [docs/CLI.md](docs/CLI.md) for the full reference.

---

## Documentation

- [Getting Started](docs/getting-started.md) — Install to first agent in 5 minutes
- [Architecture](docs/architecture.md) — System design deep-dive
- [Channels](docs/channels.md) — Telegram, WhatsApp, Slack, Discord setup
- [Skills](docs/skills.md) — Skills system and marketplace
- [MCP Integration](docs/mcp.md) — Model Context Protocol guide
- [A2A Protocol](docs/a2a.md) — Agent-to-Agent communication
- [CLI Reference](docs/CLI.md) — All CLI commands
- [Deployment](docs/deployment-guide.md) — Production deployment guide
- [Why AgentForge?](docs/competitive-positioning.md) — How we compare

---

## Built With

- **[TypeScript](https://www.typescriptlang.org/)** — Strict ESM, end-to-end type safety
- **[Mastra](https://mastra.ai)** — AI engine with multi-provider model routing
- **[Convex](https://convex.dev)** — Real-time serverless backend
- **[Cloudflare](https://cloudflare.com)** — Edge deployment (Pages + R2)
- **[Playwright](https://playwright.dev)** — Browser automation
- **[Zod](https://zod.dev)** — Runtime schema validation
- **[Vitest](https://vitest.dev)** — Test runner

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

This project uses [SpecSafe](https://specsafe.dev) spec-driven development — all features start as specs before code is written.

---

## License

[Apache 2.0](LICENSE) — Use it, modify it, deploy it. Your data stays yours.
