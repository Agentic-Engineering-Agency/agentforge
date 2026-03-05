# Getting Started

Get from zero to a running agent in 5 minutes.

## Prerequisites

- Node.js >= 18
- A [Convex](https://convex.dev) account (free)
- An OpenAI API key (or Anthropic / Google / Mistral / DeepSeek / xAI)

## 1. Install the CLI

```bash
npm install -g @agentforge-ai/cli
```

## 2. Create a New Project

```bash
agentforge create my-agent-app
cd my-agent-app
```

This scaffolds your project and installs all dependencies automatically.

## 3. Initialize Convex Backend

```bash
npx convex dev
```

Follow the interactive prompts to create a new Convex project. Your schema, functions, and indexes are deployed automatically.

## 4. Set Your LLM API Key

In the Convex dashboard (https://dashboard.convex.dev), go to **Settings → Environment Variables** and add:

```
OPENAI_API_KEY=sk-...
```

Or add it via CLI after deploying:

```bash
npx convex env set OPENAI_API_KEY "sk-..."
```

## 5. Create Your First Agent

```bash
agentforge agents create
```

Or store a key and create an agent via the dashboard:

```bash
agentforge keys add openai "sk-..."
agentforge dashboard
```

## 6. Start Chatting

```bash
agentforge chat <agent-id>
```

## Project Structure

```
my-agent-app/
├── convex/              # Backend — Convex functions
│   ├── agents.ts        # Agent CRUD
│   ├── chat.ts          # Chat pipeline with failover
│   ├── lib/
│   │   └── agent.ts     # Multi-provider LLM client
│   └── modelFetcher.ts  # Live model lists from provider APIs
├── dashboard/           # Web UI (React + Vite)
├── workspace/           # Agent workspace files
├── skills/              # Agent skills (SKILL.md files)
└── package.json
```

## Supported Providers

| Provider | Model Fetch | Chat |
|----------|-------------|------|
| OpenAI | ✅ Live API | ✅ |
| Anthropic | ✅ Live API | ✅ |
| Google | ✅ Live API | ✅ |
| Mistral | ✅ Live API | ✅ |
| DeepSeek | ✅ Live API | ✅ |
| xAI / Grok | ✅ Live API | ✅ |
| OpenRouter | ✅ Live API | ✅ |
| Cohere | ✅ Live API | ✅ |

## Next Steps

- [CLI Reference](./CLI.md) — full list of commands
- [Architecture](./architecture.md) — how it all fits together
- [Skills](./skills.md) — extend agents with custom skills
- [MCP Integration](./mcp.md) — connect MCP servers
