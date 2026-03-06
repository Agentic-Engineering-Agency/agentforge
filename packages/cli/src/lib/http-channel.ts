/**
 * HTTP Channel for AgentForge Daemon
 *
 * Implements an HTTP server with OpenAI-compatible /v1/chat/completions endpoint.
 * Uses Server-Sent Events (SSE) for streaming responses.
 */

import { createServer } from 'node:http';

/** Maximum allowed request body size (1 MB) to prevent memory exhaustion. */
const MAX_BODY_BYTES = 1 * 1024 * 1024;

export async function startHttpChannel(
  port: number,
  agents: any[],
  _convexUrl: string,
  dev = false
): Promise<() => Promise<void>> {
  const agentMap = new Map<string, any>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
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
      let bodyLimitExceeded = false;

      req.on('error', (err) => {
        if (!res.headersSent && !res.writableEnded) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message, type: 'bad_request' } }));
        }
      });

      req.on('data', (chunk: Buffer) => {
        if (bodyLimitExceeded) return;
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          bodyLimitExceeded = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Request body too large', type: 'bad_request' } }));
          req.destroy();
          return;
        }
        body += chunk.toString();
      });

      req.on('end', async () => {
        if (res.writableEnded) return;
        try {
          const requestData = JSON.parse(body) as ChatCompletionRequest;

          // Get agent by ID or use first agent
          const agentId = requestData.model?.split(':')[1] || agents[0]?.id;
          const agent = agentMap.get(agentId) || agents[0];

          if (!agent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Agent not found' }));
            return;
          }

          const messages = requestData.messages.map(m => ({
            role: m.role,
            content: m.content,
          }));

          // Set SSE headers
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          // Stream response
          try {
            const stream = await agent.stream(messages);

            for await (const chunk of stream.fullStream) {
              if (chunk.type === 'text-delta') {
                const data = JSON.stringify({
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: agentId,
                  choices: [{
                    index: 0,
                    delta: { content: chunk.textDelta },
                    finish_reason: null,
                  }],
                });
                res.write(`data: ${data}\n\n`);
              }
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

  // Wait until the server is listening before returning the close function
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      if (dev) {
        console.log(`[HttpChannel] Listening on http://localhost:${port}`);
      }
      resolve();
    });
  });

  // Return a close function for graceful shutdown
  return () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
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
