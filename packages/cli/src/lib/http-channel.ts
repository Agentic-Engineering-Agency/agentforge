/**
 * HTTP Channel for AgentForge Daemon
 *
 * Implements an HTTP server with OpenAI-compatible /v1/chat/completions endpoint.
 * Uses Server-Sent Events (SSE) for streaming responses.
 */

import { createServer } from 'node:http';
import { Agent } from '@agentforge-ai/core';

/** Maximum allowed request body size (1 MB) to prevent DoS. */
const MAX_BODY_BYTES = 1_048_576;

export async function startHttpChannel(
  port: number,
  agents: any[],
  convexUrl: string,
  dev = false
): Promise<void> {
  // Build a map of real Agent instances from Convex agent definitions
  const agentMap = new Map<string, Agent>();
  for (const convexAgent of agents) {
    if (!convexAgent.provider || !convexAgent.model) {
      console.warn(`[HttpChannel] Skipping agent "${convexAgent.id}": missing provider or model`);
      continue;
    }
    const modelString = `${convexAgent.provider}/${convexAgent.model}`;
    const agent = new Agent({
      id: convexAgent.id,
      name: convexAgent.name,
      instructions: convexAgent.instructions || 'You are a helpful assistant.',
      model: modelString,
    });
    agentMap.set(convexAgent.id, agent);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        agents: agents.length,
        agentIds: Array.from(agentMap.keys()),
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // OpenAI-compatible chat completions endpoint
    if (url.pathname === '/v1/chat/completions') {
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end('Method not allowed');
        return;
      }

      let body = '';
      let bodyBytes = 0;
      let tooLarge = false;

      req.on('data', (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          tooLarge = true;
          req.removeAllListeners('data');
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request body too large' }));
          req.destroy();
          return;
        }
        body += chunk.toString();
      });

      req.on('end', async () => {
        if (tooLarge) return;
        try {
          const requestData = JSON.parse(body) as ChatCompletionRequest;

          // Get agent by ID or fall back to the first loaded agent
          const agentId = requestData.model?.split(':')[1] || agents[0]?.id;
          const resolvedAgent = (agentId ? agentMap.get(agentId) : undefined) ?? agentMap.values().next().value as Agent | undefined;

          if (!resolvedAgent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Agent not found' }));
            return;
          }

          // Extract the last user message as the prompt
          let prompt = '';
          for (let i = requestData.messages.length - 1; i >= 0; i--) {
            if (requestData.messages[i].role === 'user') {
              prompt = requestData.messages[i].content;
              break;
            }
          }

          if (!prompt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No user message found in request' }));
            return;
          }

          // Set SSE headers
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          // Stream response using Agent.stream() which yields StreamChunk { content: string }
          try {
            for await (const chunk of resolvedAgent.stream(prompt)) {
              const data = JSON.stringify({
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: agentId,
                choices: [{
                  index: 0,
                  delta: { content: chunk.content },
                  finish_reason: null,
                }],
              });
              res.write(`data: ${data}\n\n`);
            }

            // Send final chunk
            const finalData = JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: agentId,
              choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop',
              }],
            });
            res.write(`data: ${finalData}\n\n`);
            res.write('data: [DONE]\n\n');
          } catch (streamErr) {
            res.write(`data: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
          }

          res.end();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: {
              message: err instanceof Error ? err.message : String(err),
              type: 'internal_error',
            },
          }));
        }
      });
      return;
    }

    // 404 for other routes
    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(port, () => {
    if (dev) {
      console.log(`[HttpChannel] Listening on http://localhost:${port}`);
    }
  });

  // Handle graceful shutdown
  return new Promise((resolve) => {
    server.on('close', resolve);
  });
}

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model?: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
}
