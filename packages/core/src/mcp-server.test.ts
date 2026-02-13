import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { MCPServer, Tool } from './mcp-server';

describe('MCPServer', () => {
  let server: MCPServer;

  const addTool: Tool<z.ZodObject<{ a: z.ZodNumber; b: z.ZodNumber }>, z.ZodNumber> = {
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    outputSchema: z.number(),
    handler: async ({ a, b }) => a + b,
  };

  beforeEach(() => {
    server = new MCPServer();
  });

  it('should create a server with default config', () => {
    expect(server.name).toBe('agentforge-mcp');
    expect(server.version).toBe('0.0.0');
  });

  it('should create a server with custom config', () => {
    const custom = new MCPServer({ name: 'my-server', version: '1.0.0' });
    expect(custom.name).toBe('my-server');
    expect(custom.version).toBe('1.0.0');
  });

  it('should register a new tool', () => {
    server.registerTool(addTool);
    const tools = server.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('add');
  });

  it('should throw when registering a duplicate tool name', () => {
    server.registerTool(addTool);
    expect(() => server.registerTool(addTool)).toThrow(
      "Tool with name 'add' is already registered."
    );
  });

  it('listTools should return all registered tools with schemas', () => {
    server.registerTool(addTool);

    const subtractTool: Tool<z.ZodObject<{ a: z.ZodNumber; b: z.ZodNumber }>, z.ZodNumber> = {
      name: 'subtract',
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      outputSchema: z.number(),
      handler: async ({ a, b }) => a - b,
    };
    server.registerTool(subtractTool);

    const tools = server.listTools();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(['add', 'subtract']);
    expect(tools[0].inputSchema).toHaveProperty('type', 'object');
    expect(tools[0].inputSchema).toHaveProperty('properties');
  });

  it('callTool should invoke the correct tool and return the result', async () => {
    server.registerTool(addTool);
    const result = await server.callTool('add', { a: 5, b: 3 });
    expect(result).toBe(8);
  });

  it('callTool should handle invalid tool names', async () => {
    await expect(server.callTool('nonexistent', {})).rejects.toThrow(
      "Tool with name 'nonexistent' not found."
    );
  });

  it('callTool should handle invalid input for a tool', async () => {
    server.registerTool(addTool);
    await expect(server.callTool('add', { a: 5 })).rejects.toThrow(
      "Invalid input for tool 'add':"
    );
  });

  it('callTool should handle invalid input types', async () => {
    server.registerTool(addTool);
    await expect(server.callTool('add', { a: 'not-a-number', b: 3 })).rejects.toThrow(
      "Invalid input for tool 'add':"
    );
  });

  it('should return empty list when no tools registered', () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(0);
    expect(tools).toEqual([]);
  });

  it('callTool should throw when output validation fails', async () => {
    const strictTool: Tool<z.ZodObject<{ x: z.ZodNumber }>, z.ZodString> = {
      name: 'strict',
      description: 'Returns a string',
      inputSchema: z.object({ x: z.number() }),
      outputSchema: z.string(),
      handler: async () => 42 as unknown as string, // intentionally wrong output
    };
    server.registerTool(strictTool);
    await expect(server.callTool('strict', { x: 1 })).rejects.toThrow(
      "Invalid output from tool 'strict':"
    );
  });

  describe('zodToJsonSchema coverage', () => {
    it('should handle string input schemas', () => {
      const tool: Tool<z.ZodString, z.ZodString> = {
        name: 'echo',
        inputSchema: z.string(),
        outputSchema: z.string(),
        handler: async (input) => input,
      };
      server.registerTool(tool);
      const tools = server.listTools();
      expect(tools[0].inputSchema).toEqual({ type: 'string' });
      expect(tools[0].outputSchema).toEqual({ type: 'string' });
    });

    it('should handle boolean schemas', () => {
      const tool: Tool<z.ZodBoolean, z.ZodBoolean> = {
        name: 'toggle',
        inputSchema: z.boolean(),
        outputSchema: z.boolean(),
        handler: async (input) => !input,
      };
      server.registerTool(tool);
      const tools = server.listTools();
      expect(tools[0].inputSchema).toEqual({ type: 'boolean' });
    });

    it('should handle array schemas', () => {
      const tool: Tool<z.ZodArray<z.ZodNumber>, z.ZodNumber> = {
        name: 'sum',
        inputSchema: z.array(z.number()),
        outputSchema: z.number(),
        handler: async (input) => input.reduce((a: number, b: number) => a + b, 0),
      };
      server.registerTool(tool);
      const tools = server.listTools();
      expect(tools[0].inputSchema).toEqual({ type: 'array' });
    });

    it('should handle unknown/unsupported schemas', () => {
      const tool: Tool<z.ZodAny, z.ZodAny> = {
        name: 'any',
        inputSchema: z.any(),
        outputSchema: z.any(),
        handler: async (input) => input,
      };
      server.registerTool(tool);
      const tools = server.listTools();
      expect(tools[0].inputSchema).toEqual({ type: 'unknown' });
    });

    it('should handle nested object schemas', () => {
      const tool: Tool<z.ZodObject<{ nested: z.ZodObject<{ value: z.ZodString }> }>, z.ZodAny> = {
        name: 'nested',
        inputSchema: z.object({ nested: z.object({ value: z.string() }) }),
        outputSchema: z.any(),
        handler: async (input) => input,
      };
      server.registerTool(tool);
      const tools = server.listTools();
      expect(tools[0].inputSchema).toEqual({
        type: 'object',
        properties: { nested: { type: 'object' } },
      });
    });
  });
});
