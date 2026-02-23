# Getting Started

Get from zero to a running agent in 5 minutes.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **pnpm** — `npm install -g pnpm` (or use npm/yarn)
- **Convex account** — [Sign up free](https://convex.dev)
- An LLM provider API key (OpenRouter, OpenAI, Anthropic, etc.)

## 1. Install the CLI

```bash
npm install -g @agentforge-ai/cli
```

Verify the installation:

```bash
agentforge --version
```

## 2. Create a project

```bash
agentforge create my-agent
cd my-agent
```

This scaffolds a new project with:

```
my-agent/
├── agentforge.config.ts   # Agent and project configuration
├── convex/                # Convex backend (schema, functions)
├── .env.example           # Environment variable template
├── package.json
└── tsconfig.json
```

## 3. Set up your environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys:

```env
# Required: LLM Provider (pick one or more)
OPENROUTER_API_KEY=sk-or-...
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_API_KEY=...

# Required: Convex backend
CONVEX_URL=https://your-deployment.convex.cloud

# Optional: Channels
# TELEGRAM_BOT_TOKEN=...
# WHATSAPP_ACCESS_TOKEN=...
# WHATSAPP_PHONE_NUMBER_ID=...
# SLACK_BOT_TOKEN=xoxb-...
# SLACK_APP_TOKEN=xapp-...
# DISCORD_BOT_TOKEN=...

# Optional: Voice
# ELEVENLABS_API_KEY=...
# OPENAI_API_KEY=sk-...  (also used for Whisper STT)

# Optional: File storage
# R2_ENDPOINT=...
# R2_ACCESS_KEY_ID=...
# R2_SECRET_ACCESS_KEY=...
```

### Setting up Convex

If you don't have a Convex deployment yet:

```bash
npx convex dev
```

This creates a new Convex project and gives you a `CONVEX_URL`. Add it to your `.env.local`.

## 4. Run your agent

Start the Convex backend and AgentForge dev server:

```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: AgentForge
agentforge run
```

## 5. Chat with your agent

```bash
agentforge chat
```

This opens an interactive terminal session. Type a message and your agent responds using the configured LLM provider.

## Connecting Telegram

To connect your agent to Telegram:

1. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token to your `.env.local`:
   ```env
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
   ```
3. Configure the channel:
   ```bash
   agentforge channel-telegram configure
   ```
4. Start the agent with Telegram enabled:
   ```bash
   agentforge run
   ```

Your agent now responds to Telegram messages. See [docs/channels.md](channels.md) for WhatsApp, Slack, and Discord setup.

## Installing skills

AgentForge comes with 6 built-in skills. To install additional skills:

```bash
# List available skills
agentforge skills

# Install a skill
agentforge skill install web-search
```

See [docs/skills.md](skills.md) for the full skills guide.

## Project configuration

The `agentforge.config.ts` file controls your project:

```typescript
import { defineConfig } from '@agentforge-ai/core';

export default defineConfig({
  agents: [{
    name: 'my-agent',
    model: 'openai/gpt-4o',          // "provider/model" format
    instructions: 'You are a helpful assistant.',
    skills: ['web-search', 'file-manager'],
  }],
  workspace: {
    provider: 'local',                // or 'r2' for cloud storage
    path: './workspace',
  },
});
```

## Next steps

- [Architecture](architecture.md) — Understand the system design
- [Channels](channels.md) — Connect Telegram, WhatsApp, Slack, Discord
- [Skills](skills.md) — Build and publish custom skills
- [MCP Integration](mcp.md) — Connect external tool servers
- [A2A Protocol](a2a.md) — Agent-to-agent communication
- [Deployment](deployment-guide.md) — Deploy to production
