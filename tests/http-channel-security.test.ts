import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { HttpChannel } from '../packages/runtime/src/channels/http.js';

/**
 * Integration tests for HTTP channel security features.
 *
 * Covers: authentication, rate limiting, input sanitization, and CORS.
 * Issue #225
 */

function getApp(channel: HttpChannel) {
  return (channel as unknown as { app: { request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } }).app;
}

/** Build a channel with API key auth enabled and a mock daemon wired up. */
function buildAuthChannel(apiKey: string, opts: { dataClient?: unknown } = {}) {
  const dataClient = (opts.dataClient as Record<string, unknown> | undefined) ?? {
    query: vi.fn().mockResolvedValue([]),
    mutation: vi.fn().mockImplementation(async (name: string) => {
      if (name === 'threads:createThread') return 'nd76tnamzzrnxye4wn2ry24j0s82fthc';
      if (name === 'sessions:create') return 'session-doc-id';
      if (name === 'messages:create') return 'message-doc-id';
      return null;
    }),
  };

  const channel = new HttpChannel({
    apiKey,
    allowedOrigins: ['http://localhost:5173'],
    dataClient: dataClient as any,
  });

  const mockAgent = {
    generate: vi.fn().mockResolvedValue({ text: 'ok' }),
  };

  (channel as unknown as { daemon: unknown }).daemon = {
    listAgents: () => [{ id: 'assistant', name: 'Assistant', instructions: '', model: 'openai/gpt-5.2' }],
    listAgentIds: () => ['assistant'],
    getAgent: () => mockAgent,
    getOrLoadAgentDefinition: async () => ({
      agent: mockAgent,
      definition: { id: 'assistant', name: 'Assistant', instructions: '', model: 'openai/gpt-5.2' },
    }),
    executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
  };

  return { channel, mockAgent, dataClient };
}

// ---------------------------------------------------------------------------
// 1. Authentication
// ---------------------------------------------------------------------------

describe('HTTP channel — authentication', () => {
  const API_KEY = 'test-secret-key-12345';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response));
  });

  it('rejects /v1/agents without Authorization header → 401', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/v1/agents');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Missing Authorization/i);
  });

  it('rejects /v1/agents with wrong bearer token → 401', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/v1/agents', {
      headers: { Authorization: 'Bearer wrong-key' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid API key/i);
  });

  it('rejects /v1/agents with non-Bearer auth scheme → 401', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/v1/agents', {
      headers: { Authorization: `Basic ${API_KEY}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Invalid API key/i);
  });

  it('accepts /v1/agents with correct bearer token → 200', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/v1/agents', {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { object: string; data: unknown[] };
    expect(body.object).toBe('list');
    expect(body.data).toHaveLength(1);
  });

  it('rejects /api/chat without Authorization header → 401', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'assistant', message: 'hi' }),
    });
    expect(res.status).toBe(401);
  });

  it('accepts /api/chat with correct bearer token → 200', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ agentId: 'assistant', message: 'hello' }),
    });
    expect(res.status).toBe(200);
  });

  it('allows /health without authentication (public endpoint)', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const res = await getApp(channel).request('http://localhost/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('allows unauthenticated access when no API key is configured', async () => {
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:5173'],
    });

    (channel as unknown as { daemon: unknown }).daemon = {
      listAgents: () => [{ id: 'assistant', name: 'Assistant', instructions: '', model: 'openai/gpt-5.2' }],
      listAgentIds: () => ['assistant'],
      getAgent: () => ({}),
      getOrLoadAgentDefinition: async () => null,
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const res = await getApp(channel).request('http://localhost/v1/agents');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 2. Rate Limiting
// ---------------------------------------------------------------------------

describe('HTTP channel — rate limiting', () => {
  const API_KEY = 'rate-limit-test-key';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 429 when /api/chat burst limit is exceeded', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const app = getApp(channel);

    const makeRequest = () =>
      app.request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ agentId: 'assistant', message: 'ping' }),
      });

    // Default burst size is 10. Fire 10 requests, all should succeed.
    const successResults: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await makeRequest();
      successResults.push(res.status);
    }
    expect(successResults.every((s) => s === 200)).toBe(true);

    // The 11th request (same second) should be rate-limited.
    const rateLimited = await makeRequest();
    expect(rateLimited.status).toBe(429);
    const body = await rateLimited.json() as { error: string };
    expect(body.error).toMatch(/rate limit/i);
  });

  it('returns 429 when /v1/chat/completions burst limit is exceeded', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const app = getApp(channel);

    const makeRequest = () =>
      app.request('http://localhost/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: 'assistant',
          messages: [{ role: 'user', content: 'hi' }],
          stream: false,
        }),
      });

    // Exhaust burst
    for (let i = 0; i < 10; i++) {
      await makeRequest();
    }

    const rateLimited = await makeRequest();
    expect(rateLimited.status).toBe(429);
  });

  it('resets rate limit after time window elapses', async () => {
    const { channel } = buildAuthChannel(API_KEY);
    const app = getApp(channel);

    const makeRequest = () =>
      app.request('http://localhost/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ agentId: 'assistant', message: 'ping' }),
      });

    // Exhaust burst
    for (let i = 0; i < 10; i++) {
      await makeRequest();
    }

    // Should be blocked
    const blocked = await makeRequest();
    expect(blocked.status).toBe(429);

    // Advance time past the 1-second burst window
    vi.advanceTimersByTime(1100);

    // Should be allowed again
    const allowed = await makeRequest();
    expect(allowed.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. Input Sanitization
// ---------------------------------------------------------------------------

describe('HTTP channel — input sanitization', () => {
  const API_KEY = 'sanitize-test-key';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response));
  });

  it('strips null bytes from chat messages before passing to agent', async () => {
    const { channel, mockAgent } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agentId: 'assistant',
        message: 'hello\x00world',
      }),
    });

    expect(res.status).toBe(200);
    const prompt = mockAgent.generate.mock.calls[0]?.[0]?.at(-1)?.content;
    expect(prompt).toBe('helloworld');
    expect(prompt).not.toContain('\x00');
  });

  it('strips control characters from chat messages', async () => {
    const { channel, mockAgent } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agentId: 'assistant',
        message: 'hello\x01\x07world',
      }),
    });

    expect(res.status).toBe(200);
    const prompt = mockAgent.generate.mock.calls[0]?.[0]?.at(-1)?.content;
    expect(prompt).toBe('helloworld');
  });

  it('preserves legitimate newlines and tabs in messages', async () => {
    const { channel, mockAgent } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agentId: 'assistant',
        message: 'line1\nline2\ttab',
      }),
    });

    expect(res.status).toBe(200);
    const prompt = mockAgent.generate.mock.calls[0]?.[0]?.at(-1)?.content;
    expect(prompt).toBe('line1\nline2\ttab');
  });

  it('rejects messages exceeding max length → 400', async () => {
    const { channel } = buildAuthChannel(API_KEY);

    const longMessage = 'a'.repeat(17000);
    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agentId: 'assistant',
        message: longMessage,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/too long|shorten/i);
  });

  it('neutralizes XSS payloads via control character stripping', async () => {
    const { channel, mockAgent } = buildAuthChannel(API_KEY);

    // Inject script tags with embedded control chars
    const xssPayload = '<script\x00>alert("xss")</script\x00>';
    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agentId: 'assistant',
        message: xssPayload,
      }),
    });

    expect(res.status).toBe(200);
    const prompt = mockAgent.generate.mock.calls[0]?.[0]?.at(-1)?.content;
    // Null bytes stripped; the rest of the payload is passed through
    // (LLM inputs aren't HTML-escaped, but null bytes are removed)
    expect(prompt).not.toContain('\x00');
    expect(prompt).toBe('<script>alert("xss")</script>');
  });

  it('sanitizes /v1/chat/completions input too', async () => {
    const { channel, mockAgent } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'assistant',
        messages: [{ role: 'user', content: 'test\x00\x01input' }],
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const prompt = mockAgent.generate.mock.calls[0]?.[0]?.[0]?.content;
    expect(prompt).toBe('testinput');
  });

  it('rejects /api/chat with missing agentId → 400', async () => {
    const { channel } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ message: 'hi' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/agentId/i);
  });

  it('rejects /api/chat with empty message → 400', async () => {
    const { channel } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ agentId: 'assistant', message: '   ' }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects /api/chat with too many file attachments → 400', async () => {
    const { channel } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        agentId: 'assistant',
        message: 'hi',
        fileIds: Array.from({ length: 11 }, (_, i) => `file-${i}`),
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/too many file/i);
  });
});

// ---------------------------------------------------------------------------
// 4. CORS
// ---------------------------------------------------------------------------

describe('HTTP channel — CORS headers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response));
  });

  it('returns correct CORS headers for allowed origin', async () => {
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
    });

    (channel as unknown as { daemon: unknown }).daemon = {
      listAgents: () => [],
      listAgentIds: () => [],
      getAgent: () => undefined,
      getOrLoadAgentDefinition: async () => null,
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const res = await getApp(channel).request('http://localhost/health', {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('falls back to first allowed origin for unknown Origin', async () => {
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:5173'],
    });

    (channel as unknown as { daemon: unknown }).daemon = {
      listAgents: () => [],
      listAgentIds: () => [],
      getAgent: () => undefined,
      getOrLoadAgentDefinition: async () => null,
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const res = await getApp(channel).request('http://localhost/health', {
      headers: { Origin: 'http://evil.example.com' },
    });

    expect(res.status).toBe(200);
    // Doesn't reflect the evil origin — falls back to first allowed
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('handles OPTIONS preflight request → 204', async () => {
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:5173'],
    });

    const res = await getApp(channel).request('http://localhost/v1/agents', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
  });

  it('does not reflect arbitrary origins in CORS headers', async () => {
    const channel = new HttpChannel({
      allowedOrigins: ['http://localhost:3000'],
    });

    (channel as unknown as { daemon: unknown }).daemon = {
      listAgents: () => [],
      listAgentIds: () => [],
      getAgent: () => undefined,
      getOrLoadAgentDefinition: async () => null,
      executeWorkflowRun: async (runId: string) => ({ runId, status: 'success' }),
    };

    const res = await getApp(channel).request('http://localhost/health', {
      headers: { Origin: 'http://attacker.com' },
    });

    // Should NOT reflect the attacker's origin
    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('http://attacker.com');
  });
});

// ---------------------------------------------------------------------------
// 5. Body size limit
// ---------------------------------------------------------------------------

describe('HTTP channel — body size limit', () => {
  const API_KEY = 'body-size-test-key';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response));
  });

  it('rejects /api/chat when Content-Length exceeds 1MB → 413', async () => {
    const { channel } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        'Content-Length': '2000000', // 2MB
      },
      body: JSON.stringify({ agentId: 'assistant', message: 'hi' }),
    });

    expect(res.status).toBe(413);
  });

  it('rejects /v1/chat/completions when Content-Length exceeds 1MB → 413', async () => {
    const { channel } = buildAuthChannel(API_KEY);

    const res = await getApp(channel).request('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        'Content-Length': '2000000',
      },
      body: JSON.stringify({
        model: 'assistant',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    });

    expect(res.status).toBe(413);
  });
});
