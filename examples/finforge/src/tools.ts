/**
 * FinForge Tools
 *
 * This module defines the tools that the FinForge agent can use.
 * Each tool is registered on the MCP server with a Zod schema for
 * type-safe input validation.
 *
 * In a production environment, these tools would call real financial APIs
 * (e.g., Alpha Vantage, Polygon.io, Yahoo Finance). For this demo,
 * they return realistic mock data to demonstrate the framework's capabilities
 * without requiring paid API keys.
 */

import { z } from 'zod';
import { MCPServer } from '@agentforge-ai/core';

// ============================================================
// Tool Implementation Functions
// ============================================================

/**
 * Fetches a stock quote for a given ticker symbol.
 */
export function getStockQuote(symbol: string) {
  const mockData: Record<string, object> = {
    AAPL: {
      symbol: 'AAPL', price: 237.49, change: 3.21, changePct: 1.37,
      volume: 54_320_100, marketCap: '$3.62T', peRatio: 38.2,
      high52w: 260.1, low52w: 164.08,
    },
    NVDA: {
      symbol: 'NVDA', price: 131.28, change: -2.45, changePct: -1.83,
      volume: 312_450_000, marketCap: '$3.22T', peRatio: 52.1,
      high52w: 153.13, low52w: 60.7,
    },
    MSFT: {
      symbol: 'MSFT', price: 412.87, change: 1.56, changePct: 0.38,
      volume: 22_100_000, marketCap: '$3.07T', peRatio: 35.4,
      high52w: 468.35, low52w: 366.5,
    },
    TSLA: {
      symbol: 'TSLA', price: 352.56, change: 12.34, changePct: 3.63,
      volume: 98_760_000, marketCap: '$1.13T', peRatio: 112.8,
      high52w: 488.54, low52w: 138.8,
    },
    GOOGL: {
      symbol: 'GOOGL', price: 185.43, change: -0.87, changePct: -0.47,
      volume: 28_900_000, marketCap: '$2.28T', peRatio: 23.1,
      high52w: 207.05, low52w: 150.22,
    },
  };

  const upper = symbol.toUpperCase();
  if (mockData[upper]) return mockData[upper];

  const price = Math.round((50 + Math.random() * 300) * 100) / 100;
  const change = Math.round((Math.random() * 10 - 5) * 100) / 100;
  return {
    symbol: upper, price, change,
    changePct: Math.round((change / price) * 10000) / 100,
    volume: Math.floor(Math.random() * 50_000_000),
    marketCap: `$${Math.floor(Math.random() * 500)}B`,
    peRatio: Math.round((10 + Math.random() * 50) * 10) / 10,
    high52w: Math.round(price * 1.3 * 100) / 100,
    low52w: Math.round(price * 0.6 * 100) / 100,
  };
}

/**
 * Performs a fundamental analysis of a company.
 */
export function analyzeFundamentals(symbol: string) {
  const analyses: Record<string, object> = {
    AAPL: {
      symbol: 'AAPL', rating: 'Strong Buy',
      summary: 'Apple continues to demonstrate exceptional financial health with strong services growth offsetting hardware cyclicality. The AI integration strategy with Apple Intelligence positions the company for the next computing paradigm.',
      metrics: { revenueGrowth: '+6.1% YoY', profitMargin: '26.3%', debtToEquity: 1.87, freeCashFlow: '$110.5B', roe: '157.4%' },
      risks: ['Regulatory pressure in EU and China', 'Smartphone market saturation', 'Supply chain concentration in Asia'],
      catalysts: ['Apple Intelligence ecosystem expansion', 'Services revenue acceleration', 'Vision Pro enterprise adoption', 'India manufacturing diversification'],
    },
    NVDA: {
      symbol: 'NVDA', rating: 'Buy',
      summary: 'NVIDIA remains the undisputed leader in AI compute infrastructure. Data center revenue continues to exceed expectations, though valuation multiples leave limited margin of safety.',
      metrics: { revenueGrowth: '+122% YoY', profitMargin: '55.8%', debtToEquity: 0.41, freeCashFlow: '$33.7B', roe: '115.2%' },
      risks: ['Customer concentration (hyperscalers)', 'Custom silicon competition (Google TPU, Amazon Trainium)', 'Export restrictions to China', 'Elevated valuation multiples'],
      catalysts: ['Blackwell architecture ramp', 'Sovereign AI infrastructure buildout', 'Automotive and robotics expansion', 'Software and licensing revenue growth'],
    },
  };

  const upper = symbol.toUpperCase();
  if (analyses[upper]) return analyses[upper];

  return {
    symbol: upper, rating: 'Hold',
    summary: `${upper} shows mixed fundamentals. Further analysis is recommended before making investment decisions.`,
    metrics: { revenueGrowth: '+3.2% YoY', profitMargin: '12.1%', debtToEquity: 0.95, freeCashFlow: '$2.1B', roe: '18.5%' },
    risks: ['Market competition', 'Macroeconomic headwinds'],
    catalysts: ['Product pipeline', 'Cost optimization initiatives'],
  };
}

/**
 * Calculates portfolio risk metrics.
 */
export function calculatePortfolioRisk(holdings: Array<{ symbol: string; weight: number }>) {
  const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);
  const numHoldings = holdings.length;
  const beta = 0.8 + Math.random() * 0.6;
  const sharpe = 0.5 + Math.random() * 1.5;
  const diversification = numHoldings >= 10 ? 'High' : numHoldings >= 5 ? 'Medium' : 'Low';

  return {
    portfolioBeta: Math.round(beta * 100) / 100,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    maxDrawdown: `-${Math.round(10 + Math.random() * 20)}%`,
    volatility: `${Math.round(12 + Math.random() * 15)}%`,
    varDaily95: `-${Math.round((1 + Math.random() * 3) * 100) / 100}%`,
    diversificationScore: diversification,
    recommendation: numHoldings < 5
      ? 'Consider diversifying across more sectors to reduce concentration risk.'
      : totalWeight > 100
        ? 'Portfolio weights exceed 100%. Please rebalance.'
        : 'Portfolio is reasonably diversified. Monitor sector exposure.',
  };
}

/**
 * Fetches recent market news for a symbol.
 */
export function getMarketNews(symbol: string) {
  const newsMap: Record<string, object[]> = {
    AAPL: [
      { headline: 'Apple Intelligence Drives Record iPhone 16 Pro Sales in Q1', source: 'Bloomberg', sentiment: 'positive', publishedAt: '2026-02-12T14:30:00Z', summary: 'Apple reported stronger-than-expected iPhone 16 Pro sales, driven by consumer demand for on-device AI features.' },
      { headline: 'EU Fines Apple $2B Over App Store Practices', source: 'Reuters', sentiment: 'negative', publishedAt: '2026-02-11T09:15:00Z', summary: 'The European Commission imposed a $2 billion fine on Apple for anti-competitive behavior in its App Store.' },
      { headline: 'Apple Expands Vision Pro to 12 New Countries', source: 'TechCrunch', sentiment: 'positive', publishedAt: '2026-02-10T16:00:00Z', summary: 'Apple announced the availability of Vision Pro in 12 additional countries, signaling confidence in spatial computing.' },
    ],
    NVDA: [
      { headline: 'NVIDIA Blackwell GPUs Sell Out Through Q3 2026', source: 'The Verge', sentiment: 'positive', publishedAt: '2026-02-12T11:00:00Z', summary: 'NVIDIA CEO Jensen Huang confirmed that Blackwell GPU supply is fully allocated through the third quarter of 2026.' },
      { headline: 'Amazon Announces Custom AI Chip to Reduce NVIDIA Dependence', source: 'CNBC', sentiment: 'negative', publishedAt: '2026-02-11T13:45:00Z', summary: 'Amazon Web Services unveiled its next-generation Trainium3 chip, aiming to reduce reliance on NVIDIA for AI training workloads.' },
    ],
  };

  const upper = symbol.toUpperCase();
  if (newsMap[upper]) return newsMap[upper];

  return [{ headline: `${upper} Reports Quarterly Earnings In Line With Expectations`, source: 'MarketWatch', sentiment: 'neutral', publishedAt: '2026-02-12T08:00:00Z', summary: `${upper} reported quarterly earnings that met analyst expectations.` }];
}

// ============================================================
// MCP Server Registration
// ============================================================

/**
 * Creates and configures the FinForge MCP server with all financial tools.
 */
export function createFinForgeMCPServer(): MCPServer {
  const server = new MCPServer({
    name: 'finforge-tools',
    version: '0.1.0',
  });

  // --- Tool: Get Stock Quote ---
  server.registerTool({
    name: 'get_stock_quote',
    description: 'Fetch the current stock quote for a given ticker symbol. Returns price, change, volume, market cap, P/E ratio, and 52-week range.',
    inputSchema: z.object({
      symbol: z.string().describe('The stock ticker symbol (e.g., AAPL, NVDA, MSFT)'),
    }),
    outputSchema: z.any(),
    handler: async ({ symbol }) => getStockQuote(symbol),
  });

  // --- Tool: Analyze Fundamentals ---
  server.registerTool({
    name: 'analyze_fundamentals',
    description: 'Perform a fundamental analysis of a company. Returns a rating, summary, key financial metrics, risks, and catalysts.',
    inputSchema: z.object({
      symbol: z.string().describe('The stock ticker symbol to analyze'),
    }),
    outputSchema: z.any(),
    handler: async ({ symbol }) => analyzeFundamentals(symbol),
  });

  // --- Tool: Calculate Portfolio Risk ---
  server.registerTool({
    name: 'calculate_portfolio_risk',
    description: 'Calculate risk metrics for a portfolio of holdings. Returns beta, Sharpe ratio, max drawdown, volatility, VaR, and diversification score.',
    inputSchema: z.object({
      holdings: z.array(
        z.object({
          symbol: z.string().describe('Stock ticker symbol'),
          weight: z.number().describe('Portfolio weight as a percentage (e.g., 25 for 25%)'),
        })
      ).describe('Array of portfolio holdings with their weights'),
    }),
    outputSchema: z.any(),
    handler: async ({ holdings }) => calculatePortfolioRisk(holdings),
  });

  // --- Tool: Get Market News ---
  server.registerTool({
    name: 'get_market_news',
    description: 'Fetch recent market news and sentiment for a given stock symbol.',
    inputSchema: z.object({
      symbol: z.string().describe('The stock ticker symbol to get news for'),
    }),
    outputSchema: z.any(),
    handler: async ({ symbol }) => getMarketNews(symbol),
  });

  return server;
}
