# AgentForge Project

Welcome to your new AgentForge project! This project was scaffolded by the `@agentforge-ai/cli`.

## 🚀 Quick Start

### 1. Install Dependencies

If this wasn't done automatically during project creation, install the dependencies for the root project and the dashboard:

```bash
# Install root dependencies
pnpm install

# Install dashboard dependencies
cd dashboard
pnpm install
cd ..
```

### 2. Configure Your Environment

Copy the example environment file and add your API keys. You only need to configure one LLM provider to get started.

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```dotenv
# Convex URL will be set automatically by `npx convex dev`
CONVEX_URL=

# Add your preferred LLM provider API key
OPENAI_API_KEY=sk-...
```

### 3. Start the Development Servers

AgentForge requires two concurrent processes for local development:

```bash
# Terminal 1: Start the Convex backend
npx convex dev

# Terminal 2: Launch the web dashboard
agentforge dashboard
```

- The **Convex backend** syncs your database schema and functions, providing a dashboard at `http://localhost:8187`.
- The **web dashboard** provides a UI for managing your agents, available at `http://localhost:3000`.

## 🤖 Your First Agent

Your default agent is defined in `src/agent.ts`. You can customize its instructions, model, and tools.

```typescript
// src/agent.ts
import { Agent } from '@agentforge-ai/core';

const myAgent = new Agent({
  id: 'my-first-agent',
  name: 'My First Agent',
  instructions: 'You are a helpful AI assistant...',
  model: 'openai/gpt-4o-mini',
});

export default myAgent;
```

## Project Structure

```
/my-agent-project
├── convex/                 # Convex backend (database schema, functions)
├── dashboard/              # Web dashboard frontend (Vite + React)
├── skills/                 # Custom agent skills
├── workspace/              # Default local file storage for agents
├── src/
│   └── agent.ts            # Your main agent definition
├── .env.local              # Your local environment variables
├── package.json
└── tsconfig.json
```

##  CLI Commands

Use the `agentforge` CLI to manage your project from the terminal.

```bash
# List all agents
agentforge agents list

# Chat with your agent
agentforge chat my-first-agent

# See all available commands
agentforge --help
```





## Learn More

- **[AgentForge Documentation](https://github.com/Agentic-Engineering-Agency/agentforge)**: Main project repository and documentation.
- **[Convex Docs](https://docs.convex.dev)**: Learn more about the real-time backend.
- **[Mastra Docs](https://mastra.ai/docs)**: Understand the core AI engine.
