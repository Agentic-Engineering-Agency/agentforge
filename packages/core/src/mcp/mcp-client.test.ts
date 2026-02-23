import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MCPClient,
  mcpTransportConfigSchema,
  type MCPTransport,
  type MCPJsonRpcRequest,
  type MCPJsonRpcResponse,
  type MCPJsonRpcNotification,
  type MCPClientConfig,
  type MCPToolDefinition,
  type MCPResourceDefinition,
  type MCPPromptDefinition,
  type MCPToolResult,
  type MCPResourceContent,
  type MCPPromptMessage,
} from './mcp-client.js';

// === Mock Transport ===

function createMockTransport(overrides?: Partial<MCPTransport>): MCPTransport {
  let connected = false;
  let notificationHandler: ((n: MCPJsonRpcNotification) => void) | undefined;

  return {
    connect: vi.fn(async () => {
      connected = true;
    }),
    disconnect: vi.fn(async () => {
      connected = false;
    }),
    send: vi.fn(async (msg: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> => {
      if (msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'test-server', version: '1.0.0' },
            capabilities: { tools: {}, resources: {}, prompts: {} },
          },
        };
      }
      return { jsonrpc: '2.0', id: msg.id, result: {} };
    }),
    onNotification: vi.fn((handler: (n: MCPJsonRpcNotification) => void) => {
      notificationHandler = handler;
    }),
    isConnected: vi.fn(() => connected),
    // Expose handler for test use
    get _notificationHandler() {
      return notificationHandler;
    },
    ...overrides,
  };
}

function createClientWithMock(
  transportOverrides?: Partial<MCPTransport>,
  configOverrides?: Partial<MCPClientConfig>,
) {
  const transport = createMockTransport(transportOverrides);

  // We need to intercept the transport creation inside MCPClient.
  // Since MCPClient internally creates transport from config, we mock at the module level.
  // Instead, test via the public API with real transport configs + mock fetch.

  // For unit testing, we test the schemas and protocol logic directly.
  return { transport };
}

// === Schema Validation Tests ===

describe('MCPTransportConfig Schema', () => {
  describe('stdio transport', () => {
    it('accepts valid stdio config', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts stdio config with env and cwd', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'stdio',
        command: 'python',
        args: ['-m', 'mcp_server'],
        env: { PATH: '/usr/bin' },
        cwd: '/tmp',
      });
      expect(result.success).toBe(true);
    });

    it('rejects stdio config without command', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'stdio',
      });
      expect(result.success).toBe(false);
    });

    it('rejects stdio config with non-string command', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'stdio',
        command: 123,
      });
      expect(result.success).toBe(false);
    });

    it('rejects stdio config with invalid args type', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'stdio',
        command: 'node',
        args: 'not-an-array',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('http transport', () => {
    it('accepts valid http config', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'http',
        url: 'https://example.com/mcp',
      });
      expect(result.success).toBe(true);
    });

    it('accepts http config with headers and timeout', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'http',
        url: 'https://example.com/mcp',
        headers: { Authorization: 'Bearer token' },
        timeout: 5000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects http config without url', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'http',
      });
      expect(result.success).toBe(false);
    });

    it('rejects http config with invalid url', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'http',
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects http config with non-positive timeout', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'http',
        url: 'https://example.com/mcp',
        timeout: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects http config with zero timeout', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'http',
        url: 'https://example.com/mcp',
        timeout: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sse transport', () => {
    it('accepts valid sse config', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
        url: 'https://example.com/sse',
      });
      expect(result.success).toBe(true);
    });

    it('accepts sse config with all options', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
        url: 'https://example.com/sse',
        headers: { 'X-API-Key': 'key123' },
        reconnectInterval: 5000,
        maxReconnectAttempts: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects sse config without url', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
      });
      expect(result.success).toBe(false);
    });

    it('rejects sse config with invalid url', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
        url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects sse config with negative reconnectInterval', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
        url: 'https://example.com/sse',
        reconnectInterval: -100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects sse config with negative maxReconnectAttempts', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
        url: 'https://example.com/sse',
        maxReconnectAttempts: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('discriminated union', () => {
    it('rejects unknown transport type', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'websocket',
        url: 'ws://example.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty object', () => {
      const result = mcpTransportConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

// === MCPClient Tests (with mocked fetch for HTTP transport) ===

describe('MCPClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockFetchResponse(result: unknown, id?: string | number) {
    return vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: id ?? body.id,
          result,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
  }

  function createHttpClient(config?: Partial<MCPClientConfig>): MCPClient {
    return new MCPClient({
      transport: { type: 'http', url: 'https://mcp.test/rpc' },
      requestTimeout: 5000,
      ...config,
    });
  }

  describe('connect() / disconnect()', () => {
    it('connects successfully with HTTP transport', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      await client.connect();

      expect(client.getState()).toBe('connected');
      expect(client.getServerInfo()).toEqual({ name: 'test-server', version: '1.0.0' });
    });

    it('emits connected event on successful connect', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test-server', version: '2.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      const events: unknown[] = [];
      client.on((e) => events.push(e));

      await client.connect();

      expect(events).toContainEqual({
        type: 'connected',
        serverInfo: { name: 'test-server', version: '2.0.0' },
      });
    });

    it('disconnects and resets state', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      await client.connect();
      await client.disconnect();

      expect(client.getState()).toBe('disconnected');
      expect(client.getServerInfo()).toBeNull();
    });

    it('emits disconnected event on disconnect', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      await client.connect();

      const events: unknown[] = [];
      client.on((e) => events.push(e));
      await client.disconnect();

      expect(events).toContainEqual(expect.objectContaining({ type: 'disconnected' }));
    });

    it('is a no-op if already connected', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test-server', version: '1.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      await client.connect();
      await client.connect(); // second call is a no-op

      expect(client.getState()).toBe('connected');
    });

    it('sets state to error on connection failure', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'));

      const client = createHttpClient();
      await expect(client.connect()).rejects.toThrow('Connection refused');
      expect(client.getState()).toBe('error');
    });

    it('emits error event on connection failure', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'));

      const client = createHttpClient();
      const events: unknown[] = [];
      client.on((e) => events.push(e));

      await expect(client.connect()).rejects.toThrow();
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'error' }),
      );
    });
  });

  describe('listTools()', () => {
    it('returns array of MCPToolDefinition', async () => {
      const tools: MCPToolDefinition[] = [
        { name: 'read_file', description: 'Read a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
        { name: 'write_file', description: 'Write a file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
      ];

      let callCount = 0;
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        callCount++;
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'test', version: '1.0.0' },
                capabilities: {},
              },
            }),
            { status: 200 },
          );
        }
        // tools/list or notifications/initialized
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools } }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      const result = await client.listTools();

      expect(result).toEqual(tools);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when server has no tools', async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'test', version: '1.0.0' },
                capabilities: {},
              },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools: [] } }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      const result = await client.listTools();

      expect(result).toEqual([]);
    });
  });

  describe('callTool()', () => {
    function setupConnectedClient() {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2024-11-05',
                serverInfo: { name: 'test', version: '1.0.0' },
                capabilities: {},
              },
            }),
            { status: 200 },
          );
        }

        if (body.method === 'tools/call') {
          const toolResult: MCPToolResult = {
            content: [{ type: 'text', text: `Result for ${body.params.name}` }],
          };
          return new Response(
            JSON.stringify({ jsonrpc: '2.0', id: body.id, result: toolResult }),
            { status: 200 },
          );
        }

        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }),
          { status: 200 },
        );
      });
    }

    it('calls the right protocol message with tool name and args', async () => {
      setupConnectedClient();

      const client = createHttpClient();
      await client.connect();
      const result = await client.callTool('read_file', { path: '/tmp/test.txt' });

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Result for read_file' }],
      });

      // Verify the request was made with correct method
      const calls = fetchMock.mock.calls;
      const toolCall = calls.find((c: unknown[]) => {
        const body = JSON.parse(c[1]?.body as string);
        return body.method === 'tools/call';
      });
      expect(toolCall).toBeDefined();
      const toolBody = JSON.parse(toolCall![1]?.body as string);
      expect(toolBody.params.name).toBe('read_file');
      expect(toolBody.params.arguments).toEqual({ path: '/tmp/test.txt' });
    });

    it('sends empty arguments when none provided', async () => {
      setupConnectedClient();

      const client = createHttpClient();
      await client.connect();
      await client.callTool('ping');

      const calls = fetchMock.mock.calls;
      const toolCall = calls.find((c: unknown[]) => {
        const body = JSON.parse(c[1]?.body as string);
        return body.method === 'tools/call';
      });
      const toolBody = JSON.parse(toolCall![1]?.body as string);
      expect(toolBody.params.arguments).toEqual({});
    });
  });

  describe('listResources()', () => {
    it('returns array of MCPResourceDefinition', async () => {
      const resources: MCPResourceDefinition[] = [
        { uri: 'file:///tmp/config.json', name: 'config', description: 'Config file', mimeType: 'application/json' },
      ];

      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { resources } }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      const result = await client.listResources();

      expect(result).toEqual(resources);
    });
  });

  describe('readResource()', () => {
    it('reads resource by URI', async () => {
      const contents: MCPResourceContent[] = [
        { uri: 'file:///tmp/data.txt', mimeType: 'text/plain', text: 'hello world' },
      ];

      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { contents } }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      const result = await client.readResource('file:///tmp/data.txt');

      expect(result).toEqual(contents);
    });
  });

  describe('listPrompts()', () => {
    it('returns array of MCPPromptDefinition', async () => {
      const prompts: MCPPromptDefinition[] = [
        { name: 'summarize', description: 'Summarize text', arguments: [{ name: 'text', required: true }] },
      ];

      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { prompts } }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      const result = await client.listPrompts();

      expect(result).toEqual(prompts);
    });
  });

  describe('getPrompt()', () => {
    it('returns prompt messages', async () => {
      const messages: MCPPromptMessage[] = [
        { role: 'user', content: { type: 'text', text: 'Summarize: hello world' } },
      ];

      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { messages } }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      const result = await client.getPrompt('summarize', { text: 'hello world' });

      expect(result).toEqual(messages);
    });
  });

  describe('error handling', () => {
    it('throws on protocol error from server', async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32601, message: 'Method not found' },
          }),
          { status: 200 },
        );
      });

      const client = createHttpClient();
      await client.connect();
      await expect(client.listTools()).rejects.toThrow('MCP error -32601: Method not found');
    });

    it('throws on HTTP error response', async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
      });

      const client = createHttpClient();
      await client.connect();
      await expect(client.listTools()).rejects.toThrow('HTTP request failed: 500');
    });

    it('throws on request timeout', async () => {
      fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        if (body.method === 'initialize') {
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0', id: body.id,
              result: { protocolVersion: '2024-11-05', serverInfo: { name: 'test', version: '1.0.0' }, capabilities: {} },
            }),
            { status: 200 },
          );
        }
        // Simulate timeout - never resolve
        return new Promise(() => {});
      });

      const client = createHttpClient({ requestTimeout: 100 });
      await client.connect();
      await expect(client.listTools()).rejects.toThrow(/timed out/);
    });

    it('rejects invalid transport config in constructor', () => {
      expect(() => {
        new MCPClient({
          transport: { type: 'invalid' } as any,
        });
      }).toThrow();
    });
  });

  describe('event system', () => {
    it('on() returns unsubscribe function', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test', version: '1.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      const events: unknown[] = [];
      const unsub = client.on((e) => events.push(e));

      await client.connect();
      expect(events.length).toBeGreaterThan(0);

      unsub();
      const countBefore = events.length;
      await client.disconnect();
      // After unsubscribe, should not receive more events
      expect(events.length).toBe(countBefore);
    });

    it('swallows errors thrown by event handlers', async () => {
      fetchMock.mockImplementation(
        mockFetchResponse({
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test', version: '1.0.0' },
          capabilities: {},
        }),
      );

      const client = createHttpClient();
      client.on(() => {
        throw new Error('handler error');
      });

      // Should not throw
      await expect(client.connect()).resolves.toBeUndefined();
    });
  });

  describe('SSE transport config', () => {
    it('accepts zero for maxReconnectAttempts', () => {
      const result = mcpTransportConfigSchema.safeParse({
        type: 'sse',
        url: 'https://example.com/sse',
        maxReconnectAttempts: 0,
      });
      expect(result.success).toBe(true);
    });
  });
});
