/**
 * FinForge Demo — Main Entry Point
 *
 * This script demonstrates how to use the AgentForge framework to build
 * a financial intelligence agent. It runs a series of example queries
 * to showcase the agent's capabilities.
 *
 * Usage:
 *   1. Copy .env.example to .env and add your OPENAI_API_KEY
 *   2. Run: tsx src/main.ts
 *
 * For a real application, you would integrate this agent into a web app,
 * Slack bot, or any other interface using the Convex backend for persistence.
 */

import { createFinForgeAgent } from './agent.js';
// Mastra-native model routing — no Vercel AI SDK needed

// ============================================================
// Demo Runner
// ============================================================

/**
 * Runs the FinForge demo with a series of example queries.
 * This function can work with any AI SDK-compatible model.
 */
async function runDemo(model: string) {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           🏦 FinForge — Financial Intelligence          ║');
  console.log('║           Built with AgentForge Framework               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  const { agent, mcpServer } = createFinForgeAgent(model);

  // --- Demo 1: Stock Quote ---
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Demo 1: Fetching Stock Quotes via MCP Tools');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const tools = mcpServer.listTools();
  console.log(`Registered tools: ${tools.map((t) => t.name).join(', ')}`);
  console.log();

  // Call tools directly through MCP server
  const appleQuote = await mcpServer.callTool('get_stock_quote', { symbol: 'AAPL' });
  console.log('AAPL Quote:', JSON.stringify(appleQuote, null, 2));
  console.log();

  const nvidiaQuote = await mcpServer.callTool('get_stock_quote', { symbol: 'NVDA' });
  console.log('NVDA Quote:', JSON.stringify(nvidiaQuote, null, 2));
  console.log();

  // --- Demo 2: Fundamental Analysis ---
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Demo 2: Fundamental Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const analysis = await mcpServer.callTool('analyze_fundamentals', { symbol: 'NVDA' });
  console.log('NVDA Fundamental Analysis:', JSON.stringify(analysis, null, 2));
  console.log();

  // --- Demo 3: Portfolio Risk ---
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚖️  Demo 3: Portfolio Risk Assessment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const portfolio = [
    { symbol: 'AAPL', weight: 30 },
    { symbol: 'NVDA', weight: 25 },
    { symbol: 'MSFT', weight: 20 },
    { symbol: 'GOOGL', weight: 15 },
    { symbol: 'TSLA', weight: 10 },
  ];

  console.log('Portfolio:', portfolio.map((h) => `${h.symbol} (${h.weight}%)`).join(', '));
  const risk = await mcpServer.callTool('calculate_portfolio_risk', { holdings: portfolio });
  console.log('Risk Metrics:', JSON.stringify(risk, null, 2));
  console.log();

  // --- Demo 4: Market News ---
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📰 Demo 4: Market News & Sentiment');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  const news = await mcpServer.callTool('get_market_news', { symbol: 'AAPL' });
  console.log('AAPL News:', JSON.stringify(news, null, 2));
  console.log();

  // --- Demo 5: Agent Generation (requires OPENAI_API_KEY) ---
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Demo 5: Agent-Powered Analysis (LLM)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log();

  try {
    const response = await agent.generate(
      'Give me a brief overview of the current tech market. Focus on AAPL and NVDA.'
    );
    console.log('Agent Response:');
    console.log(response.text);
  } catch (error) {
    console.log(
      '⚠️  LLM generation requires a valid OPENAI_API_KEY in your .env file.'
    );
    console.log(
      '   The MCP tools above work without an API key (they use mock data).'
    );
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ FinForge demo complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ============================================================
// Entry Point
// ============================================================

async function main() {
  // Use Mastra-native model routing — just pass a model string
  const modelName = process.env.OPENAI_API_KEY
    ? 'openai/gpt-4o-mini'
    : 'mock/demo';

  if (modelName === 'mock/demo') {
    console.log('Note: Set OPENAI_API_KEY for real LLM responses.');
    console.log('Running tools-only demo with mock model.');
    console.log();
  }

  await runDemo(modelName);
}

main().catch(console.error);
