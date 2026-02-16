# My AgentForge Project

Built with [AgentForge](https://github.com/Agentic-Engineering-Agency/agentforge) — a NanoClaw made with Mastra.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment
cp .env.example .env
# Edit .env and add your API key (OpenAI, OpenRouter, Anthropic, etc.)

# 3. Start the Convex dev server
npx convex dev

# 4. Start building!
npm run dev
```

## Project Structure

```
├── convex/          # Convex schema and functions
│   └── schema.ts    # Database schema (agents, threads, messages, etc.)
├── src/
│   └── agent.ts     # Your agent definition
├── skills/          # Custom skills directory
├── .env.example     # Environment variable template
├── package.json
└── tsconfig.json
```

## CLI Commands

```bash
# Agent Management
agentforge agents list              # List all agents
agentforge agents create            # Create a new agent (interactive)
agentforge agents inspect <id>      # Show agent details
agentforge agents edit <id>         # Edit an agent
agentforge agents delete <id>       # Delete an agent

# Chat
agentforge chat <agent-id>          # Start chatting with an agent
agentforge chat --session <id>      # Resume a session

# Sessions & Threads
agentforge sessions list            # List all sessions
agentforge threads list             # List all threads

# Skills
agentforge skills list              # List installed skills
agentforge skills install <name>    # Install a skill
agentforge skills search <query>    # Search available skills

# Cron Jobs
agentforge cron list                # List cron jobs
agentforge cron create              # Create a cron job (interactive)

# MCP Connections
agentforge mcp list                 # List MCP connections
agentforge mcp add                  # Add a connection (interactive)
agentforge mcp test <id>            # Test connection health

# Files & Projects
agentforge files list               # List files
agentforge files upload <path>      # Upload a file
agentforge projects list            # List projects
agentforge projects create <name>   # Create a project

# Configuration & Vault
agentforge config list              # List all config
agentforge vault list               # List secrets (masked)
agentforge vault add <name> <value> # Store a secret

# Utilities
agentforge status                   # Show system health
agentforge logs                     # Tail recent logs
agentforge dashboard                # Open the web dashboard
agentforge deploy                   # Deploy to production
```

## Providers

AgentForge supports multiple LLM providers. Set your preferred provider in `.env`:

| Provider | Model Format | API Key Variable |
|----------|-------------|-----------------|
| OpenAI | `openai:gpt-4o-mini` | `OPENAI_API_KEY` |
| OpenRouter | `openrouter:anthropic/claude-3.5-sonnet` | `OPENROUTER_API_KEY` |
| Anthropic | `anthropic:claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| Google | `google:gemini-2.0-flash` | `GOOGLE_API_KEY` |
| xAI | `xai:grok-2` | `XAI_API_KEY` |

## Web Dashboard

Launch the dashboard for a visual interface:

```bash
agentforge dashboard
```

## Learn More

- [AgentForge Documentation](https://github.com/Agentic-Engineering-Agency/agentforge)
- [CLI Reference](https://github.com/Agentic-Engineering-Agency/agentforge/blob/main/docs/cli-reference.md)
- [Convex Docs](https://docs.convex.dev)
- [Mastra Docs](https://mastra.ai/docs)
