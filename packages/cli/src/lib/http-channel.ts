/**
 * HTTP Channel for AgentForge Daemon
 *
 * Implements an HTTP server with OpenAI-compatible /v1/chat/completions endpoint.
 * Uses Server-Sent Events (SSE) for streaming responses.
 */

import { createServer } from 'node:http';
import { ConvexHttpClient } from 'convex/browser';

/** Maximum allowed request body size (1 MB) to prevent memory exhaustion. */
const MAX_BODY_BYTES = 1 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Static curated model lists — used as fallback and for providers without a
// public /models API.
// ---------------------------------------------------------------------------
const STATIC_MODELS: Record<string, string[]> = {
  openai:     ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini'],
  anthropic:  ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  google:     ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
  xai:        ['grok-3', 'grok-3-mini', 'grok-2'],
  mistral:    ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  deepseek:   ['deepseek-chat', 'deepseek-reasoner'],
  openrouter: ['openrouter/auto', 'openai/gpt-4o', 'anthropic/claude-sonnet-4-6', 'google/gemini-2.5-flash'],
  groq:       ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b'],
  together:   ['meta-llama/Llama-4-Scout-17B-16E-Instruct', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
  perplexity: ['sonar-pro', 'sonar', 'sonar-reasoning-pro'],
};

// Simple in-process cache: provider → { models, fetchedAt }
const modelsCache = new Map<string, { models: string[]; fetchedAt: number }>();
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch available models for a provider.
 * For providers with a public API (OpenAI, Google), queries the live API.
 * For others falls back to the static curated list.
 * Results are cached for MODELS_CACHE_TTL_MS to avoid rate limits.
 */
async function fetchModels(provider: string, apiKey?: string): Promise<string[]> {
  const cached = modelsCache.get(provider);
  if (cached && Date.now() - cached.fetchedAt < MODELS_CACHE_TTL_MS) {
    return cached.models;
  }

  let models: string[] = STATIC_MODELS[provider] ?? [];

  try {
    if (provider === 'openai' && apiKey) {
      // OpenAI has a public /v1/models endpoint
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const data = await resp.json() as { data: { id: string; created: number }[] };
        // Filter to GPT / o-series chat models only (exclude embeddings, audio, etc.)
        const EXCLUDE = ['audio', 'realtime', 'transcribe', 'tts', 'embedding', 'moderation', 'vision', 'dall-e', 'whisper', 'instruct', 'search', 'codex', 'image'];
        const chatModels = data.data
          .filter(m =>
            /^(gpt-|o\d|chatgpt)/i.test(m.id) &&
            !EXCLUDE.some(ex => m.id.toLowerCase().includes(ex))
          )
          .sort((a, b) => b.created - a.created)
          .map(m => m.id)
          .slice(0, 24);
        if (chatModels.length > 0) models = chatModels;
      }
    } else if (provider === 'google' && apiKey) {
      // Google AI Studio has a list-models endpoint
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (resp.ok) {
        const data = await resp.json() as { models: { name: string; supportedGenerationMethods?: string[] }[] };
        const chatModels = (data.models ?? [])
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
          .filter(id => id.startsWith('gemini'))
          .slice(0, 20);
        if (chatModels.length > 0) models = chatModels;
      }
    }
    // All other providers (Anthropic, xAI, Groq, Together, Mistral, DeepSeek, Perplexity,
    // OpenRouter) don't have freely-accessible model-list endpoints — use static list.
  } catch {
    // Network error / timeout — fall back to static list silently
  }

  modelsCache.set(provider, { models, fetchedAt: Date.now() });
  return models;
}

/** Simple cost estimate (USD) based on provider + token counts. */
function estimateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  // Rough pricing per 1M tokens (input / output) as of 2026-Q1
  const pricing: Record<string, [number, number]> = {
    'gpt-4o':          [2.50,  10.00],
    'gpt-4o-mini':     [0.15,   0.60],
    'gpt-4.1':         [2.00,   8.00],
    'gpt-4.1-mini':    [0.40,   1.60],
    'gpt-4.1-nano':    [0.10,   0.40],
    'o3':              [10.00, 40.00],
    'o4-mini':         [1.10,   4.40],
    'claude-opus-4-6':   [15.00, 75.00],
    'claude-sonnet-4-6': [3.00,  15.00],
    'claude-haiku-4-5':  [0.80,   4.00],
    'gemini-2.5-pro':    [1.25,   5.00],
    'gemini-2.5-flash':  [0.075,  0.30],
    'gemini-2.0-flash':  [0.10,   0.40],
  };
  const key = Object.keys(pricing).find(k => model.includes(k));
  if (!key) return 0;
  const [inputPer1M, outputPer1M] = pricing[key];
  return (promptTokens / 1_000_000) * inputPer1M + (completionTokens / 1_000_000) * outputPer1M;
}

export async function startHttpChannel(
  port: number,
  agents: any[],
  convexUrl: string,
  dev = false,
  /** Raw agent configs (with provider + model) — used for usage tracking & model API keys */
  agentConfigs: Array<{ id: string; provider: string; model: string }> = [],
): Promise<() => Promise<void>> {
  const agentMap = new Map<string, any>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent);
  }
  // Config map: agentId → { provider, model }
  const configMap = new Map<string, { provider: string; model: string }>();
  for (const cfg of agentConfigs) {
    configMap.set(cfg.id, cfg);
  }
  // Convex client for storing messages + usage records
  const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

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
              // Mastra v1.8+ stream: type='text-delta', payload.text (not chunk.textDelta)
              const text = chunk.type === 'text-delta'
                ? (chunk as any).payload?.text ?? (chunk as any).textDelta ?? ''
                : null;
              if (text !== null && text !== '') {
                const data = JSON.stringify({
                  id: `chatcmpl-${Date.now()}`,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: agentId,
                  choices: [{
                    index: 0,
                    delta: { content: text },
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

    // GET /api/agents — list loaded agents
    if (url.pathname === '/api/agents' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        agents: agents.map(a => ({
          id: a.id,
          name: a.name ?? a.id,
          model: a.model ?? 'unknown',
        })),
      }));
      return;
    }

    // GET /api/models?provider=openai — return available models for a provider
    // Tries live provider API first (OpenAI, Google), falls back to curated static list.
    // Results cached 5 minutes.
    if (url.pathname === '/api/models' && req.method === 'GET') {
      const provider = url.searchParams.get('provider')?.toLowerCase() ?? '';
      if (!provider) {
        // Return all providers at once
        const all: Record<string, string[]> = {};
        for (const p of Object.keys(STATIC_MODELS)) {
          all[p] = STATIC_MODELS[p];
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ providers: all }));
        return;
      }
      const apiKey = process.env[getProviderEnvKey(provider)];
      const models = await fetchModels(provider, apiKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ provider, models, cached: modelsCache.has(provider) }));
      return;
    }

    // POST /api/chat — simple chat endpoint used by dashboard
    // Body: { agentId: string, message: string, threadId?: string }
    // Returns: { reply: string, threadId: string }
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      let body = '';
      let bodyBytes = 0;
      req.on('data', (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) { req.destroy(); return; }
        body += chunk.toString();
      });
      req.on('end', async () => {
        if (res.writableEnded) return;
        try {
          const { agentId, message, threadId } = JSON.parse(body) as { agentId?: string; message: string; threadId?: string };
          const agent = (agentId ? agentMap.get(agentId) : null) ?? agents[0];
          if (!agent) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Agent not found' }));
            return;
          }
          // Store user message in Convex (if Convex URL configured and threadId provided)
          if (convex && threadId) {
            try {
              await (convex as any).mutation('messages:create', {
                threadId: threadId,
                role: 'user',
                content: message,
              });
            } catch (_e) {
              // Non-fatal: log but continue — response still delivered
              if (dev) console.warn('[api/chat] Failed to store user message:', _e);
            }
          }

          const result = await agent.generate([{ role: 'user', content: message }]);
          const reply = result?.text ?? result?.content ?? String(result ?? '');

          // Extract token usage from Mastra result (AI SDK v5 naming)
          const usage = (result as any)?.usage ?? (result as any)?.rawResponse?.usage ?? null;
          const promptTokens: number =
            usage?.promptTokens ?? usage?.inputTokens ?? usage?.prompt_tokens ?? 0;
          const completionTokens: number =
            usage?.completionTokens ?? usage?.outputTokens ?? usage?.completion_tokens ?? 0;
          const totalTokens = promptTokens + completionTokens;

          // Store assistant reply in Convex
          if (convex && threadId) {
            try {
              await (convex as any).mutation('messages:create', {
                threadId: threadId,
                role: 'assistant',
                content: reply,
              });
            } catch (_e) {
              if (dev) console.warn('[api/chat] Failed to store assistant message:', _e);
            }
          }

          // Record usage in Convex
          if (convex && agent.id) {
            try {
              const cfg = configMap.get(agent.id) ?? { provider: 'openai', model: agent.model ?? 'unknown' };
              const cost = estimateCost(cfg.provider, cfg.model, promptTokens, completionTokens);
              await (convex as any).mutation('usage:record', {
                agentId: agent.id,
                provider: cfg.provider,
                model: cfg.model,
                promptTokens,
                completionTokens,
                totalTokens,
                cost,
              });
            } catch (_e) {
              if (dev) console.warn('[api/chat] Failed to record usage:', _e);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reply, threadId: threadId ?? `thread-${Date.now()}`, agentId: agent.id, usage: { promptTokens, completionTokens, totalTokens } }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
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

/** Map provider name → env var holding the API key. */
function getProviderEnvKey(provider: string): string {
  const map: Record<string, string> = {
    openai:     'OPENAI_API_KEY',
    anthropic:  'ANTHROPIC_API_KEY',
    google:     'GOOGLE_GENERATIVE_AI_API_KEY',
    xai:        'XAI_API_KEY',
    mistral:    'MISTRAL_API_KEY',
    deepseek:   'DEEPSEEK_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    groq:       'GROQ_API_KEY',
    together:   'TOGETHER_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
  };
  return map[provider] ?? `${provider.toUpperCase()}_API_KEY`;
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
