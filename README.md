# AgentForge

AgentForge is a TypeScript monorepo for building and operating self-hosted AI agents with a persistent Mastra runtime, a Convex-backed data layer, and CLI-driven local workflows.

The repository currently contains the framework packages, the local Convex app used during development, the default project template scaffolded by the CLI, and example projects.

## Monorepo Layout

```text
agentforge/
├── packages/
│   ├── cli/                   # agentforge CLI and project scaffolding
│   ├── runtime/               # Persistent Mastra daemon and channel adapters
│   ├── core/                  # Shared agent, sandbox, MCP, channel, A2A, voice primitives
│   └── web/                   # Standalone dashboard package
├── convex/                    # Local Convex app copy used in repo development
├── templates/default/         # Synced default project template assets
├── examples/finforge/         # Example project
├── docs/                      # Project documentation
└── tests/e2e/                 # End-to-end test suite
```

The scaffolded project template source of truth lives under [`packages/cli/templates/default/`](packages/cli/templates/default/), and Convex template changes must stay synced with the generated copies.

## What Exists Today

- `@agentforge-ai/cli`: scaffolds projects and provides the operational commands used during local development.
- `@agentforge-ai/runtime`: exports the daemon, agent factory, Convex-backed memory helpers, and HTTP/Discord/Telegram channel adapters.
- `@agentforge-ai/core`: exports shared agent primitives, sandboxing, MCP, channels, skills, A2A, research, workflows, voice, and browser tooling.
- `@agentforge-ai/web`: a package-specific dashboard app.
- `convex/`: the repo’s local Convex backend copy, which mirrors the default template’s Convex layer.

## CLI Surface

The CLI currently registers these command families from [`packages/cli/src/index.ts`](packages/cli/src/index.ts):

- Project lifecycle: `create`, `run`, `deploy`, `upgrade`
- Runtime: `start`
- Cloud/auth/config: `models`, `workspace`, `tokens`, `config`, `vault`, `keys`, `status`
- Agent and chat: `agents`, `chat`, `sessions`, `threads`
- Skills and orchestration: `skills`, `skill`, `cron`, `workflows`, `research`
- Data and files: `files`, `projects`
- Integrations: `mcp`, `channel-telegram`, `channel-whatsapp`, `channel-slack`, `channel-discord`
- Execution: `sandbox`
- Dashboard and logs: `dashboard`, `logs` are registered from the status command module

Important behavior:

- `agentforge run` starts the local Convex development environment.
- `agentforge start` boots the persistent daemon and HTTP channel.
- `agentforge chat` talks to the daemon over the local HTTP/SSE endpoint.
- `agentforge dashboard` starts a dashboard if it can find one in the project or repo layout.

## Development

### Prerequisites

- Node.js `>=18`
- pnpm `>=8`

### Install Repo Dependencies

```bash
pnpm install
```

### Standard Contributor Commands

Run these from the repo root while working on framework code:

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

When editing template-backed Convex files, sync the copies afterward:

```bash
pnpm sync-templates
```

### Working On The Template Dashboard

`packages/cli/templates/default/dashboard` is not a workspace package. If you need to run or edit that dashboard directly, install its dependencies inside that directory:

```bash
cd packages/cli/templates/default/dashboard
pnpm install
pnpm dev
```

### Start A Local AgentForge Project For Contribution

Use this flow when you need to validate the framework against a real project scaffold.

1. Build the workspace packages from the repo root.
2. Create a fresh project or use an existing scaffold.
3. Configure the project `.env.local`.
4. Start Convex.
5. Start the AgentForge daemon.
6. Chat with an agent and optionally start the dashboard.

Example flow:

```bash
# From the repo root
pnpm build

# Create a local test project
node packages/cli/dist/index.js create /tmp/agentforge-dev
cd /tmp/agentforge-dev

# Configure environment
cp .env.example .env.local

# Terminal 1: start Convex first
npx convex dev

# Terminal 2: start the daemon
agentforge start

# Terminal 3: talk to the daemon
agentforge chat

# Optional: start the dashboard if the project has a dashboard directory
agentforge dashboard
```

### Environment And Startup Requirements

These requirements are enforced by the current command implementations:

- `CONVEX_URL` must exist before `agentforge start`. The command reads it from the environment or from `.env.local`, and it expects `npx convex dev` to have been run first.
- At least one agent must exist in Convex before `agentforge start` can boot usable runtime agents.
- `agentforge chat` requires the daemon to already be running on the local HTTP port.
- `agentforge dashboard` only starts if it can find a dashboard directory in the project, repo layout, or installed package path.

## Documentation Map

- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/CLI.md)
- [Architecture](docs/architecture.md)
- [Channels](docs/channels.md)
- [Skills](docs/skills.md)
- [MCP](docs/mcp.md)
- [A2A](docs/a2a.md)
- [Advanced Tools](docs/advanced-tools.md)
- [Multi-Agent Collaboration](docs/multi-agent-collaboration.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Technical Reference](docs/TECH-REFERENCE.md)
- [FinForge Demo](docs/finforge-demo.md)
- [Competitive Positioning](docs/competitive-positioning.md)

## Package Docs

- [CLI package README](packages/cli/README.md)
- [Runtime package README](packages/runtime/README.md)
- [Core package README](packages/core/README.md)
- [Web package README](packages/web/README.md)
- [Default template README](packages/cli/templates/default/README.md)

## Testing

- Unit and package tests: `pnpm test`
- Type checking: `pnpm typecheck`
- End-to-end suite: see [`tests/e2e/README.md`](tests/e2e/README.md)

## License

[Apache 2.0](LICENSE)
