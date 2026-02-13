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
import type { LanguageModelV1 } from 'ai';

// ============================================================
// Demo Runner
// ============================================================

/**
 * Runs the FinForge demo with a series of example queries.
 * This function can work with any AI SDK-compatible model.
 */
async function runDemo(model: LanguageModelV1) {
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
  // Dynamic import to handle the case where @ai-sdk/openai is not installed
  try {
    const { openai } = await import('@ai-sdk/openai');
    await runDemo(openai('gpt-4o-mini'));
  } catch {
    console.log('Note: @ai-sdk/openai not available. Running tools-only demo.');
    console.log('Install it with: npm install @ai-sdk/openai');
    console.log();

    // Create a minimal mock model for demonstration
    const mockModel = {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'mock-model',
      defaultObjectGenerationMode: 'json' as const,
      doGenerate: async () => ({
        text: 'This is a mock response. Install @ai-sdk/openai and set OPENAI_API_KEY for real LLM responses.',
        finishReason: 'stop' as const,
        usage: { promptTokens: 0, completionTokens: 0 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async () => ({
        stream: new ReadableStream(),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    } as unknown as LanguageModelV1;

    await runDemo(mockModel);
  }
}

main().catch(console.error);
