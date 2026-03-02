import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, details, success, error, info, formatDate } from '../lib/display.js';
import { MCPExecutor } from '@agentforge-ai/core';
import * as readline from 'node:readline';
import type { FunctionReference } from 'convex/server';

// Helper to create a FunctionReference from a string identifier
function mutationRef(name: string): FunctionReference<'mutation'> {
  return name as any;
}

function queryRef(name: string): FunctionReference<'query'> {
  return name as any;
}

// Type definitions for Convex functions
type MCPConnectionFunctionNames = {
  'mcpConnections:list': { args: {} };
  'mcpConnections:create': { args: { name: string; serverUrl: string; protocol: string } };
  'mcpConnections:remove': { args: { id: string } };
  'mcpConnections:update': { args: { id: string; isEnabled: boolean } };
  'mcpConnections:updateStatus': { args: { id: string; isConnected: boolean } };
  'mcpConnections:executeToolCall': { args: { id: string; toolName: string; toolArgs: Record<string, unknown> } };
};

// Type definition for MCP connection (as returned from Convex)
interface MCPConnection {
  _id: string;
  name: string;
  protocol: 'stdio' | 'sse' | 'http';
  serverUrl: string;
  isConnected: boolean;
  isEnabled: boolean;
}

// Type definition for tool
interface MCPTool {
  name: string;
  description?: string;
}

// Type-safe function name constants
const MCP_FUNCTIONS = {
  LIST: 'mcpConnections:list',
  CREATE: 'mcpConnections:create',
  REMOVE: 'mcpConnections:remove',
  UPDATE: 'mcpConnections:update',
  UPDATE_STATUS: 'mcpConnections:updateStatus',
  EXECUTE_TOOL_CALL: 'mcpConnections:executeToolCall',
} as const;

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

export function registerMcpCommand(program: Command) {
  const mcp = program.command('mcp').description('Manage MCP connections');

  mcp
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all MCP connections')
    .action(async (opts) => {
      const client = await createClient();
      const result = await safeCall(
        () => client.query(queryRef(MCP_FUNCTIONS.LIST), {}),
        'Failed to list connections'
      );
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('MCP Connections');
      const items = (result as MCPConnection[]) || [];
      if (items.length === 0) { info('No connections. Add one with: agentforge mcp add'); return; }
      table(items.map((c) => ({
        ID: c._id?.slice(-8) || 'N/A',
        Name: c.name,
        Type: c.protocol,
        Endpoint: c.serverUrl,
        Connected: c.isConnected ? '✔' : '✖',
        Enabled: c.isEnabled ? '✔' : '✖',
      })));
    });

  mcp
    .command('add')
    .description('Add a new MCP connection (interactive)')
    .option('--name <name>', 'Connection name')
    .option('--type <type>', 'Connection type (stdio, sse, http)')
    .option('--endpoint <url>', 'Endpoint URL or command')
    .action(async (opts) => {
      const name = opts.name || await prompt('Connection name: ');
      const type = opts.type || await prompt('Type (stdio/sse/http): ');
      const endpoint = opts.endpoint || await prompt('Endpoint (URL or command): ');

      if (!name || !type || !endpoint) { error('All fields required.'); process.exit(1); }

      const client = await createClient();
      await safeCall(
        () => client.mutation(mutationRef(MCP_FUNCTIONS.CREATE), {
          name, serverUrl: endpoint, protocol: type as 'stdio' | 'sse' | 'http',
        }),
        'Failed to add connection'
      );
      success(`MCP connection "${name}" added.`);
    });

  mcp
    .command('remove')
    .argument('<id>', 'Connection ID')
    .description('Remove an MCP connection')
    .action(async (id) => {
      const client = await createClient();
      await safeCall(() => client.mutation(mutationRef(MCP_FUNCTIONS.REMOVE), { id }), 'Failed');
      success(`Connection "${id}" removed.`);
    });

  mcp
    .command('test')
    .argument('<id>', 'Connection ID')
    .description('Test an MCP connection')
    .action(async (id) => {
      info(`Testing connection "${id}"...`);
      const client = await createClient();
      const conns = await safeCall(
        () => client.query(queryRef(MCP_FUNCTIONS.LIST), {}),
        'Failed'
      );
      const conn = (conns as MCPConnection[]).find(
        (c) => c._id === id || c._id?.endsWith(id)
      );
      if (!conn) { error(`Connection "${id}" not found.`); process.exit(1); }

      // Simple connectivity test
      if (conn.protocol === 'http' || conn.protocol === 'sse') {
        try {
          const res = await fetch(conn.serverUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            success(`Connection "${conn.name}" is reachable (HTTP ${res.status}).`);
            await client.mutation(mutationRef(MCP_FUNCTIONS.UPDATE_STATUS), { id: conn._id, isConnected: true });
          } else {
            error(`Connection "${conn.name}" returned HTTP ${res.status}.`);
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          error(`Connection "${conn.name}" failed: ${message}`);
        }
      } else {
        info(`Connection type "${conn.protocol}" — manual verification required.`);
        info(`Endpoint: ${conn.serverUrl}`);
      }
    });

  mcp
    .command('enable')
    .argument('<id>', 'Connection ID')
    .description('Enable a connection')
    .action(async (id) => {
      const client = await createClient();
      await safeCall(
        () => client.mutation(mutationRef(MCP_FUNCTIONS.UPDATE), { id, isEnabled: true }),
        'Failed'
      );
      success(`Connection "${id}" enabled.`);
    });

  mcp
    .command('disable')
    .argument('<id>', 'Connection ID')
    .description('Disable a connection')
    .action(async (id) => {
      const client = await createClient();
      await safeCall(
        () => client.mutation(mutationRef(MCP_FUNCTIONS.UPDATE), { id, isEnabled: false }),
        'Failed'
      );
      success(`Connection "${id}" disabled.`);
    });

  mcp
    .command('list-tools')
    .argument('<connection-name>', 'Connection name')
    .description('List available tools from an MCP server')
    .action(async (connectionName) => {
      const client = await createClient();
      const conns = await safeCall(
        () => client.query(queryRef(MCP_FUNCTIONS.LIST), {}),
        'Failed to list connections'
      );
      const conn = (conns as MCPConnection[]).find(
        (c) => c.name === connectionName || c._id?.endsWith(connectionName)
      );

      if (!conn) {
        error(`Connection "${connectionName}" not found.`);
        process.exit(1);
      }

      if (!conn.isEnabled) {
        error(`Connection "${connectionName}" is disabled.`);
        process.exit(1);
      }

      // Get connection config for client-side execution
      const config = await safeCall(
        () => (client as any).action(MCP_FUNCTIONS.EXECUTE_TOOL_CALL, {
          id: conn._id,
          toolName: '',
          toolArgs: {},
        }),
        'Failed to get connection config'
      );

      // Use MCPExecutor to list tools (client-side)
      const executor = new MCPExecutor();
      try {
        // Parse server URL as command/args for stdio transport
        // For http/sse, we'd need different transport logic
        const [command, ...args] = (config as { connection: { serverUrl: string } }).connection.serverUrl.split(' ');
        await executor.connect({
          id: conn._id,
          command,
          args,
          env: (config as { connection: { credentials?: Record<string, string> } }).connection.credentials,
        });

        const tools = await executor.listTools();
        header(`Available tools from "${connectionName}":`);
        table(tools.map((t: MCPTool) => ({
          Name: t.name,
          Description: t.description || 'N/A',
        })));

        await executor.disconnect();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        error(`Failed to list tools: ${message}`);
        process.exit(1);
      }
    });

  mcp
    .command('run')
    .argument('<connection-name>', 'Connection name')
    .argument('<tool-name>', 'Tool name to execute')
    .option('--args <json>', 'Tool arguments as JSON string', '{}')
    .description('Execute a tool on an MCP server')
    .action(async (connectionName, toolName, opts) => {
      const client = await createClient();
      const conns = await safeCall(
        () => client.query(queryRef(MCP_FUNCTIONS.LIST), {}),
        'Failed to list connections'
      );
      const conn = (conns as MCPConnection[]).find(
        (c) => c.name === connectionName || c._id?.endsWith(connectionName)
      );

      if (!conn) {
        error(`Connection "${connectionName}" not found.`);
        process.exit(1);
      }

      if (!conn.isEnabled) {
        error(`Connection "${connectionName}" is disabled.`);
        process.exit(1);
      }

      let toolArgs: Record<string, unknown>;
      try {
        toolArgs = JSON.parse(opts.args);
      } catch {
        error('Invalid JSON in --args');
        process.exit(1);
      }

      // Get connection config for client-side execution
      const config = await safeCall(
        () => (client as any).action(MCP_FUNCTIONS.EXECUTE_TOOL_CALL, {
          id: conn._id,
          toolName,
          toolArgs,
        }),
        'Failed to get connection config'
      );

      // Use MCPExecutor to execute tool (client-side)
      const executor = new MCPExecutor();
      try {
        const [command, ...args] = (config as { connection: { serverUrl: string } }).connection.serverUrl.split(' ');
        await executor.connect({
          id: conn._id,
          command,
          args,
          env: (config as { connection: { credentials?: Record<string, string> } }).connection.credentials,
        });

        const result = await executor.executeTool(toolName, toolArgs);
        success(`Tool "${toolName}" executed successfully:`);
        console.log(JSON.stringify(result, null, 2));

        await executor.disconnect();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        error(`Failed to execute tool: ${message}`);
        process.exit(1);
      }
    });
}
