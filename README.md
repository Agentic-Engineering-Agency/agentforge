# AgentForge

**AgentForge: The Minimalist Framework for Collaborative AI Agents.**

AgentForge is a "NanoClaw made with Mastra" — a powerful, lightweight framework for building, managing, and deploying autonomous AI agents. It provides a seamless developer experience with a full-featured CLI, a real-time web dashboard, and a robust backend powered by Convex and Mastra.

[![NPM Version](https://img.shields.io/npm/v/@agentforge-ai/cli?color=33e)](https://www.npmjs.com/package/@agentforge-ai/cli)
[![License](https://img.shields.io/github/license/Agentic-Engineering-Agency/agentforge?color=4c1)](https://github.com/Agentic-Engineering-Agency/agentforge/blob/main/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/Agentic-Engineering-Agency/agentforge?style=social)](https://github.com/Agentic-Engineering-Agency/agentforge)

![AgentForge Dashboard](https://raw.githubusercontent.com/Agentic-Engineering-Agency/agentforge/main/docs/assets/dashboard-hero.png)

## Key Features

| Feature | Description |
|---|---|
| 🤖 **Agent Management** | Create, configure, and manage multiple agents with distinct instructions, models, and tools. |
| 💬 **Interactive Chat** | Real-time chat interface in both the CLI and web dashboard for seamless agent interaction. |
| 📂 **File Management** | Persistent file storage with folder organization, powered by local storage or Cloudflare R2. |
| 🛠️ **Extensible Skills** | Enhance agent capabilities with a simple, powerful skill system. Create custom tools with ease. |
| ⏰ **Cron Jobs** | Schedule agents to run tasks at specific intervals using cron expressions. |
| 🔌 **MCP Connections** | Integrate with external services and tools using the Model Context Protocol (MCP). |
| 🔐 **Secure Vault** | Safely store and manage API keys and other secrets with built-in encryption and auto-redaction. |
| 🔑 **AI Provider Keys** | Manage API keys for 8+ providers (OpenAI, Anthropic, Google, xAI, Groq, etc.) with test and rotate. |
| 🏪 **Integrations Marketplace** | Browse and connect MCP servers (GitHub, Slack, Notion, Brave Search, etc.) from the dashboard. |
| 🧩 **Prebuilt Skills** | Ready-to-use skills for web search, code execution, file operations, and more. |
| 💓 **HEARTBEAT System** | Ensures task continuity by allowing agents to monitor and resume long-running operations. |
| 📊 **Usage Tracking** | Monitor token usage and estimate costs across different LLM providers. |
| 🚀 **Cloudflare Ready** | Deploy your frontend to Cloudflare Pages and file storage to R2 with zero egress fees. |

## Tech Stack

AgentForge is built on a modern, serverless, and real-time technology stack, designed for performance and scalability.

- **Frontend**: TanStack Router, React, Vite, Tailwind CSS
- **Backend**: Convex (Real-time Database, Serverless Functions)
- **AI Engine**: Mastra (Multi-provider LLM support)
- **Deployment**: Cloudflare Pages (Frontend), Cloudflare R2 (File Storage)

## Getting Started

### 1. Install the CLI

```bash
# Using npm
npm install -g @agentforge-ai/cli

# Using pnpm
pnpm add -g @agentforge-ai/cli
```

### 2. Create a New Project

```bash
agentforge create my-agent-project
cd my-agent-project
```

This command scaffolds a new project with the recommended structure, including a `convex` backend, a `dashboard` frontend, and a default agent definition.

### 3. Configure Your Environment

Copy the example environment file and add your preferred LLM provider API key.

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```dotenv
# Your Convex deployment URL (set automatically by `npx convex dev`)
CONVEX_URL=

# Set the API key for your preferred provider (only one is needed)
OPENAI_API_KEY=sk-...
# OPENROUTER_API_KEY=sk-or-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=AIza...
# XAI_API_KEY=xai-...
```

### 4. Start the Development Servers

AgentForge requires two concurrent processes for local development:

```bash
# Terminal 1: Start the Convex backend
npx convex dev

# Terminal 2: Launch the web dashboard
agentforge dashboard
```

- The `convex dev` command syncs your database schema, runs your backend functions, and provides a live dashboard at `http://localhost:8187`.
- The `agentforge dashboard` command starts the Vite development server for the web UI, typically on `http://localhost:3000`.

## CLI Command Reference

AgentForge provides a comprehensive CLI for managing every aspect of your project.

### Project Lifecycle

| Command | Description |
|---|---|
| `agentforge create <name>` | Create a new AgentForge project. |
| `agentforge deploy` | Deploy the Convex backend to production. |
| `agentforge dashboard` | Launch the web dashboard. |
| `agentforge status` | Show system health and connection status. |
| `agentforge logs` | Tail recent activity logs. |
| `agentforge heartbeat` | Check and resume pending agent tasks. |

### Agent Management

| Command | Description |
|---|---|
| `agentforge agents list` | List all available agents. |
| `agentforge agents create` | Create a new agent via an interactive prompt. |
| `agentforge agents inspect <id>` | Show detailed information for a specific agent. |
| `agentforge agents edit <id>` | Edit an agent's properties. |
| `agentforge agents delete <id>` | Delete an agent. |
| `agentforge agents enable <id>` | Activate an agent. |
| `agentforge agents disable <id>` | Deactivate an agent. |

### Chat & Sessions

| Command | Description |
|---|---|
| `agentforge chat [agent-id]` | Start an interactive chat session with an agent. |
| `agentforge sessions list` | List all active and past sessions. |
| `agentforge sessions inspect <id>` | Show details for a specific session. |
| `agentforge sessions end <id>` | Terminate an active session. |
| `agentforge threads list` | List all conversation threads. |
| `agentforge threads inspect <id>` | Show the message history of a thread. |
| `agentforge threads delete <id>` | Delete a thread and all its messages. |

### Skills & Capabilities

| Command | Description |
|---|---|
| `agentforge skills list` | List all installed skills. |
| `agentforge skills create` | Create a new skill from a template. |
| `agentforge skills install <name>` | Install a skill into your project. |
| `agentforge skills remove <name>` | Remove a skill. |
| `agentforge skills search <query>` | Search for available skills. |

### Automation & Scheduling

| Command | Description |
|---|---|
| `agentforge cron list` | List all scheduled cron jobs. |
| `agentforge cron create` | Create a new cron job. |
| `agentforge cron delete <id>` | Delete a cron job. |
| `agentforge cron enable <id>` | Enable a cron job. |
| `agentforge cron disable <id>` | Disable a cron job. |

### File & Project Management

| Command | Description |
|---|---|
| `agentforge files list [folder]` | List files, optionally filtered by folder. |
| `agentforge files upload <path>` | Upload a file to the workspace. |
| `agentforge files delete <id>` | Delete a file. |
| `agentforge folders create <name>` | Create a new folder. |
| `agentforge projects list` | List all projects. |
| `agentforge projects create <name>` | Create a new project. |
| `agentforge projects switch <id>` | Set the active project for CLI commands. |

### AI Provider Keys

| Command | Description |
|---|---|
| `agentforge keys list` | List all configured AI provider API keys. |
| `agentforge keys add <provider> [key]` | Add an API key for a provider (omit key for secure prompt). |
| `agentforge keys remove <provider>` | Remove an API key. |
| `agentforge keys test <provider>` | Test an API key by making a simple request. |

Supported providers: `openai`, `anthropic`, `openrouter`, `google`, `xai`, `groq`, `together`, `perplexity`.

### Configuration & Secrets

| Command | Description |
|---|---|
| `agentforge config show` | Display the current project configuration. |
| `agentforge config set <key> <value>` | Set a configuration value in `.env.local`. |
| `agentforge config get <key>` | Retrieve a configuration value. |
| `agentforge config provider <name>` | Interactively configure an LLM provider. |
| `agentforge vault list` | List all secrets stored in the vault (values masked). |
| `agentforge vault set <name> [value]` | Store a new secret securely. |
| `agentforge vault get <name>` | Retrieve a secret (use `--reveal` to show value). |
| `agentforge vault delete <name>` | Delete a secret from the vault. |
| `agentforge vault rotate <name>` | Update the value of an existing secret. |

## Project Structure

A new AgentForge project has the following structure:

```
/my-agent-project
├── convex/                 # Convex backend (database schema, functions)
│   ├── schema.ts
│   └── *.ts
├── dashboard/              # Web dashboard frontend (Vite + React)
│   ├── src/
│   └── package.json
├── skills/                 # Custom agent skills
│   └── skill-creator/
├── workspace/              # Default local file storage for agents
├── .env.local              # Your local environment variables (gitignored)
├── .env.example            # Example environment file
├── package.json
└── tsconfig.json
```

## Core Concepts

- **Agents**: The fundamental actors in the system. Each agent has a unique identity, instructions, and a configured LLM.
- **Workspace**: The agent's environment, powered by Mastra Workspace. It provides a unified interface for:
  - **Filesystem**: Persistent file storage (local, S3, GCS).
  - **Sandbox**: Secure code execution (local or E2B).
  - **Skills**: Reusable capabilities following the Agent Skills specification.
  - **Search**: Advanced content retrieval (BM25, Vector, Hybrid).
- **HEARTBEAT**: A system that allows agents to persist their state and resume long-running tasks across interruptions.
- **Vault**: An encrypted storage for secrets that automatically detects and redacts sensitive information from chat messages.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

## License

AgentForge is licensed under the Apache-2.0 License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by the design and philosophy of [OpenClaw](https://github.com/safeclaw/openclaw) and [NanoClaw](https://nanoclaw.net).
- Built with the excellent [TanStack](https://tanstack.com/) tools.
- Powered by [Mastra](https://mastra.ai) for multi-provider AI.
- Real-time backend by [Convex](https://convex.dev).
