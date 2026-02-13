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
});
