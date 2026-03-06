import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import type { Agent } from '@mastra/core/agent';
import type { ChannelAdapter } from '../daemon/types.js';
import { formatSSEChunk } from './shared.js';

// Type for daemon stored in Hono context
interface HonoEnv {
  Variables: {
    daemon: any;
  };
}

export interface HttpChannelConfig {
  port?: number;
  apiKey?: string;
}

export class HttpChannel implements ChannelAdapter {
  name = 'http';
  private app: Hono<HonoEnv>;
  private server?: any;
  private port: number;
  private apiKey?: string;

  constructor(config: HttpChannelConfig = {}) {
    this.port = config.port ?? 3001;
    this.apiKey = config.apiKey ?? process.env.AGENTFORGE_API_KEY;
    this.app = new Hono<HonoEnv>();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Auth middleware
    this.app.use('*', async (c, next) => {
      if (!this.apiKey) return next();

      const auth = c.req.header('Authorization');
      if (!auth) {
        return c.json({ error: 'Missing Authorization header' }, 401);
      }
      const [type, token] = auth.split(' ');
      if (type !== 'Bearer' || token !== this.apiKey) {
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
      const daemon = c.get('daemon');
      const agents = daemon.listAgents();
      return c.json({
        object: 'list',
        data: agents.map((a: any) => ({
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
      const daemon = c.get('daemon');
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

  async start(agents: Map<string, Agent>, daemon: any): Promise<void> {
    // Store daemon reference for route handlers
    this.app.use('*', async (c, next) => {
      c.set('daemon', daemon);
      await next();
    });

    // Try Bun first, then fallback to Node.js
    const BunServe = typeof (globalThis as any).Bun?.serve === 'function'
      ? (globalThis as any).Bun.serve
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
      if (typeof this.server.stop === 'function') {
        this.server.stop();
      } else if (typeof this.server.close === 'function') {
        this.server.close();
      }
      this.server = undefined;
    }
  }
}
