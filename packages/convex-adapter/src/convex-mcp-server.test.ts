import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvexMCPServer } from './convex-mcp-server.js';
import { z } from 'zod';

// Mock core MCPServer
vi.mock('@agentforge-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@agentforge-ai/core')>('@agentforge-ai/core');
  return actual;
});

function createMockCtx() {
  return {
    runQuery: vi.fn().mockResolvedValue([]),
    runMutation: vi.fn().mockResolvedValue('mut-id'),
    runAction: vi.fn().mockResolvedValue(null),
  };
}

describe('ConvexMCPServer', () => {
  let mockCtx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockCtx();
  });

  // --- Construction ---

  describe('constructor', () => {
    it('should create server with default config', () => {
      const server = new ConvexMCPServer(mockCtx);
      expect(server.name).toBe('agentforge-convex-mcp');
      expect(server.version).toBe('0.1.0');
      expect(server.ctx).toBe(mockCtx);
    });

    it('should create server with custom config', () => {
      const server = new ConvexMCPServer(mockCtx, {
        name: 'custom-server',
        version: '2.0.0',
      });
      expect(server.name).toBe('custom-server');
      expect(server.version).toBe('2.0.0');
    });

    it('should throw if ctx is invalid', () => {
      expect(() => new ConvexMCPServer(null as any)).toThrow(
        'ConvexMCPServer requires a valid Convex ActionCtx.',
      );
    });

    it('should throw if ctx.runQuery is not a function', () => {
      expect(
        () => new ConvexMCPServer({ runQuery: 'nope' } as any),
      ).toThrow('ConvexMCPServer requires a valid Convex ActionCtx.');
    });
  });

  // --- Tool Registration (inherited from MCPServer) ---

  describe('registerTool (inherited)', () => {
    it('should register and list tools', () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'add',
        description: 'Add two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        outputSchema: z.number(),
        handler: async ({ a, b }) => a + b,
      });

      const tools = server.listTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('add');
    });

    it('should throw on duplicate tool name', () => {
      const server = new ConvexMCPServer(mockCtx);
      const tool = {
        name: 'dup',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => null,
      };
      server.registerTool(tool);
      expect(() => server.registerTool(tool)).toThrow(
        "Tool with name 'dup' is already registered.",
      );
    });
  });

  // --- callTool (inherited) ---

  describe('callTool (inherited)', () => {
    it('should invoke a tool and return the result', async () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'multiply',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        outputSchema: z.number(),
        handler: async ({ a, b }) => a * b,
      });

      const result = await server.callTool('multiply', { a: 3, b: 4 });
      expect(result).toBe(12);
    });
  });

  // --- persistTool ---

  describe('persistTool', () => {
    it('should persist a registered tool to in-memory cache', async () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'weather',
        description: 'Get weather',
        inputSchema: z.object({ city: z.string() }),
        outputSchema: z.string(),
        handler: async ({ city }) => `Sunny in ${city}`,
      });

      const tool = server.listTools()[0];
      await server.persistTool(tool);

      expect(server.isToolPersisted('weather')).toBe(true);
      expect(server.getPersistedToolCount()).toBe(1);
    });

    it('should throw if tool has no name', async () => {
      const server = new ConvexMCPServer(mockCtx);
      await expect(server.persistTool(null as any)).rejects.toThrow(
        'persistTool requires a valid tool with a name.',
      );
    });

    it('should throw if tool has empty name', async () => {
      const server = new ConvexMCPServer(mockCtx);
      await expect(
        server.persistTool({ name: '', inputSchema: {}, outputSchema: {} }),
      ).rejects.toThrow('persistTool requires a valid tool with a name.');
    });

    it('should throw if tool is not registered', async () => {
      const server = new ConvexMCPServer(mockCtx);
      await expect(
        server.persistTool({
          name: 'unregistered',
          inputSchema: {},
          outputSchema: {},
        }),
      ).rejects.toThrow(
        "Tool 'unregistered' must be registered via registerTool() before persisting.",
      );
    });

    it('should call persistMutation when configured', async () => {
      const mockMutation = 'skills.create';
      const server = new ConvexMCPServer(mockCtx, {
        persistMutation: mockMutation,
      });

      server.registerTool({
        name: 'persisted-tool',
        description: 'A persisted tool',
        inputSchema: z.object({ x: z.number() }),
        outputSchema: z.number(),
        handler: async ({ x }) => x,
      });

      const tool = server.listTools()[0];
      await server.persistTool(tool);

      expect(mockCtx.runMutation).toHaveBeenCalledWith(
        mockMutation,
        expect.objectContaining({
          name: 'persisted-tool',
          description: 'A persisted tool',
          category: 'mcp-tool',
          isInstalled: true,
          isEnabled: true,
        }),
      );
    });
  });

  // --- loadPersistedTools ---

  describe('loadPersistedTools', () => {
    it('should return empty array when no tools persisted', async () => {
      const server = new ConvexMCPServer(mockCtx);
      const tools = await server.loadPersistedTools();
      expect(tools).toEqual([]);
    });

    it('should return persisted tools from memory', async () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'cached-tool',
        description: 'Cached',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => null,
      });

      const tool = server.listTools()[0];
      await server.persistTool(tool);

      const persisted = await server.loadPersistedTools();
      expect(persisted).toHaveLength(1);
      expect(persisted[0].name).toBe('cached-tool');
      expect(persisted[0].source).toBe('convex-mcp-server');
    });

    it('should load from query when loadQuery is configured', async () => {
      const mockQuery = 'skills.list';
      mockCtx.runQuery.mockResolvedValue([
        {
          name: 'remote-tool',
          displayName: 'Remote Tool',
          description: 'From DB',
          category: 'mcp-tool',
          schema: { type: 'object' },
          createdAt: 1000,
        },
      ]);

      const server = new ConvexMCPServer(mockCtx, { loadQuery: mockQuery });
      const tools = await server.loadPersistedTools();

      expect(mockCtx.runQuery).toHaveBeenCalledWith(mockQuery, {});
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('remote-tool');
      expect(tools[0].description).toBe('From DB');
    });

    it('should handle null response from loadQuery', async () => {
      mockCtx.runQuery.mockResolvedValue(null);
      const server = new ConvexMCPServer(mockCtx, { loadQuery: 'skills.list' });
      const tools = await server.loadPersistedTools();
      expect(tools).toEqual([]);
    });
  });

  // --- isToolPersisted ---

  describe('isToolPersisted', () => {
    it('should return false for non-persisted tools', () => {
      const server = new ConvexMCPServer(mockCtx);
      expect(server.isToolPersisted('nonexistent')).toBe(false);
    });

    it('should return true for persisted tools', async () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'check-tool',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => null,
      });
      await server.persistTool(server.listTools()[0]);
      expect(server.isToolPersisted('check-tool')).toBe(true);
    });
  });

  // --- getPersistedToolCount ---

  describe('getPersistedToolCount', () => {
    it('should return 0 initially', () => {
      const server = new ConvexMCPServer(mockCtx);
      expect(server.getPersistedToolCount()).toBe(0);
    });

    it('should increment after persisting', async () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'tool-1',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => null,
      });
      server.registerTool({
        name: 'tool-2',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => null,
      });

      const tools = server.listTools();
      await server.persistTool(tools[0]);
      expect(server.getPersistedToolCount()).toBe(1);

      await server.persistTool(tools[1]);
      expect(server.getPersistedToolCount()).toBe(2);
    });
  });

  // --- unpersistTool ---

  describe('unpersistTool', () => {
    it('should remove a persisted tool', async () => {
      const server = new ConvexMCPServer(mockCtx);
      server.registerTool({
        name: 'to-remove',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => null,
      });
      await server.persistTool(server.listTools()[0]);

      expect(server.unpersistTool('to-remove')).toBe(true);
      expect(server.isToolPersisted('to-remove')).toBe(false);
      expect(server.getPersistedToolCount()).toBe(0);
    });

    it('should return false for non-persisted tool', () => {
      const server = new ConvexMCPServer(mockCtx);
      expect(server.unpersistTool('nonexistent')).toBe(false);
    });
  });
});
