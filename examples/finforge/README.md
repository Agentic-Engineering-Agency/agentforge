# FinForge — Financial Intelligence Agent

A complete example of a financial intelligence agent built with the **AgentForge** framework. This demo showcases how to use all the core primitives — Agents, MCP Tools, E2B Sandboxes, and Convex state — to build a real-world AI application.

## What It Does

FinForge is a senior financial analyst agent that can:

- **Fetch stock quotes** with real-time price, volume, and key ratios
- **Perform fundamental analysis** including revenue growth, margins, risks, and catalysts
- **Calculate portfolio risk** with beta, Sharpe ratio, VaR, and diversification scoring
- **Summarize market news** with sentiment analysis
- **Generate AI-powered insights** using any LLM provider (OpenAI, Anthropic, Google, etc.)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    User / Client                      │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              FinForge Agent (Mastra)                  │
│  • System instructions (financial analyst persona)    │
│  • BYOK model (any AI SDK provider)                  │
│  • generate() / stream() methods                     │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              MCP Server (Tool Registry)               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Stock Quote  │ │ Fundamentals │ │ Portfolio    │ │
│  │ Tool         │ │ Analysis     │ │ Risk Calc    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│  ┌──────────────┐                                    │
│  │ Market News  │                                    │
│  │ & Sentiment  │                                    │
│  └──────────────┘                                    │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              Convex Backend (State)                   │
│  • agents, threads, messages (core)                  │
│  • watchlists, analyses, alerts (finforge-specific)  │
└──────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Navigate to the demo directory
cd examples/finforge

# 2. Install dependencies
pnpm install

# 3. Copy the environment file
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 4. Run the demo
npx tsx src/main.ts
```

The demo will run 5 scenarios:
1. Fetching stock quotes via MCP tools
2. Fundamental analysis of NVDA
3. Portfolio risk assessment for a 5-stock portfolio
4. Market news and sentiment for AAPL
5. Agent-powered analysis using the LLM

## Project Structure

```
finforge/
├── convex/
│   └── schema.ts          # Extended Convex schema with financial tables
├── src/
│   ├── agent.ts           # Agent definition with system instructions
│   ├── tools.ts           # MCP tool definitions (quote, analysis, risk, news)
│   └── main.ts            # Demo entry point
├── .env.example           # Environment variable template
├── package.json
├── tsconfig.json
└── README.md
```

## Key Concepts Demonstrated

### 1. BYOK (Bring Your Own Key) Pattern

The agent factory accepts any `LanguageModelV1` instance. You provide the model, the framework never touches your API keys:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Use OpenAI
const { agent } = createFinForgeAgent(openai('gpt-4o'));

// Or swap to Anthropic — zero code changes
const { agent } = createFinForgeAgent(anthropic('claude-3-5-sonnet'));
```

### 2. MCP Tool Registration

Tools are registered on the MCP server with Zod schemas for type-safe input validation:

```typescript
server.registerTool(
  'get_stock_quote',
  'Fetch the current stock quote for a given ticker symbol.',
  z.object({
    symbol: z.string().describe('The stock ticker symbol'),
  }),
  async ({ symbol }) => {
    return getStockQuote(symbol);
  }
);
```

### 3. Extended Convex Schema

The demo extends the base AgentForge schema with financial-specific tables:

```typescript
watchlists: defineTable({
  userId: v.string(),
  symbol: v.string(),
  name: v.string(),
  sector: v.optional(v.string()),
  addedAt: v.number(),
}),
```

## License

Apache 2.0 — See the root [LICENSE](../../LICENSE) file.
