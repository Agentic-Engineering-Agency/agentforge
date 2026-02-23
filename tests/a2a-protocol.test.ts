import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  A2AAgentRegistry,
  A2AClient,
  A2AServer,
  Agent,
} from '@agentforge-ai/core';
import type { A2AResult, A2ATask } from '@agentforge-ai/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<A2ATask> = {}): A2ATask {
  return {
    id: 'task-001',
    from: 'agent-a',
    to: 'agent-b',
    instruction: 'Do something useful',
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeSuccessResult(taskId = 'task-001'): A2AResult {
  return {
    taskId,
    status: 'success',
    output: 'mock response',
    durationMs: 42,
  };
}

// ---------------------------------------------------------------------------
// A2AAgentRegistry
// ---------------------------------------------------------------------------

describe('A2AAgentRegistry', () => {
  it('register and resolve an agent', () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-x', 'http://agent-x.local/a2a/task');
    expect(registry.resolve('agent-x')).toBe('http://agent-x.local/a2a/task');
  });

  it('unregister removes agent', () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-x', 'http://agent-x.local/a2a/task');
    registry.unregister('agent-x');
    expect(registry.resolve('agent-x')).toBeUndefined();
  });

  it('list returns all registered agents', () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-1', 'http://agent-1.local');
    registry.register('agent-2', 'http://agent-2.local');
    registry.register('agent-3', 'http://agent-3.local');
    const list = registry.list();
    expect(list).toHaveLength(3);
    const ids = list.map((a) => a.id);
    expect(ids).toContain('agent-1');
    expect(ids).toContain('agent-2');
    expect(ids).toContain('agent-3');
  });

  it('findByCapability filters correctly', () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-coder', 'http://coder.local', ['coding', 'review']);
    registry.register('agent-writer', 'http://writer.local', ['writing']);
    registry.register('agent-reviewer', 'http://reviewer.local', ['review']);
    const coders = registry.findByCapability('coding');
    expect(coders).toHaveLength(1);
    expect(coders[0].id).toBe('agent-coder');
    const reviewers = registry.findByCapability('review');
    expect(reviewers).toHaveLength(2);
    const reviewerIds = reviewers.map((a) => a.id);
    expect(reviewerIds).toContain('agent-coder');
    expect(reviewerIds).toContain('agent-reviewer');
  });

  it('register validates agent ID format', () => {
    const registry = new A2AAgentRegistry();
    // Empty string
    expect(() => registry.register('', 'http://x.local')).toThrow();
    // Special characters
    expect(() => registry.register('agent@host', 'http://x.local')).toThrow();
    expect(() => registry.register('agent!name', 'http://x.local')).toThrow();
    // More than 128 chars
    expect(() => registry.register('a'.repeat(129), 'http://x.local')).toThrow();
    // Valid IDs should not throw
    expect(() => registry.register('valid-agent_01', 'http://x.local')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// A2AClient
// ---------------------------------------------------------------------------

describe('A2AClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegate sends task and returns result', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-b', 'http://agent-b.local/a2a/task');
    const client = new A2AClient(registry);

    const mockResult = makeSuccessResult();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await client.delegate({
      from: 'agent-a',
      to: 'agent-b',
      instruction: 'Do something useful',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://agent-b.local/a2a/task');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.from).toBe('agent-a');
    expect(body.to).toBe('agent-b');
    expect(body.instruction).toBe('Do something useful');
    expect(result.status).toBe('success');
    expect(result.output).toBe('mock response');
  });

  it('delegate throws on unregistered agent', async () => {
    const registry = new A2AAgentRegistry();
    const client = new A2AClient(registry);

    await expect(
      client.delegate({ from: 'agent-a', to: 'unknown-agent', instruction: 'Hello' })
    ).rejects.toThrow(/not registered/i);
  });

  it('delegate enforces timeout', async () => {
    vi.useFakeTimers();

    const registry = new A2AAgentRegistry();
    registry.register('slow-agent', 'http://slow.local/a2a/task');
    const client = new A2AClient(registry);

    // fetch never resolves
    const mockFetch = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', mockFetch);

    const delegatePromise = client.delegate({
      from: 'agent-a',
      to: 'slow-agent',
      instruction: 'Do something',
      constraints: { timeoutMs: 100 },
    });

    // Advance timers past the timeout
    await vi.runAllTimersAsync();

    const result = await delegatePromise;
    expect(result.status).toBe('timeout');

    vi.useRealTimers();
  });

  it('delegate validates instruction length', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-b', 'http://agent-b.local/a2a/task');
    const client = new A2AClient(registry);

    const tooLong = 'x'.repeat(10_001);
    await expect(
      client.delegate({ from: 'agent-a', to: 'agent-b', instruction: tooLong })
    ).rejects.toThrow(/exceeds maximum length/i);
  });

  it('delegate generates unique task IDs', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-b', 'http://agent-b.local/a2a/task');
    const client = new A2AClient(registry);

    const mockResult = makeSuccessResult();
    // Each call must return a fresh Response — a Response body can only be consumed once
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    vi.stubGlobal('fetch', mockFetch);

    await client.delegate({ from: 'agent-a', to: 'agent-b', instruction: 'First call' });
    await client.delegate({ from: 'agent-a', to: 'agent-b', instruction: 'Second call' });

    const body1 = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const body2 = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(body1.id).toBeTruthy();
    expect(body2.id).toBeTruthy();
    expect(body1.id).not.toBe(body2.id);
  });

  it('delegateStream yields chunks', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-b', 'http://agent-b.local/a2a/task');
    const client = new A2AClient(registry);

    const chunks = [
      { taskId: 'task-001', type: 'text', content: 'Hello' },
      { taskId: 'task-001', type: 'text', content: ' world' },
    ];

    // Build a mock SSE stream body
    const sseLines = chunks.map((c) => `data: ${JSON.stringify(c)}`).join('\n') + '\n';
    const encoder = new TextEncoder();
    const mockReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseLines));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(mockReadableStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const received = [];
    for await (const chunk of client.delegateStream({
      from: 'agent-a',
      to: 'agent-b',
      instruction: 'Stream something',
    })) {
      received.push(chunk);
    }

    expect(received).toHaveLength(2);
    expect(received[0].content).toBe('Hello');
    expect(received[1].content).toBe(' world');
  });
});

// ---------------------------------------------------------------------------
// A2AServer
// ---------------------------------------------------------------------------

describe('A2AServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handleTask processes valid task', async () => {
    const mockAgent = {
      id: 'test-agent',
      generate: vi.fn().mockResolvedValue({ text: 'mock response' }),
    } as any;
    const server = new A2AServer(mockAgent);
    const task = makeTask();
    const result = await server.handleTask(task);

    expect(result.taskId).toBe('task-001');
    expect(result.status).toBe('success');
    expect(result.output).toBe('mock response');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handleTask rejects task with instruction too long', async () => {
    const mockAgent = { id: 'test-agent', generate: vi.fn().mockResolvedValue({ text: 'ok' }) } as any;
    const server = new A2AServer(mockAgent, { maxInstructionLength: 50 });
    // Build a valid task manually — validateTask is called inside createHandler, not handleTask
    // But we can verify behaviour via createHandler which calls validateTask
    const handler = server.createHandler();
    const task = makeTask({ instruction: 'x'.repeat(51) });
    const req = new Request('http://localhost/a2a/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const response = await handler(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/exceeds maximum length/i);
  });

  it('createHandler returns 200 for a valid request', async () => {
    const mockAgent = { id: 'test-agent', generate: vi.fn().mockResolvedValue({ text: 'mock response' }) } as any;
    const server = new A2AServer(mockAgent);
    const handler = server.createHandler();
    const task = makeTask();
    const req = new Request('http://localhost/a2a/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const response = await handler(req);
    expect(response.status).toBe(200);
    const result = (await response.json()) as A2AResult;
    expect(result.status).toBe('success');
    expect(result.output).toBe('mock response');
  });

  it('createHandler rejects unauthorized request when requireAuth is true', async () => {
    const mockAgent = { id: 'test-agent', generate: vi.fn().mockResolvedValue({ text: 'ok' }) } as any;
    const server = new A2AServer(mockAgent, { requireAuth: true });
    const handler = server.createHandler();
    const task = makeTask();
    // No Authorization header
    const req = new Request('http://localhost/a2a/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const response = await handler(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('createHandler accepts authorized request when requireAuth is true', async () => {
    const mockAgent = { id: 'test-agent', generate: vi.fn().mockResolvedValue({ text: 'mock response' }) } as any;
    const server = new A2AServer(mockAgent, { requireAuth: true });
    const handler = server.createHandler();
    const task = makeTask();
    const req = new Request('http://localhost/a2a/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret-token',
      },
      body: JSON.stringify(task),
    });
    const response = await handler(req);
    expect(response.status).toBe(200);
  });

  it('createHandler enforces agent whitelist', async () => {
    const mockAgent = { id: 'test-agent', generate: vi.fn().mockResolvedValue({ text: 'ok' }) } as any;
    const server = new A2AServer(mockAgent, {
      allowedAgents: ['trusted-agent'],
    });
    const handler = server.createHandler();
    // task.from is NOT in the whitelist
    const task = makeTask({ from: 'untrusted-agent' });
    const req = new Request('http://localhost/a2a/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const response = await handler(req);
    // handleTask returns error result → status 500 when whitelist denies
    expect(response.status).not.toBe(200);
    const body = (await response.json()) as A2AResult;
    expect(body.status).toBe('error');
    expect(body.output).toMatch(/not in the allowed/i);
  });

  it('handleTask limits instruction length via server config', async () => {
    const mockAgent = { id: 'test-agent', generate: vi.fn().mockResolvedValue({ text: 'ok' }) } as any;
    const server = new A2AServer(mockAgent, { maxInstructionLength: 10 });
    const handler = server.createHandler();
    const task = makeTask({ instruction: 'x'.repeat(11) });
    const req = new Request('http://localhost/a2a/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const response = await handler(req);
    expect(response.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Context & Constraints
// ---------------------------------------------------------------------------

describe('Context & Constraints', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('context is passed to receiving agent in request body', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-b', 'http://agent-b.local/a2a/task');
    const client = new A2AClient(registry);

    const mockResult = makeSuccessResult();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const context = {
      messages: [{ role: 'user' as const, content: 'Prior message' }],
      metadata: { sessionId: 'abc-123' },
    };

    await client.delegate({
      from: 'agent-a',
      to: 'agent-b',
      instruction: 'Use context',
      context,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.context).toEqual(context);
    expect(body.context.messages[0].content).toBe('Prior message');
    expect(body.context.metadata.sessionId).toBe('abc-123');
  });

  it('constraints are serialized in the request body', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('agent-b', 'http://agent-b.local/a2a/task');
    const client = new A2AClient(registry);

    const mockResult = makeSuccessResult();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const constraints = { maxTokens: 500, maxCost: 0.05 };

    await client.delegate({
      from: 'agent-a',
      to: 'agent-b',
      instruction: 'Constrained task',
      constraints,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.constraints).toEqual(constraints);
    expect(body.constraints.maxTokens).toBe(500);
    expect(body.constraints.maxCost).toBe(0.05);
  });

  it('result includes durationMs from server', async () => {
    const mockAgent = {
      id: 'test-agent',
      generate: vi.fn().mockResolvedValue({ text: 'done' }),
    } as any;

    const server = new A2AServer(mockAgent);
    const task = makeTask();
    const result = await server.handleTask(task);

    expect(result.durationMs).toBeDefined();
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

describe('Integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('full delegation round-trip via mocked HTTP', async () => {
    // Server side
    const receivingAgent = {
      id: 'receiver',
      generate: vi.fn().mockResolvedValue({ text: 'round-trip result' }),
    } as any;
    const server = new A2AServer(receivingAgent);

    // Build the handler once so we can call it directly
    const handler = server.createHandler();

    // Client side
    const registry = new A2AAgentRegistry();
    registry.register('receiver', 'http://receiver.local/a2a/task');
    const client = new A2AClient(registry);

    // Wire fetch to call the server handler directly (in-process mock)
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const req = new Request('http://receiver.local/a2a/task', {
        method: 'POST',
        headers: init.headers as Record<string, string>,
        body: init.body as string,
      });
      return handler(req);
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await client.delegate({
      from: 'sender',
      to: 'receiver',
      instruction: 'End-to-end test',
    });

    expect(result.status).toBe('success');
    expect(result.output).toBe('round-trip result');
    expect(receivingAgent.generate).toHaveBeenCalledWith('End-to-end test');
  });

  it('Agent.delegate() method works with a2aRegistry', async () => {
    const registry = new A2AAgentRegistry();
    registry.register('helper-agent', 'http://helper.local/a2a/task');

    const agentUnderTest = new Agent({
      id: 'orchestrator',
      name: 'Orchestrator',
      instructions: 'You orchestrate tasks.',
      model: 'openai/gpt-4o-mini',
      a2aRegistry: registry,
    });

    const mockResult = makeSuccessResult('delegated-task');
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await agentUnderTest.delegate({
      to: 'helper-agent',
      instruction: 'Help me with something',
    });

    expect(result.status).toBe('success');
    expect(mockFetch).toHaveBeenCalledOnce();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.from).toBe('orchestrator');
    expect(body.to).toBe('helper-agent');
    expect(body.instruction).toBe('Help me with something');
  });

  it('Agent.delegate() throws when no a2aRegistry configured', async () => {
    const agentWithoutRegistry = new Agent({
      id: 'lone-agent',
      name: 'Lone Agent',
      instructions: 'No registry.',
      model: 'openai/gpt-4o-mini',
    });

    await expect(
      agentWithoutRegistry.delegate({ to: 'anyone', instruction: 'Do stuff' })
    ).rejects.toThrow(/a2a not configured/i);
  });
});
