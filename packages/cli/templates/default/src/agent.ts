import { Agent } from '@agentforge-ai/core';
import { AgentForgeWorkspace } from '@agentforge-ai/core/workspace';

/**
 * AgentForge — Your First Agent
 *
 * This starter agent demonstrates how to configure an AI agent with
 * AgentForge's multi-provider support and Mastra Workspace integration.
 *
 * Workspace gives your agent:
 *   - Filesystem: Read, write, list, and delete files
 *   - Sandbox: Execute shell commands
 *   - Skills: Discover and activate reusable instructions
 *   - Search: BM25 keyword search over indexed content
 *
 * Set your provider and API key in the .env file:
 *   OPENAI_API_KEY=sk-...
 *   OPENROUTER_API_KEY=sk-or-...
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

// ─── Workspace Setup ──────────────────────────────────────────────────
// The workspace provides persistent file storage, command execution,
// skill discovery, and content search for your agents.
const workspace = AgentForgeWorkspace.local({
  basePath: './workspace',
  skills: ['/skills'],
  search: true,
  autoIndexPaths: ['/skills'],
  sandbox: true,
});

// Initialize workspace (triggers auto-indexing)
await workspace.init();

// ─── Main Agent ────────────────────────────────────────────────────────
const myAgent = new Agent({
  id: 'my-first-agent',
  name: 'My First Agent',
  instructions: `You are a helpful AI assistant built with AgentForge.
You can help users with a variety of tasks.
Be concise, accurate, and friendly.

You have access to a workspace with file management, command execution,
and skill discovery capabilities. Use them when appropriate.

When you don't know something, say so honestly.
When asked about your capabilities, mention that you're powered by AgentForge.`,

  // Choose your model — supports multiple providers:
  //   OpenAI:      "openai/gpt-4o-mini", "openai:gpt-4o"
  //   OpenRouter:  "openrouter:anthropic/claude-3.5-sonnet", "openrouter:google/gemini-pro"
  //   Anthropic:   "anthropic:claude-3-5-sonnet-20241022"
  //   Google:      "google:gemini-2.0-flash"
  //   xAI:         "xai:grok-2"
  model: 'openai/gpt-4o-mini',
});

export { workspace };
export default myAgent;

// ─── Example: Cloud Workspace (Cloudflare R2) ─────────────────────────
// For production deployment on Cloudflare, use a cloud workspace:
//
// const cloudWorkspace = AgentForgeWorkspace.cloud({
//   bucket: 'my-agent-files',
//   region: 'auto',
//   endpoint: process.env.R2_ENDPOINT,
//   accessKeyId: process.env.R2_ACCESS_KEY_ID,
//   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
//   skills: ['/skills'],
// });

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
//
// ─── Example: Searching Workspace Content ──────────────────────────────
// const results = await workspace.search('code review');
// console.log(results);
