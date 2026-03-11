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

```bash
agentforge keys add openai "sk-..."
```

Or set it via Convex dashboard → **Settings → Environment Variables**.

## 5. Create Your First Agent

```bash
agentforge agents create
```

Or use the dashboard:

```bash
agentforge dashboard
```

## 6. Start the Daemon

AgentForge runs as a persistent daemon (not via Convex actions). You need two processes running simultaneously:

**Terminal 1 — Convex backend:**
```bash
npx convex dev
```

**Terminal 2 — AgentForge daemon:**
```bash
agentforge start
```

The daemon reads `CONVEX_URL` from `.env.local` and boots all agents defined in your Convex database. It exposes an OpenAI-compatible HTTP endpoint on port 4111 by default.

## 7. Start Chatting

**Terminal 3 — Chat:**
```bash
agentforge chat
```

Or use the dashboard:
```bash
agentforge dashboard
```

## Project Structure

```
my-agent-app/
├── convex/              # Backend — Convex data layer (no LLM logic)
│   ├── agents.ts        # Agent CRUD
│   ├── apiKeys.ts       # Encrypted API key storage
│   ├── threads.ts       # Conversation threads
│   └── messages.ts      # Message storage
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
