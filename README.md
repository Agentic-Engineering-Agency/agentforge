# AgentForge (NanoClaw) 🚀

A minimalist, enterprise-grade framework for building collaborative AI agents, built on [Mastra](https://mastra.ai), [Convex](https://convex.dev), and [E2B](https://e2b.dev).

This is the **NanoClaw** edition—a focused, core implementation of the AgentForge vision, designed for developers who need a robust, secure, and scalable foundation for their AI agent applications.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://typescriptlang.org)
[![Status](https://img.shields.io/badge/status-active-green.svg)](https://github.com/Agentic-Engineering-Agency/agentforge)

## ✨ Core Features (NanoClaw Edition)

- 🤖 **Core Agent Primitives**: A simple, powerful `Agent` class that wraps `@mastra/core` to support any AI SDK-compatible model provider (OpenAI, Anthropic, Google, etc.) using a Bring-Your-Own-Key (BYOK) model.
-  CLI Scaffolding: A command-line tool (`@agentforge/cli`) to instantly create new agent projects with a pre-configured Convex backend.
- ️ **Secure Code Execution**: All tool code runs in a secure E2B sandbox, providing enterprise-grade isolation and preventing malicious code execution.
- 🤝 **Agent-to-Tool Communication**: A built-in Model Context Protocol (MCP) server for standardized, type-safe communication between agents and their tools.
- ️ **Real-Time State**: Leverages Convex for real-time database and backend functions, perfect for collaborative agent workflows.

## 📦 Packages

This monorepo contains the core packages for the AgentForge NanoClaw framework.

| Package | Description |
|---|---|
| `@agentforge/core` | Core agent, sandbox, and MCP server primitives. |
| `@agentforge/cli` | CLI tool for scaffolding and running AgentForge projects. |

## 🚀 Quick Start

Get your first AgentForge project running in under a minute.

### 1. Install the CLI

```bash
# Install the CLI globally
npm install -g @agentforge/cli
```

### 2. Create a New Project

```bash
# Create a new project directory
agentforge create my-first-agent
```

This command scaffolds a new project with the following structure:

```
my-first-agent/
├── convex/          # Convex schema and functions
│   └── schema.ts    # Database schema (agents, threads, messages)
├── src/
│   └── agent.ts     # Your agent definition
├── .env.example     # Example environment variables
├── package.json
└── tsconfig.json
```

### 3. Configure Environment

Copy the `.env.example` to `.env` and add your API keys.

```bash
cp .env.example .env
```

```dotenv
# .env
OPENAI_API_KEY=sk-your-key-here
E2B_API_KEY=e2b_your-key-here
```

### 4. Run the Development Server

This command starts the Convex local development server.

```bash
cd my-first-agent
agentforge run
```

Your agent is now running locally! You can interact with it by writing scripts that import and use your agent from `src/agent.ts`.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

AgentForge is licensed under the [Apache 2.0 License](LICENSE).

## 🏢 Organization

Built with ❤️ by [Agentic Engineering](https://agenticengineering.agency) — Guadalajara, Mexico.
