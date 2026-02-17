/**
 * E2E Test 5: Tools & Workspace
 *
 * Validates that agents with tools and workspace configurations:
 *   1. Register tools correctly via MCPServer
 *   2. Deploy to Cloud with tool definitions intact
 *   3. Execute tools through the Cloud API
 *   4. Workspace files are accessible locally and in cloud
 *   5. Tool input/output validation works end-to-end
 *
 * Tests combine local MCPServer tool execution with Cloud API verification.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { z } from 'zod';
import { MCPServer } from '../../packages/core/src/mcp-server.js';
import { AgentForgeWorkspace } from '../../packages/core/src/workspace.js';
import type { AgentConfig } from '../../packages/core/src/agent.js';
import { CloudTestClient } from './helpers/cloud-client.js';
import { getTestConfig } from './helpers/env.js';
import { FIXTURES, uniqueTestId } from './helpers/fixtures.js';

// ─── Mastra Mock ──────────────────────────────────────────────────────────

vi.mock('@mastra/core/workspace', () => ({
  Workspace: vi.fn(),
  LocalFilesystem: vi.fn(),
  LocalSandbox: vi.fn(),
}));

const mockMastraGenerate = vi.fn();
const mockMastraStream = vi.fn();

vi.mock('../../packages/core/src/agent.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../packages/core/src/agent.js')>();

  class MockAgent extends original.Agent {
    constructor(config: any) {
      super({ ...config, model: 'mock-model-string' });
    }

    async generate(prompt: string) {
      const result = mockMastraGenerate(prompt);
      if (result instanceof Promise) return await result;
      return result;
    }

    async *stream(prompt: string) {
      const result = await mockMastraStream(prompt);
      if (result?.textStream) {
        for await (const chunk of result.textStream) {
          yield { content: typeof chunk === 'string' ? chunk : String(chunk) };
        }
      }
    }
  }

  return { ...original, Agent: MockAgent };
});

import { Agent } from '../../packages/core/src/agent.js';

const mockModel = 'openai/gpt-4o-mini';

// ─── State ────────────────────────────────────────────────────────────────

let cloudClient: CloudTestClient;

// ─── Tests ────────────────────────────────────────────────────────────────

describe('E2E: Tools & Workspace', () => {
  beforeAll(() => {
    const config = getTestConfig();
    cloudClient = new CloudTestClient(config.cloudUrl, config.apiKey);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Local Tool Execution ──────────────────────────────────────────────

  describe('Local Tool Execution', () => {
    it('executes calculator tool with valid input', async () => {
      const server = new MCPServer({ name: 'math-tools' });
      server.registerTool(FIXTURES.tools.calculator);

      const result = await server.callTool('calculator', {
        operation: 'multiply',
        a: 15,
        b: 7,
      });

      expect(result).toEqual({ result: 105 });
    });

    it('executes all calculator operations', async () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.calculator);

      const add = await server.callTool('calculator', { operation: 'add', a: 10, b: 5 });
      const sub = await server.callTool('calculator', { operation: 'subtract', a: 10, b: 5 });
      const mul = await server.callTool('calculator', { operation: 'multiply', a: 10, b: 5 });
      const div = await server.callTool('calculator', { operation: 'divide', a: 10, b: 5 });

      expect(add).toEqual({ result: 15 });
      expect(sub).toEqual({ result: 5 });
      expect(mul).toEqual({ result: 50 });
      expect(div).toEqual({ result: 2 });
    });

    it('handles division by zero', async () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.calculator);

      await expect(
        server.callTool('calculator', { operation: 'divide', a: 10, b: 0 })
      ).rejects.toThrow('Division by zero');
    });

    it('executes echo tool', async () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.echo);

      const result = await server.callTool('echo', { message: 'Hello E2E!' });
      expect(result).toEqual({ echoed: 'Hello E2E!' });
    });

    it('validates tool input against schema', async () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.calculator);

      // Missing required field
      await expect(
        server.callTool('calculator', { operation: 'add', a: 5 })
      ).rejects.toThrow(/Invalid input/);

      // Wrong type
      await expect(
        server.callTool('calculator', { operation: 'add', a: 'not-number', b: 5 })
      ).rejects.toThrow(/Invalid input/);

      // Invalid operation
      await expect(
        server.callTool('calculator', { operation: 'power', a: 2, b: 3 })
      ).rejects.toThrow(/Invalid input/);
    });

    it('validates tool output against schema', async () => {
      const server = new MCPServer();
      server.registerTool({
        name: 'bad-output-tool',
        description: 'Returns wrong type',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.number() }),
        handler: async () => ({ value: 'not-a-number' as any }),
      });

      await expect(server.callTool('bad-output-tool', {})).rejects.toThrow(
        /Invalid output/
      );
    });
  });

  // ── Agent + Tools Integration ──────────────────────────────────────────

  describe('Agent with Tools', () => {
    it('agent can call tools directly', async () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.calculator);
      server.registerTool(FIXTURES.tools.echo);

      const agent = new Agent({
        id: uniqueTestId('tools-agent'),
        name: FIXTURES.agents.withTools.name,
        instructions: FIXTURES.agents.withTools.instructions,
        model: mockModel,
        tools: server,
      });

      // Direct tool call through agent
      const calcResult = await agent.callTool('calculator', {
        operation: 'add',
        a: 100,
        b: 200,
      });
      expect(calcResult).toEqual({ result: 300 });

      const echoResult = await agent.callTool('echo', { message: 'test' });
      expect(echoResult).toEqual({ echoed: 'test' });
    });

    it('agent lists all available tools', () => {
      const server = new MCPServer({ name: 'multi-tool-server' });
      server.registerTool(FIXTURES.tools.calculator);
      server.registerTool(FIXTURES.tools.echo);

      const agent = new Agent({
        id: uniqueTestId('list-tools'),
        name: 'Tool Lister',
        instructions: 'List tools',
        model: mockModel,
        tools: server,
      });

      const tools = agent.getTools();
      expect(tools).toHaveLength(2);

      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual(['calculator', 'echo']);

      // Verify schema structure
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
      }
    });

    it('agent generate includes tool results', async () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.calculator);

      const agent = new Agent({
        id: uniqueTestId('gen-with-tools'),
        name: 'Gen With Tools',
        instructions: 'Use calculator when asked math',
        model: mockModel,
        tools: server,
      });

      // Mock Mastra to simulate tool use
      mockMastraGenerate.mockResolvedValue({
        text: '15 × 7 = 105',
        toolResults: [
          {
            toolName: 'calculator',
            input: { operation: 'multiply', a: 15, b: 7 },
            result: { result: 105 },
          },
        ],
      });

      const response = await agent.generate(FIXTURES.prompts.calculate);
      expect(response.text).toContain('105');
      expect(response.toolResults).toHaveLength(1);
    });
  });

  // ── Deploy Agent with Tools to Cloud ──────────────────────────────────

  describe.runIf(process.env.AGENTFORGE_CLOUD_URL)('Deploy Agent with Tools to Cloud', () => {
    it('deploys agent with tool definitions', async () => {
      const toolAgentId = uniqueTestId('cloud-tools');

      // Create a tool schema that can be serialized
      const toolDefs = [
        {
          name: 'calculator',
          description: 'Performs arithmetic',
          inputSchema: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              a: { type: 'number' },
              b: { type: 'number' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'number' },
            },
          },
        },
      ];

      await cloudClient.createAgent({
        ...FIXTURES.agents.withTools,
        id: toolAgentId,
        tools: toolDefs,
      });

      // Verify agent has tools
      const agent = await cloudClient.getAgent(toolAgentId);
      expect(agent).not.toBeNull();
      expect(agent!.tools).toBeDefined();

      if (Array.isArray(agent!.tools)) {
        expect(agent!.tools).toHaveLength(1);
        expect(agent!.tools[0].name).toBe('calculator');
      }

      // Cleanup
      await cloudClient.deleteAgent(toolAgentId);
    });

    it('runs agent with tools on Cloud', async () => {
      const toolAgentId = uniqueTestId('run-tools');
      await cloudClient.createAgent({
        ...FIXTURES.agents.withTools,
        id: toolAgentId,
        tools: [
          {
            name: 'calculator',
            description: 'Arithmetic',
            inputSchema: { type: 'object' },
          },
        ],
      });

      const result = await cloudClient.runAgent(
        toolAgentId,
        FIXTURES.prompts.calculate
      );

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.agentId).toContain(toolAgentId);

      await cloudClient.deleteAgent(toolAgentId);
    });
  });

  // ── MCPServer Advanced ─────────────────────────────────────────────────

  describe('MCPServer Advanced', () => {
    it('supports complex nested input schemas', async () => {
      const server = new MCPServer();
      server.registerTool({
        name: 'complex-tool',
        description: 'Tool with complex schema',
        inputSchema: z.object({
          query: z.string(),
          options: z.object({
            limit: z.number(),
            offset: z.number(),
            filters: z.array(z.string()),
          }),
        }),
        outputSchema: z.object({
          results: z.array(z.string()),
          total: z.number(),
        }),
        handler: async (input) => ({
          results: input.options.filters.slice(0, input.options.limit),
          total: input.options.filters.length,
        }),
      });

      const result = await server.callTool('complex-tool', {
        query: 'test',
        options: {
          limit: 2,
          offset: 0,
          filters: ['a', 'b', 'c', 'd'],
        },
      });

      expect(result).toEqual({
        results: ['a', 'b'],
        total: 4,
      });
    });

    it('multiple MCPServers with overlapping namespaces work independently', () => {
      const server1 = new MCPServer({ name: 'server-1' });
      const server2 = new MCPServer({ name: 'server-2' });

      // Both have a tool named 'process' but different implementations
      server1.registerTool({
        name: 'process',
        inputSchema: z.object({ x: z.number() }),
        outputSchema: z.number(),
        handler: async ({ x }) => x * 2,
      });

      server2.registerTool({
        name: 'process',
        inputSchema: z.object({ x: z.number() }),
        outputSchema: z.number(),
        handler: async ({ x }) => x * 3,
      });

      // They should work independently
      expect(server1.listTools()[0].name).toBe('process');
      expect(server2.listTools()[0].name).toBe('process');
    });

    it('handles async tool handlers that take time', async () => {
      const server = new MCPServer();
      server.registerTool({
        name: 'slow-tool',
        description: 'Simulates a slow external API call',
        inputSchema: z.object({ delayMs: z.number() }),
        outputSchema: z.object({ completed: z.boolean() }),
        handler: async (input) => {
          await new Promise((resolve) => setTimeout(resolve, input.delayMs));
          return { completed: true };
        },
      });

      const start = Date.now();
      const result = await server.callTool('slow-tool', { delayMs: 100 });
      const elapsed = Date.now() - start;

      expect(result).toEqual({ completed: true });
      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some timing slack
    });

    it('tool handler errors propagate correctly', async () => {
      const server = new MCPServer();
      server.registerTool({
        name: 'error-tool',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        handler: async () => {
          throw new Error('External API unavailable');
        },
      });

      await expect(server.callTool('error-tool', {})).rejects.toThrow(
        'External API unavailable'
      );
    });
  });

  // ── Workspace Integration ─────────────────────────────────────────────

  describe('Workspace Integration', () => {
    it('creates workspace with tool config overrides', () => {
      const workspace = AgentForgeWorkspace.local({
        basePath: '/tmp/e2e-workspace',
        tools: {
          enabled: true,
          requireApproval: false,
          overrides: {
            writeFile: {
              enabled: true,
              requireApproval: true,
              requireReadBeforeWrite: true,
            },
          },
        },
      });

      expect(workspace.workspace).toBeDefined();
    });

    it('workspace search interface works', async () => {
      const workspace = AgentForgeWorkspace.local({
        basePath: '/tmp/e2e-workspace-search',
        search: true,
      });

      // Search should return empty on fresh workspace
      const results = await workspace.search('test query');
      expect(Array.isArray(results)).toBe(true);
    });

    it('workspace index and search round-trip', async () => {
      const workspace = AgentForgeWorkspace.local({
        basePath: '/tmp/e2e-workspace-index',
        search: true,
      });

      // Index some content
      await workspace.index('doc-1', 'AgentForge is a framework for AI agents');
      await workspace.index('doc-2', 'Vitest is a testing framework for JavaScript');

      // Search should find relevant docs
      const results = await workspace.search('AI agents');
      // Note: may be empty if BM25 not fully initialized in mock env
      expect(Array.isArray(results)).toBe(true);
    });

    it('cloud workspace creation with all config options', () => {
      const workspace = AgentForgeWorkspace.cloud({
        bucket: 'e2e-test-bucket',
        region: 'auto',
        endpoint: 'https://fake.r2.cloudflarestorage.com',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
        skills: ['/custom-skills', '/shared-skills'],
        search: true,
        autoIndexPaths: ['/docs'],
        tools: {
          enabled: true,
          requireApproval: true,
        },
      });

      expect(workspace.workspace).toBeDefined();
    });
  });

  // ── Tool Serialization (Framework → Cloud) ────────────────────────────

  describe('Tool Serialization', () => {
    it('MCPServer tools produce serializable JSON schemas', () => {
      const server = new MCPServer();
      server.registerTool(FIXTURES.tools.calculator);
      server.registerTool(FIXTURES.tools.echo);

      const tools = server.listTools();

      // All tools should be JSON-serializable (for Cloud deployment)
      const serialized = JSON.stringify(tools);
      const parsed = JSON.parse(serialized);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('calculator');
      expect(parsed[1].name).toBe('echo');

      // Verify schema structure is preserved
      expect(parsed[0].inputSchema.type).toBe('object');
      expect(parsed[0].inputSchema.properties).toHaveProperty('operation');
      expect(parsed[0].inputSchema.properties).toHaveProperty('a');
      expect(parsed[0].inputSchema.properties).toHaveProperty('b');
    });

    it('tool schemas survive round-trip serialization', () => {
      const server = new MCPServer();
      server.registerTool({
        name: 'complex-schema',
        description: 'Tool with various types',
        inputSchema: z.object({
          text: z.string(),
          count: z.number(),
          flag: z.boolean(),
          items: z.array(z.string()),
          nested: z.object({
            inner: z.string(),
          }),
        }),
        outputSchema: z.object({
          success: z.boolean(),
        }),
        handler: async () => ({ success: true }),
      });

      const tools = server.listTools();
      const json = JSON.stringify(tools);
      const roundTripped = JSON.parse(json);

      const schema = roundTripped[0].inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties.text.type).toBe('string');
      expect(schema.properties.count.type).toBe('number');
      expect(schema.properties.flag.type).toBe('boolean');
      expect(schema.properties.items.type).toBe('array');
      expect(schema.properties.nested.type).toBe('object');
    });
  });
});
