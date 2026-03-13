# AgentForge CLI Reference

> **AgentForge** — NanoClaw: A minimalist agent framework powered by Mastra + Convex

## Installation

```bash
npm install -g @agentforge-ai/cli
```

## Quick Start

```bash
# Create a new project
agentforge create my-agent-project
cd my-agent-project

# Configure your LLM provider
agentforge config provider openai
# or: agentforge config provider openrouter

# Start development
agentforge run

# Launch the web dashboard
agentforge dashboard
```

---

## Project Lifecycle

### `agentforge create <project-name>`

Create a new AgentForge project with the default template.

```bash
agentforge create my-project
agentforge create my-project --template default
```

**Options:**
- `-t, --template <template>` — Project template (default: `default`)

### `agentforge run`

Start the local development environment (Convex dev server).

```bash
agentforge run
agentforge run --port 4000
```

**Options:**
- `-p, --port <port>` — Port for the dev server (default: `3000`)

### `agentforge deploy`

Deploy the Convex backend to production.

```bash
agentforge deploy
agentforge deploy --env .env.production
agentforge deploy --dry-run
agentforge deploy --rollback
```

**Options:**
- `--env <path>` — Path to environment file (default: `.env.production`)
- `--dry-run` — Preview deployment without executing
- `--rollback` — Rollback to previous deployment
- `--force` — Skip confirmation prompts

---

## Agent Management

### `agentforge agents list`

List all registered agents.

```bash
agentforge agents list
agentforge agents list --active
agentforge agents list --json
```

### `agentforge agents create`

Create a new agent interactively, or pass options directly.

```bash
agentforge agents create
agentforge agents create --name "Research Bot" --model "openai/gpt-4o" --instructions "You are a research assistant."
```

### `agentforge agents inspect <id>`

Show detailed information about an agent.

```bash
agentforge agents inspect research-bot
```

### `agentforge agents edit <id>`

Edit an existing agent.

```bash
agentforge agents edit research-bot --name "Research Agent v2"
agentforge agents edit research-bot --model "openrouter/anthropic/claude-3.5-sonnet"
```

### `agentforge agents delete <id>`

Delete an agent.

```bash
agentforge agents delete research-bot
agentforge agents delete research-bot --force
```

### `agentforge agents enable/disable <id>`

Toggle an agent's active status.

```bash
agentforge agents enable research-bot
agentforge agents disable research-bot
```

---

## Chat

### `agentforge chat [agent-id]`

Start an interactive chat session with an agent.

```bash
agentforge chat                    # Select agent interactively
agentforge chat research-bot       # Chat with specific agent
agentforge chat research-bot --thread <thread-id>  # Continue existing thread
agentforge chat research-bot -m "Hello"  # Send single message and exit
```

**Options:**
- `--thread <id>` — Continue existing thread (stored in Convex)
- `-m, --message <text>` — Send a single message and exit (non-interactive)
- `--port <n>` — Runtime HTTP port (default: 3001)
- `--no-stream` — Disable streaming (wait for full response)

> **Note:** The deprecated `-s, --session` option is superseded by `--thread`.

**In-chat commands:**
- `exit` / `quit` — End the session
- `/new` — Start a new thread
- `/history` — Show message history

**Model Override (v0.12.23+):**

The dashboard supports per-thread model override via the model picker in the chat header. The config cascade is: request-level > thread override > agent default. Override is stored in Convex and persists across page refreshes.

---

## Sessions

### `agentforge sessions list`

List all sessions.

```bash
agentforge sessions list
agentforge sessions list --status active
agentforge sessions list --json
```

### `agentforge sessions inspect <id>`

Show session details.

### `agentforge sessions end <id>`

End an active session.

---

## Threads

### `agentforge threads list`

List all conversation threads.

```bash
agentforge threads list
agentforge threads list --agent research-bot
```

### `agentforge threads inspect <id>`

Show all messages in a thread.

### `agentforge threads delete <id>`

Delete a thread and its messages.

### `agentforge threads rename <id> <name>`

Rename a thread.

```bash
agentforge threads rename thread_abc "Q1 Research"
```

---

## Skills

### `agentforge skills list`

List all skills (local and database).

```bash
agentforge skills list
agentforge skills list --installed
agentforge skills list --json
```

### `agentforge skills create`

Create a new skill interactively. Generates the skill directory with `index.ts`, `config.json`, and `SKILL.md`.

```bash
agentforge skills create
agentforge skills create --name web-scraper --description "Scrape web pages" --category web
```

### `agentforge skills install <name>`

Install a skill.

```bash
agentforge skills install web-search
```

### `agentforge skills remove <name>`

Remove a skill from disk and database.

```bash
agentforge skills remove web-search
```

### `agentforge skills search <query>`

Search available skills.

```bash
agentforge skills search web
agentforge skills search data
```

---

## Cron Jobs

### `agentforge cron list`

List all cron jobs.

```bash
agentforge cron list
agentforge cron list --json
```

### `agentforge cron create`

Create a new cron job interactively.

```bash
agentforge cron create
agentforge cron create --name "Daily Report" --schedule "0 0 9 * * *" --agent research-bot --action "Generate daily summary"
```

### `agentforge cron delete <id>`

Delete a cron job.

### `agentforge cron enable/disable <id>`

Toggle a cron job.

---

## MCP Connections

### `agentforge mcp list`

List all MCP (Model Context Protocol) connections.

```bash
agentforge mcp list
agentforge mcp list --json
```

### `agentforge mcp add`

Add a new MCP connection.

```bash
agentforge mcp add
agentforge mcp add --name "GitHub" --type stdio --endpoint "npx @modelcontextprotocol/server-github"
agentforge mcp add --name "Custom API" --type http --endpoint "https://api.example.com/mcp"
```

### `agentforge mcp remove <id>`

Remove an MCP connection.

### `agentforge mcp test <id>`

Test connectivity to an MCP server.

### `agentforge mcp enable/disable <id>`

Toggle an MCP connection.

---

## Files & Folders

### `agentforge files list [folder]`

List files, optionally filtered by folder.

```bash
agentforge files list
agentforge files list <folder-id>
```

### `agentforge files upload <filepath>`

Upload a file.

```bash
agentforge files upload ./report.pdf
agentforge files upload ./data.csv --folder <folder-id>
agentforge files upload ./image.png --project <project-id>
```

### `agentforge files delete <id>`

Delete a file.

### `agentforge folders list`

List all folders.

### `agentforge folders create <name>`

Create a folder.

```bash
agentforge folders create "Research Documents"
agentforge folders create "Subdir" --parent <parent-id>
```

### `agentforge folders delete <id>`

Delete a folder.

---

## Projects / Workspaces

### `agentforge projects list`

List all projects.

```bash
agentforge projects list
agentforge projects list --json
```

### `agentforge projects create <name>`

Create a new project.

```bash
agentforge projects create "Q2 Research"
agentforge projects create "Legal AI" --description "Legal document analysis project"
```

### `agentforge projects inspect <id>`

Show project details.

### `agentforge projects delete <id>`

Delete a project.

### `agentforge projects switch <id>`

Set the active project context.

---

## Configuration

### `agentforge config show`

Show current configuration (env files, Convex status, skills).

### `agentforge config set <key> <value>`

Set a configuration value in `.env.local`.

```bash
agentforge config set OPENAI_API_KEY sk-...
agentforge config set LLM_PROVIDER openrouter
```

### `agentforge config get <key>`

Get a configuration value.

```bash
agentforge config get LLM_PROVIDER
```

### `agentforge config init`

Interactive configuration wizard for new projects.

### `agentforge config provider <provider>`

Configure an LLM provider with API key.

```bash
agentforge config provider openai
agentforge config provider openrouter
agentforge config provider anthropic
agentforge config provider google
agentforge config provider xai
```

---

## Vault (Secrets)

### `agentforge vault list`

List all stored secrets (values hidden).

```bash
agentforge vault list
agentforge vault list --json
```

### `agentforge vault set <name> [value]`

Store a secret securely. Omit value for secure prompt (hidden input).

```bash
agentforge vault set OPENAI_API_KEY
agentforge vault set STRIPE_KEY sk-test-... --category api_key --provider stripe
```

### `agentforge vault get <name>`

Retrieve a secret (masked by default).

```bash
agentforge vault get OPENAI_API_KEY
agentforge vault get OPENAI_API_KEY --reveal
```

### `agentforge vault delete <name>`

Delete a secret.

```bash
agentforge vault delete OPENAI_API_KEY
agentforge vault delete OPENAI_API_KEY --force
```

### `agentforge vault rotate <name>`

Rotate a secret (set a new value).

```bash
agentforge vault rotate OPENAI_API_KEY
```

---

## System

### `agentforge status`

Show system health: project structure, Convex connection, LLM provider, skills.

```bash
agentforge status
```

### `agentforge dashboard`

Launch the web dashboard.

```bash
agentforge dashboard
agentforge dashboard --port 4000
```

### `agentforge logs`

Show recent activity logs.

```bash
agentforge logs
agentforge logs -n 50
agentforge logs --agent research-bot
agentforge logs --json
```

### `agentforge heartbeat`

Check for and resume pending agent tasks.

```bash
agentforge heartbeat
agentforge heartbeat --agent research-bot
```

---

## Channel Management

### `agentforge channel:telegram`

Manage the Telegram messaging channel.

```bash
agentforge channel:telegram configure    # Configure bot token and settings
agentforge channel:telegram start        # Start the Telegram bot
agentforge channel:telegram status       # Check bot configuration and connectivity
```

### `agentforge channel:whatsapp`

Manage the WhatsApp messaging channel.

```bash
agentforge channel:whatsapp configure
agentforge channel:whatsapp start
agentforge channel:whatsapp status
```

### `agentforge channel:slack`

Manage the Slack messaging channel.

```bash
agentforge channel:slack configure
agentforge channel:slack start
agentforge channel:slack status
```

### `agentforge channel:discord`

Manage the Discord messaging channel.

```bash
agentforge channel:discord configure
agentforge channel:discord start
agentforge channel:discord status
```

> **Note:** All channel commands use colon syntax (`channel:telegram`), not hyphen syntax.

---

## Tokens (API Access)

### `agentforge tokens generate`

Generate a new API access token. The plaintext token is shown **once only** and never persisted (stored as SHA-256 hash in Convex).

```bash
agentforge tokens generate
agentforge tokens generate --name "My App"
```

### `agentforge tokens list`

List all tokens (shows masked prefix only, not the hash).

### `agentforge tokens revoke <id>`

Revoke a token by ID.

### `agentforge tokens delete <nameOrId>`

Delete a token by name or ID.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CONVEX_URL` | Convex deployment URL | Yes |
| `LLM_PROVIDER` | Default LLM provider | No |
| `OPENAI_API_KEY` | OpenAI API key | If using OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter API key | If using OpenRouter |
| `ANTHROPIC_API_KEY` | Anthropic API key | If using Anthropic |
| `GOOGLE_API_KEY` | Google AI API key | If using Google |
| `XAI_API_KEY` | xAI/Grok API key | If using xAI |

---

## CLI vs Dashboard Feature Parity

| Feature | CLI Command | Dashboard Page |
|---------|-------------|----------------|
| Agent CRUD | `agents list/create/edit/delete` | Agents |
| Chat | `chat [agent-id]` | Chat |
| Sessions | `sessions list/inspect/end` | Sessions |
| Threads | `threads list/inspect/delete` | (within Chat) |
| Skills | `skills list/create/install/remove` | Skills |
| Cron Jobs | `cron list/create/delete/enable` | Cron Jobs |
| MCP | `mcp list/add/remove/test` | Connections |
| Files | `files list/upload/delete` | Files |
| Folders | `folders list/create/delete` | Files |
| Projects | `projects list/create/delete/switch` | Projects |
| Config | `config show/set/get/init/provider` | Settings |
| Vault | `vault list/set/get/delete/rotate` | Settings > Vault |
| Status | `status` | Overview |
| Logs | `logs` | Usage |
| Heartbeat | `heartbeat` | (automatic) |
| Dashboard | `dashboard` | — |
