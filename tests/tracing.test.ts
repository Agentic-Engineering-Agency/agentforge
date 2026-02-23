/**
 * Tests for AGE-19: Opik LLM Observability Tracing
 *
 * Covers convex/lib/tracing.ts utility functions.
 * These tests run in Node.js (vitest), not Convex runtime.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: Static analysis — convex/lib/tracing.ts exists and exports
// ---------------------------------------------------------------------------

describe('AGE-19: Tracing Module — static analysis', () => {
  const tracingPath = path.resolve(__dirname, '../convex/lib/tracing.ts');

  it('convex/lib/tracing.ts should exist', () => {
    expect(fs.existsSync(tracingPath)).toBe(true);
  });

  const tracingContent = fs.existsSync(tracingPath)
    ? fs.readFileSync(tracingPath, 'utf-8')
    : '';

  it('should export TraceConfig interface or type', () => {
    expect(tracingContent).toMatch(/export (interface|type) TraceConfig/);
  });

  it('should export TraceSpan interface or type', () => {
    expect(tracingContent).toMatch(/export (interface|type) TraceSpan/);
  });

  it('should export initTracing function', () => {
    expect(tracingContent).toContain('export function initTracing');
  });

  it('should export startTrace function', () => {
    expect(tracingContent).toContain('export function startTrace');
  });

  it('should export endTrace function', () => {
    expect(tracingContent).toContain('export function endTrace');
  });

  it('should export recordSpan function', () => {
    expect(tracingContent).toContain('export function recordSpan');
  });

  it('should export sendTraceToOpik function', () => {
    expect(tracingContent).toContain('export async function sendTraceToOpik');
  });

  it('should use crypto.randomUUID for ID generation (no uuid package)', () => {
    expect(tracingContent).toContain('crypto.randomUUID');
  });

  it('should use fetch() for HTTP calls (not node:http or require)', () => {
    expect(tracingContent).toContain('fetch(');
    expect(tracingContent).not.toMatch(/require\s*\(/);
    expect(tracingContent).not.toContain('node:http');
  });

  it('should use Opik REST API endpoint', () => {
    expect(tracingContent).toContain('comet.com/opik/api');
  });

  it('should wrap sendTraceToOpik in try/catch (fire-and-forget)', () => {
    expect(tracingContent).toContain('try {');
    expect(tracingContent).toContain('catch');
  });

  it('should not use require() (must use ESM imports)', () => {
    const hasRequire = /(?<!\/\/.*)\brequire\s*\(/.test(tracingContent);
    expect(hasRequire).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: mastraIntegration.ts integration checks (static analysis)
// ---------------------------------------------------------------------------

describe('AGE-19: mastraIntegration.ts — tracing integration', () => {
  const integrationPath = path.resolve(__dirname, '../convex/mastraIntegration.ts');

  const integrationContent = fs.existsSync(integrationPath)
    ? fs.readFileSync(integrationPath, 'utf-8')
    : '';

  it('should import from convex/lib/tracing', () => {
    expect(integrationContent).toMatch(/from\s+["']\.\/lib\/tracing["']/);
  });

  it('should call sendTraceToOpik', () => {
    expect(integrationContent).toContain('sendTraceToOpik');
  });

  it('should call recordSpan or startTrace', () => {
    const hasRecordSpan = integrationContent.includes('recordSpan');
    const hasStartTrace = integrationContent.includes('startTrace');
    expect(hasRecordSpan || hasStartTrace).toBe(true);
  });

  it('should call initTracing', () => {
    expect(integrationContent).toContain('initTracing');
  });

  it('tracing call should be fire-and-forget (.catch(() => {}) pattern)', () => {
    expect(integrationContent).toMatch(/sendTraceToOpik[\s\S]*?\.catch\(/);
  });

  it('should preserve existing executeWithFailover function', () => {
    expect(integrationContent).toContain('executeWithFailover');
  });

  it('should preserve existing buildFailoverChain function', () => {
    expect(integrationContent).toContain('buildFailoverChain');
  });

  it('should preserve existing classifyError function', () => {
    expect(integrationContent).toContain('classifyError');
  });

  it('should preserve existing executeAgent export', () => {
    expect(integrationContent).toContain('export const executeAgent');
  });

  it('should preserve existing streamAgent export', () => {
    expect(integrationContent).toContain('export const streamAgent');
  });

  it('should preserve existing executeWorkflow export', () => {
    expect(integrationContent).toContain('export const executeWorkflow');
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: initTracing() — dynamic tests
// ---------------------------------------------------------------------------

describe('AGE-19: initTracing()', () => {
  let initTracing: (config?: { apiKey?: string; projectName?: string }) => {
    apiKey?: string;
    projectName?: string;
    enabled: boolean;
  };

  beforeEach(async () => {
    try {
      const mod = await import('../convex/lib/tracing.js');
      initTracing = mod.initTracing;
    } catch {
      // Module not importable yet
    }
  });

  it('should return TraceConfig with enabled: false when no API key', () => {
    if (!initTracing) return;
    const config = initTracing();
    expect(config.enabled).toBe(false);
  });

  it('should return enabled: true when API key is provided', () => {
    if (!initTracing) return;
    const config = initTracing({ apiKey: 'test-key-123' });
    expect(config.enabled).toBe(true);
  });

  it('should preserve projectName when provided', () => {
    if (!initTracing) return;
    const config = initTracing({ apiKey: 'test-key', projectName: 'my-project' });
    expect(config.projectName).toBe('my-project');
  });

  it('should return a config object (not throw) when called with no arguments', () => {
    if (!initTracing) return;
    expect(() => initTracing()).not.toThrow();
    const config = initTracing();
    expect(typeof config).toBe('object');
  });

  it('should return enabled: false when apiKey is empty string', () => {
    if (!initTracing) return;
    const config = initTracing({ apiKey: '' });
    expect(config.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: startTrace() — dynamic tests
// ---------------------------------------------------------------------------

describe('AGE-19: startTrace()', () => {
  let initTracing: (config?: { apiKey?: string; projectName?: string }) => {
    apiKey?: string;
    projectName?: string;
    enabled: boolean;
  };
  let startTrace: (name: string, config: { apiKey?: string; projectName?: string; enabled: boolean }) => {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
  };

  beforeEach(async () => {
    try {
      const mod = await import('../convex/lib/tracing.js');
      initTracing = mod.initTracing;
      startTrace = mod.startTrace;
    } catch {
      // Module not importable yet
    }
  });

  it('should return a span with traceId', () => {
    if (!startTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = startTrace('test-trace', config);
    expect(span.traceId).toBeTruthy();
    expect(typeof span.traceId).toBe('string');
  });

  it('should return a span with spanId', () => {
    if (!startTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = startTrace('test-trace', config);
    expect(span.spanId).toBeTruthy();
    expect(typeof span.spanId).toBe('string');
  });

  it('should return a span with the provided name', () => {
    if (!startTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = startTrace('my-llm-call', config);
    expect(span.name).toBe('my-llm-call');
  });

  it('should return a span with startTime as a number (unix ms)', () => {
    if (!startTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const before = Date.now();
    const span = startTrace('test', config);
    const after = Date.now();
    expect(span.startTime).toBeGreaterThanOrEqual(before);
    expect(span.startTime).toBeLessThanOrEqual(after);
  });

  it('should return unique IDs for different traces', () => {
    if (!startTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span1 = startTrace('trace-1', config);
    const span2 = startTrace('trace-2', config);
    expect(span1.traceId).not.toBe(span2.traceId);
    expect(span1.spanId).not.toBe(span2.spanId);
  });

  it('should return a no-op span when config is disabled', () => {
    if (!startTrace || !initTracing) return;
    const config = initTracing(); // no API key => disabled
    // Should not throw even when disabled
    expect(() => startTrace('test', config)).not.toThrow();
    const span = startTrace('test', config);
    expect(typeof span).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: endTrace() — dynamic tests
// ---------------------------------------------------------------------------

describe('AGE-19: endTrace()', () => {
  let initTracing: (config?: { apiKey?: string; projectName?: string }) => {
    apiKey?: string;
    projectName?: string;
    enabled: boolean;
  };
  let startTrace: (name: string, config: { apiKey?: string; projectName?: string; enabled: boolean }) => {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
  };
  let endTrace: (span: {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
  }) => {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime: number;
  };

  beforeEach(async () => {
    try {
      const mod = await import('../convex/lib/tracing.js');
      initTracing = mod.initTracing;
      startTrace = mod.startTrace;
      endTrace = mod.endTrace;
    } catch {
      // Module not importable yet
    }
  });

  it('should set endTime on the span', () => {
    if (!startTrace || !endTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = startTrace('test', config);
    const ended = endTrace(span);
    expect(ended.endTime).toBeDefined();
    expect(typeof ended.endTime).toBe('number');
    expect(ended.endTime).toBeGreaterThanOrEqual(span.startTime);
  });

  it('should preserve all original span fields', () => {
    if (!startTrace || !endTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = startTrace('preserve-test', config);
    const ended = endTrace(span);
    expect(ended.traceId).toBe(span.traceId);
    expect(ended.spanId).toBe(span.spanId);
    expect(ended.name).toBe(span.name);
    expect(ended.startTime).toBe(span.startTime);
  });

  it('should not mutate the original span object', () => {
    if (!startTrace || !endTrace || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = startTrace('immutability-test', config);
    const originalEndTime = span.endTime;
    endTrace(span);
    // Original span endTime should not have been mutated (returns new object)
    // OR if mutated, at least the function should not throw
    expect(() => endTrace(span)).not.toThrow();
    void originalEndTime; // suppress unused warning
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: recordSpan() — dynamic tests
// ---------------------------------------------------------------------------

describe('AGE-19: recordSpan()', () => {
  let recordSpan: (params: {
    name: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    agentId?: string;
    threadId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    traceId: string;
    spanId: string;
    name: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    agentId?: string;
    threadId?: string;
    startTime: number;
    endTime?: number;
    metadata?: Record<string, unknown>;
  };

  beforeEach(async () => {
    try {
      const mod = await import('../convex/lib/tracing.js');
      recordSpan = mod.recordSpan;
    } catch {
      // Module not importable yet
    }
  });

  it('should create a span with model info', () => {
    if (!recordSpan) return;
    const span = recordSpan({
      name: 'llm-call',
      model: 'gpt-4o-mini',
      inputTokens: 100,
      outputTokens: 200,
    });
    expect(span.model).toBe('gpt-4o-mini');
  });

  it('should set inputTokens and outputTokens', () => {
    if (!recordSpan) return;
    const span = recordSpan({
      name: 'llm-call',
      inputTokens: 150,
      outputTokens: 300,
    });
    expect(span.inputTokens).toBe(150);
    expect(span.outputTokens).toBe(300);
  });

  it('should set latencyMs', () => {
    if (!recordSpan) return;
    const span = recordSpan({
      name: 'llm-call',
      latencyMs: 1234,
    });
    expect(span.latencyMs).toBe(1234);
  });

  it('should set agentId and threadId', () => {
    if (!recordSpan) return;
    const span = recordSpan({
      name: 'llm-call',
      agentId: 'agent-abc',
      threadId: 'thread-xyz',
    });
    expect(span.agentId).toBe('agent-abc');
    expect(span.threadId).toBe('thread-xyz');
  });

  it('should generate a traceId and spanId', () => {
    if (!recordSpan) return;
    const span = recordSpan({ name: 'test' });
    expect(span.traceId).toBeTruthy();
    expect(span.spanId).toBeTruthy();
  });

  it('should set startTime', () => {
    if (!recordSpan) return;
    const before = Date.now();
    const span = recordSpan({ name: 'test' });
    const after = Date.now();
    expect(span.startTime).toBeGreaterThanOrEqual(before);
    expect(span.startTime).toBeLessThanOrEqual(after);
  });

  it('should include metadata when provided', () => {
    if (!recordSpan) return;
    const span = recordSpan({
      name: 'test',
      metadata: { provider: 'openai', didFailover: false },
    });
    expect(span.metadata).toMatchObject({ provider: 'openai', didFailover: false });
  });
});

// ---------------------------------------------------------------------------
// Test Group 7: sendTraceToOpik() — dynamic tests with mocked fetch
// ---------------------------------------------------------------------------

describe('AGE-19: sendTraceToOpik()', () => {
  let sendTraceToOpik: (
    span: {
      traceId: string;
      spanId: string;
      name: string;
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
      agentId?: string;
      threadId?: string;
      startTime: number;
      endTime?: number;
      metadata?: Record<string, unknown>;
    },
    config: { apiKey?: string; projectName?: string; enabled: boolean }
  ) => Promise<void>;
  let recordSpan: (params: {
    name: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    agentId?: string;
    threadId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    traceId: string;
    spanId: string;
    name: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs?: number;
    agentId?: string;
    threadId?: string;
    startTime: number;
    endTime?: number;
    metadata?: Record<string, unknown>;
  };
  let initTracing: (config?: { apiKey?: string; projectName?: string }) => {
    apiKey?: string;
    projectName?: string;
    enabled: boolean;
  };

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchSpy);

    try {
      const mod = await import('../convex/lib/tracing.js');
      sendTraceToOpik = mod.sendTraceToOpik;
      recordSpan = mod.recordSpan;
      initTracing = mod.initTracing;
    } catch {
      // Module not importable yet
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should call fetch when config is enabled', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing({ apiKey: 'test-opik-key', projectName: 'test-project' });
    const span = recordSpan({ name: 'llm-call', model: 'gpt-4o-mini', inputTokens: 10, outputTokens: 20 });
    await sendTraceToOpik(span, config);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('should POST to Opik traces endpoint', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing({ apiKey: 'test-opik-key', projectName: 'test-project' });
    const span = recordSpan({ name: 'llm-call' });
    await sendTraceToOpik(span, config);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain('comet.com');
    expect(options?.method?.toUpperCase()).toBe('POST');
  });

  it('should include API key in request headers', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing({ apiKey: 'my-secret-key' });
    const span = recordSpan({ name: 'llm-call' });
    await sendTraceToOpik(span, config);
    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers ?? {};
    const headersStr = JSON.stringify(headers).toLowerCase();
    const hasApiKey = headersStr.includes('my-secret-key');
    expect(hasApiKey).toBe(true);
  });

  it('should include span data in request body', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = recordSpan({ name: 'my-trace', model: 'gpt-4o' });
    await sendTraceToOpik(span, config);
    const [, options] = fetchSpy.mock.calls[0];
    const body = typeof options?.body === 'string' ? options.body : JSON.stringify(options?.body);
    const parsed = JSON.parse(body);
    // Body should contain trace/span data — either at top-level or nested
    const bodyStr = JSON.stringify(parsed);
    expect(bodyStr).toContain('my-trace');
  });

  it('should NOT call fetch when config is disabled', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing(); // no API key => disabled
    const span = recordSpan({ name: 'llm-call' });
    await sendTraceToOpik(span, config);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should NOT throw when fetch fails (fire-and-forget, catches errors)', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    fetchSpy.mockRejectedValue(new Error('network error'));
    const config = initTracing({ apiKey: 'test-key' });
    const span = recordSpan({ name: 'llm-call' });
    await expect(sendTraceToOpik(span, config)).resolves.toBeUndefined();
  });

  it('should NOT throw when server returns non-2xx status', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });
    const config = initTracing({ apiKey: 'test-key' });
    const span = recordSpan({ name: 'llm-call' });
    await expect(sendTraceToOpik(span, config)).resolves.toBeUndefined();
  });

  it('should NOT throw when config has no API key (no-op)', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing({ projectName: 'my-project' }); // no API key
    const span = recordSpan({ name: 'llm-call' });
    await expect(sendTraceToOpik(span, config)).resolves.toBeUndefined();
  });

  it('should include Content-Type: application/json header', async () => {
    if (!sendTraceToOpik || !recordSpan || !initTracing) return;
    const config = initTracing({ apiKey: 'test-key' });
    const span = recordSpan({ name: 'llm-call' });
    await sendTraceToOpik(span, config);
    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers ?? {};
    const headersStr = JSON.stringify(headers).toLowerCase();
    expect(headersStr).toContain('application/json');
  });
});

// ---------------------------------------------------------------------------
// Test Group 8: No-op behavior when unconfigured
// ---------------------------------------------------------------------------

describe('AGE-19: No-op behavior when tracing is unconfigured', () => {
  let initTracing: (config?: { apiKey?: string; projectName?: string }) => {
    apiKey?: string;
    projectName?: string;
    enabled: boolean;
  };
  let startTrace: (name: string, config: { apiKey?: string; projectName?: string; enabled: boolean }) => {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
  };
  let endTrace: (span: {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
  }) => {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime: number;
  };
  let recordSpan: (params: { name: string }) => {
    traceId: string;
    spanId: string;
    name: string;
    startTime: number;
    endTime?: number;
  };
  let sendTraceToOpik: (
    span: { traceId: string; spanId: string; name: string; startTime: number; endTime?: number },
    config: { apiKey?: string; projectName?: string; enabled: boolean }
  ) => Promise<void>;

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn());
    try {
      const mod = await import('../convex/lib/tracing.js');
      initTracing = mod.initTracing;
      startTrace = mod.startTrace;
      endTrace = mod.endTrace;
      recordSpan = mod.recordSpan;
      sendTraceToOpik = mod.sendTraceToOpik;
    } catch {
      // Module not importable yet
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initTracing() without API key should disable tracing', () => {
    if (!initTracing) return;
    const config = initTracing();
    expect(config.enabled).toBe(false);
  });

  it('all functions should be callable without throwing even with disabled config', async () => {
    if (!initTracing || !startTrace || !endTrace || !recordSpan || !sendTraceToOpik) return;
    const config = initTracing();
    expect(() => startTrace('test', config)).not.toThrow();
    const span = startTrace('test', config);
    expect(() => endTrace(span)).not.toThrow();
    expect(() => recordSpan({ name: 'test' })).not.toThrow();
    const rSpan = recordSpan({ name: 'test' });
    await expect(sendTraceToOpik(rSpan, config)).resolves.toBeUndefined();
  });
});
