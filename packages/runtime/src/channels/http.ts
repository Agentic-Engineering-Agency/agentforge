import { Hono, type Context } from 'hono';
import { streamText } from 'hono/streaming';
import * as crypto from 'node:crypto';
import type { Agent } from '@mastra/core/agent';
import type { ChannelAdapter, AgentDefinition } from '../daemon/types.js';
import { formatSSEChunk } from './shared.js';
import { getProviderCatalog } from '../models/catalog.js';
import { getModel } from '../models/registry.js';
import { sanitizeHttpInput, InputValidationError } from '../security/input-sanitizer.js';
import { RateLimiter, RateLimitError } from '../security/rate-limiter.js';
import { validateModelOverride } from './model-override.js';
import { createStandardAgent } from '../agent/create-standard-agent.js';

interface DaemonAccess {
  listAgents(): AgentDefinition[];
  listAgentIds(): string[];
  getAgent(id: string): Agent | undefined;
  getOrLoadAgentDefinition(id: string): Promise<{ agent: Agent; definition: AgentDefinition } | null>;
  executeWorkflowRun(runId: string): Promise<{ runId: string; status: 'success' | 'failed'; output?: string; error?: string }>;
}

export interface HttpDataClient {
  query(functionName: string, args: Record<string, unknown>): Promise<unknown>;
  mutation(functionName: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface HttpChannelConfig {
  port?: number;
  apiKey?: string;
  allowedOrigins?: string[];
  dataClient?: HttpDataClient;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5173',
];

const DEFAULT_AGENT_EXECUTION_OPTIONS = {
  maxSteps: 8,
  toolChoice: 'auto' as const,
};

const MAX_ATTACHMENT_TEXT_CHARS = 12_000;

interface ResolvedAttachment {
  id: string;
  name: string;
  mimeType: string;
  content?: string;
}

export class HttpChannel implements ChannelAdapter {
  name = 'http';
  private app: Hono;
  private server?: unknown;
  private port: number;
  private apiKey?: string;
  private allowedOrigins: string[];
  private dataClient?: HttpDataClient;
  private daemon: DaemonAccess | null = null;
  private rateLimiter = new RateLimiter();

  constructor(config: HttpChannelConfig = {}) {
    this.port = config.port ?? 3001;
    this.apiKey = config.apiKey ?? process.env.AGENTFORGE_API_KEY;
    this.allowedOrigins = config.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
    this.dataClient = config.dataClient;
    this.app = new Hono();

    if (!this.apiKey) {
      console.warn(
        '[HttpChannel] WARNING: No AGENTFORGE_API_KEY configured. HTTP channel is running in UNAUTHENTICATED mode. ' +
        'All requests will be accepted without Bearer token verification. ' +
        'Set AGENTFORGE_API_KEY environment variable to enable authentication.'
      );
    }

    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.use('*', async (c, next) => {
      const origin = c.req.header('Origin');
      const allowedOrigin = this.resolveOrigin(origin);
      if (c.req.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: this.corsHeaders(allowedOrigin),
        });
      }

      await next();
      const headers = this.corsHeaders(allowedOrigin);
      for (const [key, value] of Object.entries(headers)) {
        c.res.headers.set(key, value);
      }
    });

    // Auth middleware
    this.app.use('/v1/*', async (c, next) => {
      const apiKey = this.apiKey;
      if (!apiKey) {
        // No API key configured — unauthenticated mode (see startup warning)
        return next();
      }

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

    // Auth middleware for /api/* routes (same as /v1/*)
    this.app.use('/api/*', async (c, next) => {
      const apiKey = this.apiKey;
      if (!apiKey) {
        // No API key configured — unauthenticated mode (see startup warning)
        return next();
      }

      const auth = c.req.header('Authorization');
      if (!auth) {
        return c.json({ error: 'Missing Authorization header' }, 401);
      }
      const [type, token] = auth.split(' ');
      if (type !== 'Bearer' || !token) {
        return c.json({ error: 'Invalid API key' }, 401);
      }
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
      const daemon = this.daemon;
      return c.json({
        status: 'ok',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        agents: daemon?.listAgents().length ?? 0,
        agentIds: daemon?.listAgentIds() ?? [],
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

    this.app.get('/api/models', async (c) => {
      const providerId = c.req.query('provider');
      const providers = await getProviderCatalog();

      if (providerId) {
        const provider = providers.find((entry) => entry.id === providerId);
        if (!provider) {
          return c.json({ error: `Unknown provider: ${providerId}` }, 404);
        }
        return c.json({
          providers: [provider],
          models: provider.models,
        });
      }

      return c.json({ providers });
    });

    this.app.post('/api/chat', async (c) => {
      const daemon = this.daemon;
      if (!daemon) return c.json({ error: 'Daemon not started' }, 503);
      if (!this.dataClient) return c.json({ error: 'Chat persistence is not configured' }, 503);

      // Enforce body size limit (1MB)
      const contentLength = parseInt(c.req.header('Content-Length') ?? '0', 10);
      if (contentLength > 1048576) {
        return c.json({ error: 'Request body too large (max 1MB)' }, 413);
      }

      const body = await c.req.json();
      const {
        agentId,
        threadId: providedThreadId,
        message,
        model: requestModel,
        fileIds = [],
      } = body as {
        agentId?: string;
        threadId?: string;
        message?: string;
        model?: string;
        fileIds?: string[];
      };

      if (!agentId || !message?.trim()) {
        return c.json({ error: 'agentId and message are required' }, 400);
      }

      if (fileIds.length > 10) {
        return c.json({ error: 'Too many file attachments (max 10)' }, 400);
      }

      // Rate limit by API key or IP
      const clientId = this.resolveClientId(c);
      try {
        this.rateLimiter.checkLimit(clientId);
      } catch (error) {
        if (error instanceof RateLimitError) {
          return c.json({ error: error.message }, 429);
        }
        throw error;
      }

      // Sanitize user input
      let sanitizedMessage: string;
      try {
        sanitizedMessage = sanitizeHttpInput(message);
      } catch (error) {
        if (error instanceof InputValidationError) {
          return c.json({ error: 'Message too long. Please shorten your message.' }, 400);
        }
        throw error;
      }

      const resolvedAgent = await daemon.getOrLoadAgentDefinition(agentId);
      if (!resolvedAgent) {
        return c.json({ error: `Agent '${agentId}' not found` }, 404);
      }
      const { agent: defaultAgent, definition } = resolvedAgent;

      const threadId = await this.resolveThreadId(agentId, definition.name, providedThreadId);

      // Resolve model override: request body > thread-level override > agent default
      let effectiveModelId = definition.model ?? 'moonshotai/kimi-k2.5';
      let activeAgent = defaultAgent;

      // Check for model override from request body
      if (requestModel) {
        const validation = validateModelOverride(requestModel, []);
        if (!validation.valid) {
          return c.json({ error: validation.error }, 400);
        }
        effectiveModelId = validation.fullModelId!;
      } else {
        // Fall back to thread-level stored override
        const threadData = await this.dataClient.query('threads:getThread', { threadId })
          .catch(() => null) as { modelOverride?: string } | null;
        if (threadData?.modelOverride) {
          const validation = validateModelOverride(threadData.modelOverride, []);
          if (validation.valid) {
            effectiveModelId = validation.fullModelId!;
          }
        }
      }

      // If the effective model differs from the agent's default, create a
      // temporary agent with the overridden model. The default agent instance
      // is never mutated — it stays in the daemon cache unchanged.
      if (effectiveModelId !== (definition.model ?? 'moonshotai/kimi-k2.5')) {
        activeAgent = createStandardAgent({
          id: definition.id,
          name: definition.name,
          description: definition.description,
          instructions: definition.instructions,
          model: effectiveModelId,
          tools: definition.tools,
          disableMemory: definition.disableMemory,
        });
      }

      const existingMessages = await this.dataClient.query('messages:getByThread', { threadId })
        .catch(() => []) as Array<{ role?: string; content?: string }> | [];
      const attachments = await this.resolveAttachments(fileIds);
      const storedUserMessage = this.formatStoredUserMessage(sanitizedMessage, attachments);
      const agentUserMessage = this.formatAgentUserMessage(sanitizedMessage, attachments);

      await this.dataClient.mutation('messages:create', {
        threadId,
        role: 'user',
        content: storedUserMessage,
      });

      const sessionId = `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      await this.dataClient.mutation('sessions:create', {
        sessionId,
        threadId,
        agentId,
        channel: 'dashboard',
      });

      const history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
        ...existingMessages
          .filter((entry) => typeof entry.role === 'string' && typeof entry.content === 'string')
          .filter((entry) => entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system')
          .map((entry) => ({
            role: entry.role as 'user' | 'assistant' | 'system',
            content: entry.content as string,
          })),
        { role: 'user' as const, content: agentUserMessage },
      ];

      try {
        const result = await activeAgent.generate(history as any, DEFAULT_AGENT_EXECUTION_OPTIONS);
        const assistantText = result.text ?? '';

        await this.dataClient.mutation('messages:create', {
          threadId,
          role: 'assistant',
          content: assistantText,
        });

        const [provider, ...modelParts] = effectiveModelId.split('/');
        const model = modelParts.join('/') || effectiveModelId;
        const promptTokens = estimateTokens(agentUserMessage);
        const completionTokens = estimateTokens(assistantText);
        const cost = estimateCost(effectiveModelId, promptTokens, completionTokens);

        await this.dataClient.mutation('usage:record', {
          agentId,
          sessionId,
          provider,
          model,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          cost,
        });
        await this.dataClient.mutation('sessions:updateStatus', {
          sessionId,
          status: 'completed',
        });

        return c.json({
          threadId,
          sessionId,
          model: effectiveModelId,
          message: {
            role: 'assistant',
            content: assistantText,
          },
        });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Unknown chat error';
        await this.dataClient.mutation('sessions:updateStatus', {
          sessionId,
          status: 'error',
        }).catch(() => undefined);
        return c.json({ error: messageText }, 500);
      }
    });

    // Chat completions - OpenAI compatible
    this.app.post('/v1/chat/completions', async (c) => {
      const daemon = this.daemon;
      if (!daemon) return c.json({ error: 'Daemon not started' }, 503);

      // Enforce body size limit (1MB)
      const contentLength = parseInt(c.req.header('Content-Length') ?? '0', 10);
      if (contentLength > 1048576) {
        return c.json({ error: { message: 'Request body too large (max 1MB)', type: 'invalid_request_error' } }, 413);
      }

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

      // Rate limit by API key or IP
      const clientId = this.resolveClientId(c);
      try {
        this.rateLimiter.checkLimit(clientId);
      } catch (error) {
        if (error instanceof RateLimitError) {
          return c.json({ error: { message: error.message, type: 'rate_limit_error' } }, 429);
        }
        throw error;
      }

      // Get agent by model ID (agent ID)
      const agent = daemon.getAgent(model);
      if (!agent) {
        return c.json({ error: { message: `Agent '${model}' not found`, type: 'invalid_request_error' } }, 404);
      }

      // Convert OpenAI format to Mastra format
      const lastMessage = messages[messages.length - 1];
      let userMessage = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);

      // Sanitize user input
      try {
        userMessage = sanitizeHttpInput(userMessage);
      } catch (error) {
        if (error instanceof InputValidationError) {
          return c.json({ error: { message: 'Message too long. Please shorten your message.', type: 'invalid_request_error' } }, 400);
        }
        throw error;
      }

      if (!stream) {
        // Non-streaming response
        try {
          const result = await agent.generate([{ role: 'user', content: userMessage }], DEFAULT_AGENT_EXECUTION_OPTIONS);
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
          const mastraStream = await agent.stream([{ role: 'user', content: userMessage }], DEFAULT_AGENT_EXECUTION_OPTIONS);
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

    this.app.post('/v1/workflows/runs/:id/execute', async (c) => {
      const daemon = this.daemon;
      if (!daemon) return c.json({ error: 'Daemon not started' }, 503);

      const runId = c.req.param('id');
      if (!runId) {
        return c.json({ error: 'Workflow run ID is required' }, 400);
      }

      try {
        const result = await daemon.executeWorkflowRun(runId);
        const status = result.status === 'success' ? 200 : 500;
        return c.json(result, status);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown workflow execution error';
        return c.json({
          runId,
          status: 'failed',
          error: message,
        }, 500);
      }
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

  private resolveClientId(c: Context): string {
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
        return `bearer:${this.hashClientIdentifier(parts[1])}`;
      }
      return `auth:${this.hashClientIdentifier(authHeader)}`;
    }

    const xForwardedFor = c.req.header('X-Forwarded-For');
    if (xForwardedFor) {
      const firstIp = xForwardedFor.split(',')[0]?.trim();
      if (firstIp) {
        return `ip:${this.hashClientIdentifier(firstIp)}`;
      }
    }

    return 'anonymous';
  }

  private hashClientIdentifier(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private resolveOrigin(origin: string | undefined): string {
    if (origin && this.allowedOrigins.includes(origin)) {
      return origin;
    }
    return this.allowedOrigins[0] ?? '*';
  }

  private async resolveThreadId(agentId: string, agentName: string, providedThreadId?: string): Promise<string> {
    if (!this.dataClient) {
      throw new Error('Chat persistence is not configured');
    }

    if (providedThreadId && isProbablyConvexId(providedThreadId)) {
      const existingThread = await this.dataClient.query('threads:getThread', { threadId: providedThreadId })
        .catch(() => null);
      if (existingThread) {
        return providedThreadId;
      }
    }

    return String(await this.dataClient.mutation('threads:createThread', {
      agentId,
      name: `Chat with ${agentName}`,
    }));
  }

  private corsHeaders(origin: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Vary': 'Origin',
    };
  }

  private async resolveAttachments(fileIds: string[]): Promise<ResolvedAttachment[]> {
    if (!this.dataClient || fileIds.length === 0) {
      return [];
    }

    const attachments = await Promise.all(fileIds.map(async (fileId) => {
      const download = await this.dataClient!.query('files:getDownloadUrl', { id: fileId })
        .catch(() => null) as { url?: string; name?: string; mimeType?: string } | null;

      if (!download?.url) {
        return {
          id: fileId,
          name: fileId,
          mimeType: 'application/octet-stream',
        } satisfies ResolvedAttachment;
      }

      const mimeType = download.mimeType ?? 'application/octet-stream';
      const content = await fetchAttachmentText(download.url, mimeType);
      return {
        id: fileId,
        name: download.name ?? fileId,
        mimeType,
        content: content ?? undefined,
      } satisfies ResolvedAttachment;
    }));

    return attachments;
  }

  private formatStoredUserMessage(message: string, attachments: ResolvedAttachment[]): string {
    if (attachments.length === 0) {
      return message;
    }

    const names = attachments.map((attachment) => attachment.name).join(', ');
    return `${message}\n\nAttached files: ${names}`;
  }

  private formatAgentUserMessage(message: string, attachments: ResolvedAttachment[]): string {
    if (attachments.length === 0) {
      return message;
    }

    const attachmentContext = attachments.map((attachment) => {
      if (attachment.content) {
        return [
          `File: ${attachment.name}`,
          `MIME: ${attachment.mimeType}`,
          'Content:',
          attachment.content,
        ].join('\n');
      }

      return [
        `File: ${attachment.name}`,
        `MIME: ${attachment.mimeType}`,
        'Content preview unavailable for this attachment.',
      ].join('\n');
    }).join('\n\n');

    return `${message}\n\nAttached files:\n${attachmentContext}`;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function isProbablyConvexId(value: string): boolean {
  return /^[a-z0-9]{32}$/i.test(value);
}

function estimateCost(modelId: string, promptTokens: number, completionTokens: number): number {
  const model = getModel(modelId);
  if (!model) {
    return 0;
  }

  const promptCost = (promptTokens / 1_000_000) * model.costPerMInput;
  const completionCost = (completionTokens / 1_000_000) * model.costPerMOutput;
  return Number((promptCost + completionCost).toFixed(8));
}

async function fetchAttachmentText(url: string, mimeType: string): Promise<string | null> {
  if (!isTextLikeMime(mimeType)) {
    return null;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const responseMimeType = response.headers.get('content-type')?.split(';')[0]?.trim();
    if (responseMimeType && !isTextLikeMime(responseMimeType)) {
      return null;
    }

    const text = await response.text();
    if (!text.trim()) {
      return null;
    }

    return text.length > MAX_ATTACHMENT_TEXT_CHARS
      ? `${text.slice(0, MAX_ATTACHMENT_TEXT_CHARS)}\n...[truncated]`
      : text;
  } catch {
    return null;
  }
}

function isTextLikeMime(mimeType: string): boolean {
  if (!mimeType) {
    return false;
  }

  if (mimeType.startsWith('text/')) {
    return true;
  }

  return [
    'application/json',
    'application/ld+json',
    'application/xml',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-typescript',
    'application/yaml',
    'application/x-yaml',
    'image/svg+xml',
  ].includes(mimeType);
}
