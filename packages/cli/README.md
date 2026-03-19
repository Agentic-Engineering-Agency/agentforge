# @agentforge-ai/cli

Command-line interface for scaffolding, starting, and operating AgentForge projects.

## What This Package Does

The CLI entrypoint is defined in `src/index.ts`. It wires together project creation, Convex bootstrap, daemon startup, interactive chat, dashboard launch, deployment helpers, and project management commands.

## Installation

```bash
npm install -g @agentforge-ai/cli
```

For local development inside this monorepo:

```bash
pnpm install
pnpm --filter @agentforge-ai/cli build
```

## Command Families

### Project Lifecycle

- `agentforge create <project-name>`: scaffold a new project from the default template
- `agentforge run`: start the local Convex development environment for a project
- `agentforge deploy`: run the Convex deploy wrapper
- `agentforge upgrade`: sync the project `convex/` directory with the latest template

### Runtime And Chat

- `agentforge start`: start the persistent AgentForge daemon and HTTP channel
- `agentforge chat [agent-id]`: send messages to the running daemon over the local HTTP/SSE interface

### Agent, Session, And Project Management

- `agentforge agents`
- `agentforge sessions`
- `agentforge threads`
- `agentforge files`
- `agentforge projects`

### Skills, MCP, And Orchestration

- `agentforge skills`
- `agentforge skill`
- `agentforge mcp`
- `agentforge cron`
- `agentforge workflows`
- `agentforge research`
- `agentforge sandbox`

### Configuration And Status

- `agentforge config`
- `agentforge vault`
- `agentforge keys`
- `agentforge models`
- `agentforge workspace`
- `agentforge tokens`
- `agentforge status`
- `agentforge dashboard`
- `agentforge logs`

### Channels

- `agentforge channel:telegram`
- `agentforge channel:whatsapp`
- `agentforge channel:slack`
- `agentforge channel:discord`

## Local Project Workflow

The current commands are designed to be used in this order inside a scaffolded project:

```bash
# Terminal 1
npx convex dev

# Terminal 2
agentforge start

# Terminal 3
agentforge chat
```

Optional dashboard:

```bash
agentforge dashboard
```

Behavior notes from the current implementation:

- `run` is a Convex/local environment bootstrap command, not the daemon.
- `start` requires a valid `CONVEX_URL` and at least one agent stored in Convex.
- `chat` requires the daemon HTTP endpoint to already be reachable.
- `dashboard` is registered from `src/commands/status.ts`, not from a dedicated dashboard command file.

## Template Source

The CLI scaffolds from `templates/default/`. If you change template-backed files, make sure the synced copies in the repo stay aligned.

## License

Apache-2.0
