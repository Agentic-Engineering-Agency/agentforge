import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPDynamicToolLoader, jsonSchemaToZod } from './mcp-dynamic-tools.js';
import type { MCPClient, MCPToolDefinition, MCPToolResult } from './mcp-client.js';
import { z } from 'zod';

// === Mock MCPClient ===

function createMockClient(tools: MCPToolDefinition[] = []): MCPClient {
  return {
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async (name: string, args?: Record<string, unknown>): Promise<MCPToolResult> => {
      return {
        content: [{ type: 'text', text: `Called ${name} with ${JSON.stringify(args)}` }],
      };
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getState: vi.fn(() => 'connected' as const),
    getServerInfo: vi.fn(() => ({ name: 'mock', version: '1.0.0' })),
    listResources: vi.fn(async () => []),
    readResource: vi.fn(async () => []),
    listPrompts: vi.fn(async () => []),
    getPrompt: vi.fn(async () => []),
    on: vi.fn(() => () => {}),
  } as unknown as MCPClient;
}

const sampleTools: MCPToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read a file from disk',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_dir',
    description: 'List directory contents',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        recursive: { type: 'boolean' },
      },
      required: ['path'],
    },
  },
];

// === jsonSchemaToZod Tests ===

describe('jsonSchemaToZod', () => {
  it('converts string type', () => {
    const schema = jsonSchemaToZod({ type: 'string' });
    expect(schema.safeParse('hello').success).toBe(true);
    expect(schema.safeParse(123).success).toBe(false);
  });

  it('converts number type', () => {
    const schema = jsonSchemaToZod({ type: 'number' });
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse('not-a-number').success).toBe(false);
  });

  it('converts integer as number', () => {
    const schema = jsonSchemaToZod({ type: 'integer' });
    expect(schema.safeParse(42).success).toBe(true);
  });

  it('converts boolean type', () => {
    const schema = jsonSchemaToZod({ type: 'boolean' });
    expect(schema.safeParse(true).success).toBe(true);
    expect(schema.safeParse('true').success).toBe(false);
  });

  it('converts object with required and optional properties', () => {
    const schema = jsonSchemaToZod({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    });
    expect(schema.safeParse({ name: 'Alice' }).success).toBe(true);
    expect(schema.safeParse({ name: 'Alice', age: 30 }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false); // missing required 'name'
  });

  it('converts empty object schema', () => {
    const schema = jsonSchemaToZod({ type: 'object' });
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('converts array type', () => {
    const schema = jsonSchemaToZod({ type: 'array', items: { type: 'string' } });
    expect(schema.safeParse(['a', 'b']).success).toBe(true);
    expect(schema.safeParse([1, 2]).success).toBe(false);
  });

  it('returns z.unknown() for unrecognized type', () => {
    const schema = jsonSchemaToZod({ type: 'custom' });
    expect(schema.safeParse('anything').success).toBe(true);
    expect(schema.safeParse(42).success).toBe(true);
  });
});

// === MCPDynamicToolLoader Tests ===

describe('MCPDynamicToolLoader', () => {
  let loader: MCPDynamicToolLoader;

  beforeEach(() => {
    loader = new MCPDynamicToolLoader();
  });

  afterEach(() => {
    loader.unloadTools();
  });

  describe('loadTools()', () => {
    it('wraps each MCP tool as a Mastra-compatible tool', async () => {
      const client = createMockClient(sampleTools);
      const tools = await loader.loadTools(client);

      expect(Object.keys(tools)).toEqual(['read_file', 'write_file', 'list_dir']);
      expect(client.listTools).toHaveBeenCalledOnce();
    });

    it('each tool has id, description, and execute', async () => {
      const client = createMockClient(sampleTools);
      const tools = await loader.loadTools(client);

      const readFile = tools['read_file'];
      expect(readFile).toBeDefined();
      expect(readFile.id).toBe('mcp_read_file');
      expect(readFile.description).toBe('Read a file from disk');
      expect(typeof readFile.execute).toBe('function');
    });

    it('returns empty record when server has no tools', async () => {
      const client = createMockClient([]);
      const tools = await loader.loadTools(client);

      expect(Object.keys(tools)).toHaveLength(0);
    });

    it('handles tools without inputSchema', async () => {
      const client = createMockClient([
        { name: 'ping', inputSchema: {} },
      ]);
      const tools = await loader.loadTools(client);

      expect(tools['ping']).toBeDefined();
    });
  });

  describe('tool execute()', () => {
    it('delegates to MCPClient.callTool with correct name', async () => {
      const client = createMockClient(sampleTools);
      const tools = await loader.loadTools(client);

      const result = await tools['read_file'].execute({ path: '/tmp/test.txt' });

      expect(client.callTool).toHaveBeenCalledWith('read_file', { path: '/tmp/test.txt' });
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Called read_file with {"path":"/tmp/test.txt"}' }],
      });
    });

    it('delegates with multiple arguments', async () => {
      const client = createMockClient(sampleTools);
      const tools = await loader.loadTools(client);

      await tools['write_file'].execute({ path: '/tmp/out.txt', content: 'hello' });

      expect(client.callTool).toHaveBeenCalledWith('write_file', {
        path: '/tmp/out.txt',
        content: 'hello',
      });
    });

    it('propagates errors from callTool', async () => {
      const client = createMockClient(sampleTools);
      (client.callTool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Tool execution failed'),
      );

      const tools = await loader.loadTools(client);
      await expect(
        tools['read_file'].execute({ path: '/tmp/test.txt' }),
      ).rejects.toThrow('Tool execution failed');
    });
  });

  describe('watchTools()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('detects new tools on refresh', async () => {
      const initialTools = [sampleTools[0]];
      const updatedTools = [...sampleTools];

      let callCount = 0;
      const client = createMockClient(initialTools);
      (client.listTools as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? initialTools : updatedTools;
      });

      await loader.loadTools(client);

      const onUpdate = vi.fn();
      loader.watchTools(client, onUpdate, 1000);

      await vi.advanceTimersByTimeAsync(1000);

      expect(onUpdate).toHaveBeenCalledOnce();
      const updatedToolRecord = onUpdate.mock.calls[0][0];
      expect(Object.keys(updatedToolRecord)).toEqual(['read_file', 'write_file', 'list_dir']);
    });

    it('does not trigger onUpdate when tool list is unchanged', async () => {
      const client = createMockClient(sampleTools);

      await loader.loadTools(client);

      const onUpdate = vi.fn();
      loader.watchTools(client, onUpdate, 1000);

      await vi.advanceTimersByTimeAsync(3000);

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('detects tool removal', async () => {
      let callCount = 0;
      const client = createMockClient(sampleTools);
      (client.listTools as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return callCount === 1 ? sampleTools : [sampleTools[0]];
      });

      await loader.loadTools(client);

      const onUpdate = vi.fn();
      loader.watchTools(client, onUpdate, 1000);

      await vi.advanceTimersByTimeAsync(1000);

      expect(onUpdate).toHaveBeenCalledOnce();
      const updatedToolRecord = onUpdate.mock.calls[0][0];
      expect(Object.keys(updatedToolRecord)).toEqual(['read_file']);
    });

    it('silently handles errors during polling', async () => {
      const client = createMockClient(sampleTools);
      await loader.loadTools(client);

      (client.listTools as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const onUpdate = vi.fn();
      loader.watchTools(client, onUpdate, 1000);

      // Should not throw
      await vi.advanceTimersByTimeAsync(1000);
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('unloadTools()', () => {
    it('clears all loaded tools', async () => {
      const client = createMockClient(sampleTools);
      await loader.loadTools(client);

      expect(Object.keys(loader.getTools())).toHaveLength(3);

      loader.unloadTools();
      expect(Object.keys(loader.getTools())).toHaveLength(0);
    });

    it('stops watching', async () => {
      vi.useFakeTimers();

      const client = createMockClient(sampleTools);
      await loader.loadTools(client);

      const onUpdate = vi.fn();
      loader.watchTools(client, onUpdate, 1000);
      loader.unloadTools();

      // Change tool list
      (client.listTools as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await vi.advanceTimersByTimeAsync(3000);
      expect(onUpdate).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('can be called multiple times safely', () => {
      expect(() => {
        loader.unloadTools();
        loader.unloadTools();
      }).not.toThrow();
    });
  });

  describe('getTools()', () => {
    it('returns copy of tools record', async () => {
      const client = createMockClient(sampleTools);
      await loader.loadTools(client);

      const tools1 = loader.getTools();
      const tools2 = loader.getTools();
      expect(tools1).toEqual(tools2);
      expect(tools1).not.toBe(tools2); // different references
    });
  });
});
