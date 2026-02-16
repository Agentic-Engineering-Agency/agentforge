# AgentForge 🚀

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)
[![Status](https://img.shields.io/badge/status-active-green.svg)](https://github.com/Agentic-Engineering-Agency/agentforge)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/Agentic-Engineering-Agency/agentforge)
[![npm](https://img.shields.io/npm/v/@agentforge-ai/core.svg)](https://www.npmjs.com/package/@agentforge-ai/core)

**The Minimalist Framework for Collaborative AI Agents**

A production-ready framework for building, managing, and deploying AI agents with a focus on simplicity, scalability, and developer experience. Inspired by OpenClaw's architecture and NanoClaw's minimalist philosophy, AgentForge combines the best of both worlds with modern tools.

Built on [Mastra](https://mastra.ai), [Convex](https://convex.dev), and [E2B](https://e2b.dev).

## ✨ Features

### 🤖 Agent Management
- **Multi-Provider Support**: OpenAI, Anthropic, OpenRouter, Google, xAI
- **BYOK Model**: Bring Your Own Key for all providers
- **Dynamic Tooling**: Add tools to agents on the fly
- **Secure Execution**: E2B sandboxes for safe code execution
- **Real-time State**: Powered by Convex

### 💬 Chat & Sessions
- **Interactive Chat**: Real-time conversation interface
- **Session Management**: Track and manage active conversations
- **Message History**: Persistent conversation context
- **Multi-Channel Support**: Dashboard, API, webhooks

### 📁 File Management
- **File Upload**: Drag-and-drop file uploads
- **Folder Organization**: Hierarchical folder structure
- **Cloudflare R2 Integration**: Cost-effective file storage

### 🗂️ Projects & Workspaces
- **Project Organization**: Group agents, files, and conversations
- **Project Settings**: Per-project configuration

### 🛠️ Skills Marketplace
- **Skill Discovery**: Browse available skills
- **Easy Installation**: One-click skill installation
- **Custom Skills**: Develop and share your own skills

### ⏰ Cron Jobs
- **Scheduled Tasks**: Run agents on a schedule
- **Execution History**: View past runs and results

### 🔌 MCP Connections
- **Model Context Protocol**: Connect to external services
- **Tool Integration**: Extend agent capabilities

### 📊 Usage & Metrics
- **Token Tracking**: Monitor token usage per agent
- **Cost Estimation**: Estimate costs across providers
- **Usage Statistics**: Analyze usage trends

### 💓 Heartbeat System
- **Task Continuity**: Agents can check on ongoing conversations
- **Pending Tasks**: Track and resume unfinished work
- **Context Maintenance**: Preserve context across sessions

### 🎨 Web Dashboard
- **Modern UI**: Built with TanStack Start and Tailwind CSS
- **Dark Theme**: Eye-friendly dark mode
- **Responsive Design**: Works on desktop and mobile
- **Real-time Updates**: Powered by Convex subscriptions

## 📦 Packages

| Package | Description |
|---|---|
| `@agentforge-ai/core` | Core agent, sandbox, and MCP server primitives |
| `@agentforge-ai/cli` | CLI tool for scaffolding and running projects |
| `@agentforge-ai/web` | Web dashboard for managing agents |

## 🚀 Quick Start

### 1. Install the CLI

```bash
npm install -g @agentforge-ai/cli
# or
pnpm add -g @agentforge-ai/cli
```

### 2. Create a New Project

```bash
agentforge create my-first-agent
cd my-first-agent
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Add your API keys to `.env`:

```dotenv
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
E2B_API_KEY=e2b_your-key-here
```

### 4. Start Development

```bash
# Start Convex backend
agentforge run

# In another terminal, start web dashboard
cd packages/web
pnpm dev
```

Open http://localhost:3000 to access the dashboard.

### 5. Create Your First Agent

```typescript
import { Agent } from "@mastra/core/agent";

const agent = new Agent({
  id: "my-agent",
  name: "My First Agent",
  instructions: "You are a helpful AI assistant.",
  model: "openai/gpt-4o-mini",
  tools: {},
});

export default agent;
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Web Dashboard (TanStack Start)                │
│  Chat • Agents • Files • Projects • Skills • Cron • Usage   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex (Backend)                          │
│  Real-time Database • Queries • Mutations • Actions          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mastra (Agent Engine)                       │
│  OpenAI • Anthropic • OpenRouter • Google • xAI              │
└─────────────────────────────────────────────────────────────┘
```

## 📚 Documentation

- [Getting Started](docs/getting-started.md)
- [Agent Configuration](docs/agents.md)
- [Web Dashboard](packages/web/README.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)

## 🗺️ Roadmap

### v0.3.0 (Current)
- ✅ Convex schema and backend
- ✅ Mastra integration
- ✅ Web dashboard
- ✅ Multi-provider support
- ✅ Heartbeat system
- 🚧 Real-time execution
- 🚧 File management
- 🚧 Usage tracking

### v0.4.0
- ⏳ Skills marketplace
- ⏳ Cron jobs
- ⏳ MCP connections
- ⏳ Authentication
- ⏳ Multi-user support

### v1.0.0
- ⏳ Production-ready
- ⏳ Enterprise features
- ⏳ Advanced observability
- ⏳ Marketplace ecosystem

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

Apache-2.0 - See [LICENSE](LICENSE) for details.

## 🏢 Organization

Built with ❤️ by [Agentic Engineering](https://agenticengineering.agency) — Guadalajara, Mexico.

## 🙏 Acknowledgments

- Inspired by [OpenClaw](https://github.com/safeclaw/openclaw) and [NanoClaw](https://nanoclaw.net)
- Built with [TanStack Start](https://tanstack.com/start)
- Powered by [Mastra](https://mastra.ai)
- Database by [Convex](https://convex.dev)
- Sandboxes by [E2B](https://e2b.dev)
