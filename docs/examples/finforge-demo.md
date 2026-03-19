---
title: "FinForge Demo"
description: "Step-by-step tutorial building a financial intelligence agent showcasing agents, tools, Convex state, and the CLI."
---

# Tutorial: Building FinForge — A Financial Intelligence Agent

This tutorial walks you through building **FinForge**, a financial intelligence agent, step by step. By the end, you'll understand how to use every core primitive in the AgentForge framework.

## What We're Building

FinForge is an AI-powered financial analyst that can:

- Fetch real-time stock quotes
- Perform fundamental analysis
- Calculate portfolio risk metrics
- Summarize market news with sentiment analysis
- Generate natural language insights using any LLM

## Prerequisites

- Node.js 18+ and pnpm
- An OpenAI API key (or any AI SDK-compatible provider)
- Basic TypeScript knowledge

## Step 1: Create the Project

Start by scaffolding a new AgentForge project:

```bash
npm install -g @agentforge-ai/cli
agentforge create finforge
cd finforge
```

This gives you a working project with a Convex schema and a sample agent. We'll customize everything from here.

## Step 2: Define Your Tools

Tools are the bridge between your agent and the outside world. Create `src/tools.ts`:

```typescript
import { z } from 'zod';
import { MCPServer } from '@agentforge-ai/core';

export function createFinForgeMCPServer(): MCPServer {
  const server = new MCPServer({
    name: 'finforge-tools',
    version: '0.1.0',
  });

  // Register a stock quote tool
  server.registerTool(
    'get_stock_quote',
    'Fetch the current stock quote for a ticker symbol.',
    z.object({
      symbol: z.string().describe('The stock ticker symbol (e.g., AAPL)'),
    }),
    async ({ symbol }) => {
      // In production, call a real API here (Alpha Vantage, Polygon, etc.)
      return {
        symbol: symbol.toUpperCase(),
        price: 237.49,
        change: 3.21,
        changePct: 1.37,
        volume: 54_320_100,
      };
    }
  );

  return server;
}
```

**Key concept**: The `MCPServer` uses the Model Context Protocol to provide a standardized way for agents to discover and call tools. Each tool is defined with a Zod schema, which gives you automatic input validation and JSON Schema generation for LLM function calling.

## Step 3: Create the Agent

Now, define your agent in `src/agent.ts`:

```typescript
import { Agent } from '@agentforge-ai/core';
import type { LanguageModelV1 } from 'ai';
import { createFinForgeMCPServer } from './tools.js';

const INSTRUCTIONS = `You are FinForge, a senior financial intelligence analyst.
You help users make informed investment decisions by providing data-driven analysis.
Always cite specific numbers and include a disclaimer.`;

export function createFinForgeAgent(model: LanguageModelV1) {
  const mcpServer = createFinForgeMCPServer();

  const agent = new Agent({
    id: 'finforge-analyst',
    name: 'FinForge Financial Analyst',
    instructions: INSTRUCTIONS,
    model,
  });

  return { agent, mcpServer };
}
```

**Key concept**: The `Agent` class wraps `@mastra/core` and accepts any `LanguageModelV1` instance. This is the **BYOK (Bring Your Own Key)** pattern — you provide the model, the framework never handles your API keys.

## Step 4: Extend the Convex Schema

Open `convex/schema.ts` and add financial-specific tables:

```typescript
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Base AgentForge tables
  agents: defineTable({ /* ... */ }),
  threads: defineTable({ /* ... */ }),
  messages: defineTable({ /* ... */ }),

  // FinForge-specific tables
  watchlists: defineTable({
    userId: v.string(),
    symbol: v.string(),
    name: v.string(),
    addedAt: v.number(),
  }).index('by_userId', ['userId']),

  analyses: defineTable({
    symbol: v.string(),
    type: v.union(v.literal('fundamental'), v.literal('technical')),
    summary: v.string(),
    confidence: v.number(),
    createdAt: v.number(),
  }).index('by_symbol', ['symbol']),
});
```

**Key concept**: Convex provides a real-time, reactive database. By extending the base schema, you get persistent state for your agent's domain-specific data.

## Step 5: Run the Demo

Create `src/main.ts` to tie everything together:

```typescript
import { openai } from '@ai-sdk/openai';
import { createFinForgeAgent } from './agent.js';

async function main() {
  const { agent, mcpServer } = createFinForgeAgent(openai('gpt-4o-mini'));

  // Use tools directly
  const quote = await mcpServer.callTool('get_stock_quote', { symbol: 'AAPL' });
  console.log('Quote:', quote);

  // Use the agent for natural language analysis
  const response = await agent.generate('Analyze AAPL for me.');
  console.log('Agent:', response.text);
}

main();
```

Run it:

```bash
npx tsx src/main.ts
```

## What You've Learned

In this tutorial, you've used all the core primitives of the AgentForge framework:

| Primitive | What It Does | Where It's Used |
|---|---|---|
| `Agent` | Wraps an LLM with instructions and identity | `src/agent.ts` |
| `MCPServer` | Registers and manages type-safe tools | `src/tools.ts` |
| `SandboxManager` | Runs untrusted code in E2B sandboxes | Available for tool execution |
| Convex Schema | Persists state in a real-time database | `convex/schema.ts` |
| CLI | Scaffolds and runs projects | `agentforge create` |

## Next Steps

- **Add more tools**: Integrate real financial APIs (Alpha Vantage, Polygon.io)
- **Add E2B sandboxing**: Run user-provided analysis scripts safely
- **Build a web UI**: Use Convex's React hooks for a real-time dashboard
- **Deploy**: Use `npx convex deploy` for the backend

See the full FinForge source code in `/examples/finforge`.
