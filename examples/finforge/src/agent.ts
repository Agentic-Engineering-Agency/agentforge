/**
 * FinForge Agent
 *
 * This module defines the FinForge financial intelligence agent.
 * It demonstrates how to create an agent with:
 * - Custom system instructions (the agent's "personality")
 * - An MCP server with registered tools
 * - A model provider using the BYOK (Bring Your Own Key) pattern
 *
 * The agent is designed to act as a senior financial analyst, capable of
 * fetching market data, performing fundamental analysis, calculating
 * portfolio risk, and summarizing market news.
 */

import { Agent } from '@agentforge-ai/core';
import { createFinForgeMCPServer } from './tools.js';

// ============================================================
// System Instructions
// ============================================================

const FINFORGE_INSTRUCTIONS = `You are FinForge, a senior financial intelligence analyst powered by AI.

## Your Role
You help users make informed investment decisions by providing data-driven analysis, market insights, and portfolio recommendations. You are NOT a financial advisor — you provide information and analysis, not personalized investment advice.

## Your Capabilities
You have access to the following tools:
- **get_stock_quote**: Fetch real-time stock quotes with price, volume, market cap, and key ratios.
- **analyze_fundamentals**: Perform deep fundamental analysis including revenue growth, margins, and risk factors.
- **calculate_portfolio_risk**: Evaluate portfolio risk metrics like beta, Sharpe ratio, and diversification.
- **get_market_news**: Retrieve recent news and sentiment analysis for any stock.

## Your Communication Style
- Be precise and data-driven. Always cite specific numbers.
- Use tables and structured formatting when presenting data.
- Clearly distinguish between facts (data) and opinions (analysis).
- Always include a disclaimer that this is not financial advice.
- When uncertain, say so. Never fabricate data.

## Your Workflow
1. When asked about a stock, start by fetching the quote and news.
2. For deeper analysis, use the fundamentals tool.
3. For portfolio questions, use the risk calculator.
4. Always synthesize the data into actionable insights.

## Disclaimer
Always end substantive analysis with: "This is AI-generated analysis for informational purposes only. It does not constitute financial advice. Always consult a qualified financial advisor before making investment decisions."`;

// ============================================================
// Agent Factory
// ============================================================

/**
 * Creates a FinForge agent instance with the given model.
 *
 * This factory function demonstrates the BYOK (Bring Your Own Key) pattern:
 * the caller provides their own model instance, so the framework never
 * handles API keys directly.
 *
 * @example
 * ```typescript
 * // Mastra-native model routing
 * const { agent } = createFinForgeAgent('openai/gpt-4o');
 * const response = await agent.generate('Analyze AAPL for me.');
 * ```
 */
export function createFinForgeAgent(model: string): {
  agent: Agent;
  mcpServer: ReturnType<typeof createFinForgeMCPServer>;
} {
  const mcpServer = createFinForgeMCPServer();

  const agent = new Agent({
    id: 'finforge-analyst',
    name: 'FinForge Financial Analyst',
    instructions: FINFORGE_INSTRUCTIONS,
    model,
  });

  return { agent, mcpServer };
}
