import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import * as crypto from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type { ChannelAdapter, AgentDefinition } from '../daemon/types.js';
import { formatSSEChunk } from './shared.js';

interface DaemonAccess {
  listAgents(): AgentDefinition[];
  getAgent(id: string): Agent | undefined;
}

export interface HttpChannelConfig {
  port?: number;
  apiKey?: string;
}

export class HttpChannel implements ChannelAdapter {
  name = 'http';
  private app: Hono;
  private server?: unknown;
  private port: number;
  private apiKey?: string;
  private daemon: DaemonAccess | null = null;

  constructor(config: HttpChannelConfig = {}) {
    this.port = config.port ?? 3001;
    this.apiKey = config.apiKey ?? process.env.AGENTFORGE_API_KEY;
    this.app = new Hono();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Auth middleware
    this.app.use('*', async (c, next) => {
      const apiKey = this.apiKey;
      if (!apiKey) return next();

      const auth = c.req.header('Authorization');
      if (!auth) {
        return c.json({ error: 'Missing Authorization header' }, 401);
      }
      const [type, token] = auth.split(' ');
      if (type !== 'Bearer' || !token) {
        return c.json({ error: 'Invalid API key' }, 401);
      }
      // Hash both values to equal-length digests before comparing so that
      // crypto.timingSafeEqual runs unconditionally (no length-leaking short-circuit).
      // Previously, the length check short-circuited before timingSafeEqual and leaked
      // expected key length via timing differences.
      const tokenHash = crypto.createHash('sha256').update(token).digest();
      const keyHash = crypto.createHash('sha256').update(apiKey).digest();
      const valid = crypto.timingSafeEqual(tokenHash, keyHash);
      if (!valid) {
        return c.json({ error: 'Invalid API key' }, 401);
      }
      return next();
    });

    // Health check
    this.app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      });
    });

    // List agents
    this.app.get('/v1/agents', (c) => {
      const daemon = this.daemon;
      if (!daemon) return c.json({ error: 'Daemon not started' }, 503);
      const agents = daemon.listAgents();
      return c.json({
        object: 'list',
        data: agents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          model: a.model,
        })),
      });
    });

    // Create thread (stub - threads are created implicitly)
    this.app.post('/v1/threads', (c) => {
      return c.json({
        id: `thread_${Date.now()}`,
        object: 'thread',
        created_at: Math.floor(Date.now() / 1000),
      });
    });

    // List messages in thread (stub - not implemented yet)
    this.app.get('/v1/threads/:id/messages', (c) => {
      return c.json({
        object: 'list',
        data: [],
      });
    });

    // Chat completions - OpenAI compatible
    this.app.post('/v1/chat/completions', async (c) => {
      const daemon = this.daemon;
      if (!daemon) return c.json({ error: 'Daemon not started' }, 503);

      const body = await c.req.json();
      const {
        model,
        messages,
        stream = true,
      } = body as {
        model: string;
        messages: Array<{ role: string; content: string }>;
        stream?: boolean;
      };

      if (!model) {
        return c.json({ error: { message: "'model' field is required", type: 'invalid_request_error' } }, 400);
      }
      if (!messages || messages.length === 0) {
        return c.json({ error: { message: "'messages' must not be empty", type: 'invalid_request_error' } }, 400);
      }

      // Get agent by model ID (agent ID)
      const agent = daemon.getAgent(model);
      if (!agent) {
        return c.json({ error: { message: `Agent '${model}' not found`, type: 'invalid_request_error' } }, 404);
      }

      // Convert OpenAI format to Mastra format
      const lastMessage = messages[messages.length - 1];
      const userMessage = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

      if (!stream) {
        // Non-streaming response
        try {
          const result = await agent.generate([{ role: 'user', content: userMessage }]);
          return c.json({
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: result.text },
                finish_reason: 'stop',
              },
            ],
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return c.json({ error: { message: errorMessage, type: 'api_error' } }, 500);
        }
      }

      // Streaming response with SSE
      return streamText(c, async (stream) => {
        try {
          const mastraStream = await agent.stream([{ role: 'user', content: userMessage }]);
          await stream.write(formatSSEChunk('', null));

          for await (const chunk of mastraStream.fullStream) {
            if (chunk.type === 'text-delta') {
              await stream.write(formatSSEChunk(chunk.payload.text, null));
            }
          }
          await stream.write(formatSSEChunk('', 'stop'));
          await stream.write('data: [DONE]\n\n');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('[HttpChannel] Stream error:', errorMessage);
          await stream.write(formatSSEChunk('', 'stop'));
          await stream.write('data: [DONE]\n\n');
        }
      });
    });
  }

  async start(_agents: Map<string, Agent>, daemon: DaemonAccess): Promise<void> {
    this.daemon = daemon;

    // Try Bun first, then fallback to Node.js
    const BunServe = typeof (globalThis as { Bun?: { serve?: unknown } }).Bun?.serve === 'function'
      ? (globalThis as { Bun?: { serve?: (...args: unknown[]) => unknown } }).Bun!.serve!
      : null;

    if (BunServe) {
      this.server = BunServe({
        fetch: this.app.fetch,
        port: this.port,
      });
      console.log(`[HttpChannel] Server listening on http://localhost:${this.port}`);
    } else {
      // Fallback to Node.js server
      const { serve } = await import('@hono/node-server');
      this.server = await serve({
        fetch: this.app.fetch,
        port: this.port,
      });
      console.log(`[HttpChannel] Server listening on http://localhost:${this.port}`);
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      const srv = this.server as { stop?: () => void; close?: () => void };
      if (typeof srv.stop === 'function') {
        srv.stop();
      } else if (typeof srv.close === 'function') {
        srv.close();
      }
      this.server = undefined;
    }
  }
}
