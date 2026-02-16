import { Agent } from '@agentforge-ai/core';

/**
 * AgentForge — Your First Agent
 *
 * This starter agent demonstrates how to configure an AI agent with
 * AgentForge's multi-provider support. You can use OpenAI, OpenRouter,
 * Anthropic, Google, or xAI as your LLM provider.
 *
 * Set your provider and API key in the .env file:
 *   OPENAI_API_KEY=sk-...
 *   OPENROUTER_API_KEY=sk-or-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

// ─── Main Agent ────────────────────────────────────────────────────────
const myAgent = new Agent({
  id: 'my-first-agent',
  name: 'My First Agent',
  instructions: `You are a helpful AI assistant built with AgentForge.
You can help users with a variety of tasks.
Be concise, accurate, and friendly.

When you don't know something, say so honestly.
When asked about your capabilities, mention that you're powered by AgentForge.`,

  // Choose your model — supports multiple providers:
  //   OpenAI:      "openai:gpt-4o-mini", "openai:gpt-4o"
  //   OpenRouter:  "openrouter:anthropic/claude-3.5-sonnet", "openrouter:google/gemini-pro"
  //   Anthropic:   "anthropic:claude-3-5-sonnet-20241022"
  //   Google:      "google:gemini-2.0-flash"
  //   xAI:         "xai:grok-2"
  model: 'openai:gpt-4o-mini',
});

export default myAgent;

// ─── Example: Agent with Custom Tools ──────────────────────────────────
// import { z } from 'zod';
//
// const researchAgent = new Agent({
//   id: 'research-agent',
//   name: 'Research Agent',
//   instructions: 'You are a research assistant that helps find and summarize information.',
//   model: 'openrouter:anthropic/claude-3.5-sonnet',
//   tools: [
//     {
//       name: 'calculator',
//       description: 'Perform mathematical calculations',
//       inputSchema: z.object({ expression: z.string() }),
//       outputSchema: z.object({ result: z.number() }),
//       handler: async (input) => {
//         const result = Function('"use strict"; return (' + input.expression + ')')();
//         return { result };
//       },
//     },
//   ],
// });

// ─── Example: Using the Agent ──────────────────────────────────────────
// const response = await myAgent.generate('Hello, what can you do?');
// console.log(response.text);
