# AgentForge

**AgentForge is an open-source AI agent framework built on Mastra + Convex with a real-time reactive backend.**

AgentForge provides a powerful and flexible platform for building, deploying, and managing autonomous AI agents. It combines a real-time backend with a comprehensive CLI and a rich set of features to streamline the development of sophisticated agentic applications.

## Quick Start

Get started with AgentForge in just a few steps:

1.  **Install the CLI:**

    ```bash
    npm install -g @agentforge-ai/cli
    ```

2.  **Create a new project:**

    ```bash
    agentforge create my-agent-project
    cd my-agent-project
    ```

3.  **Configure your environment:**

    Copy the example environment file and add your OpenRouter API key:

    ```bash
    cp .env.example .env.local
    ```

    Edit `.env.local` and add your `OPENROUTER_API_KEY`.

4.  **Start the development environment:**

    In one terminal, start the Convex backend:

    ```bash
    npx convex dev
    ```

    In another terminal, start the AgentForge development server:

    ```bash
    agentforge run
    ```

5.  **Chat with your agent:**

    ```bash
    agentforge chat
    ```

## Features

-   **Real-time Chat:** Interact with your agents in real-time through the CLI or the web dashboard, powered by Convex for seamless communication.
-   **Telegram Channel:** Connect your agents to Telegram with the built-in channel adapter.
-   **Installable Skills:** Extend your agents' capabilities with a rich ecosystem of installable skills. AgentForge comes with 6 built-in skills:
    -   `web-search`: Search the web for information.
    -   `file-manager`: Perform advanced file management operations.
    -   `code-review`: Systematically review code for bugs and style issues.
    -   `data-analyst`: Analyze structured data in CSV and JSON formats.
    -   `api-tester`: Test REST APIs.
    -   `git-workflow`: Automate Git workflows.
-   **Docker Container Isolation:** Execute agent tools in a secure Docker container for enhanced security and reproducibility.
-   **Comprehensive CLI:** Manage your entire AgentForge workflow with a powerful CLI that includes over 17 commands for creating, managing, and deploying your agents.

## API Reference

### @agentforge-ai/core

The `@agentforge-ai/core` package provides the foundational building blocks for creating and managing agents.

-   `Agent`: The core class for creating AI agents.
-   `SandboxManager`: Manages the secure execution of agent tools in a sandboxed environment.
-   `MCPServer`: A server for exposing tools to agents using the Model Context Protocol (MCP).
-   `ChannelAdapter`: A base class for creating custom channel adapters.
-   `TelegramChannel`: A pre-built channel adapter for Telegram.

### @agentforge-ai/cli

The `@agentforge-ai/cli` package provides a comprehensive set of commands for managing your AgentForge projects.

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `agentforge create`    | Create a new AgentForge project.                 |
| `agentforge run`       | Start the local development environment.         |
| `agentforge deploy`    | Deploy the project to production.                |
| `agentforge login`     | Authenticate with AgentForge Cloud.              |
| `agentforge agents`    | Manage agents.                                   |
| `agentforge chat`      | Start an interactive chat session with an agent. |
| `agentforge sessions`  | Manage chat sessions.                            |
| `agentforge threads`   | Manage conversation threads.                     |
| `agentforge skills`    | Manage agent skills.                             |
| `agentforge cron`      | Manage scheduled cron jobs.                      |
| `agentforge mcp`       | Manage MCP connections.                          |
| `agentforge files`     | Manage files in the agent workspace.             |
| `agentforge projects`  | Manage AgentForge projects.                      |
| `agentforge config`    | Manage project configuration.                    |
| `agentforge vault`     | Manage secrets in the vault.                     |
| `agentforge keys`      | Manage AI provider keys.                         |
| `agentforge status`    | Show the status of the AgentForge system.        |

## Installation

```bash
npm install @agentforge-ai/core @agentforge-ai/cli
```

## Configuration

AgentForge uses a combination of environment variables and a configuration file to manage project settings.

### Environment Variables

-   `OPENROUTER_API_KEY`: Your API key for OpenRouter, used for accessing a wide range of language models.
-   `TELEGRAM_BOT_TOKEN`: Your Telegram bot token for the Telegram channel.
-   `CONVEX_URL`: The URL of your Convex deployment.

### agentforge.config.ts

The `agentforge.config.ts` file is the central configuration file for your AgentForge project. It allows you to define your agents, workspace, skills, and other project settings.

## Architecture Overview

AgentForge is built on a modern, serverless architecture that leverages the power of Convex and Mastra.

-   **Convex:** Provides the real-time backend, database, and serverless functions that power the AgentForge platform.
-   **Mastra:** The AI engine that enables multi-provider LLM support and agent orchestration.
-   **Cloudflare:** AgentForge is designed to be deployed on Cloudflare, with support for Cloudflare Pages for the frontend and R2 for file storage.
