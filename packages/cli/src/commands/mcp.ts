import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, details, success, error, info, formatDate } from '../lib/display.js';
import { MCPExecutor } from '@agentforge-ai/core/mcp-executor';
import readline from 'node:readline';

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
      const result = await safeCall(() => client.query('mcpConnections:list' as any, {}), 'Failed to list connections');
      if (opts.json) { console.log(JSON.stringify(result, null, 2)); return; }
      header('MCP Connections');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No connections. Add one with: agentforge mcp add'); return; }
      table(items.map((c: any) => ({
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
        () => client.mutation('mcpConnections:create' as any, {
          name, serverUrl: endpoint, protocol: type,
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
      await safeCall(() => client.mutation('mcpConnections:remove' as any, { id }), 'Failed');
      success(`Connection "${id}" removed.`);
    });

  mcp
    .command('test')
    .argument('<id>', 'Connection ID')
    .description('Test an MCP connection')
    .action(async (id) => {
      info(`Testing connection "${id}"...`);
      const client = await createClient();
      const conns = await safeCall(() => client.query('mcpConnections:list' as any, {}), 'Failed');
      const conn = (conns as any[]).find((c: any) => c._id === id || c._id?.endsWith(id));
      if (!conn) { error(`Connection "${id}" not found.`); process.exit(1); }

      // Simple connectivity test
      if (conn.protocol === 'http' || conn.protocol === 'sse') {
        try {
          const res = await fetch(conn.serverUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            success(`Connection "${conn.name}" is reachable (HTTP ${res.status}).`);
            await client.mutation('mcpConnections:updateStatus' as any, { id: conn._id, isConnected: true });
          } else {
            error(`Connection "${conn.name}" returned HTTP ${res.status}.`);
          }
        } catch (e: any) {
          error(`Connection "${conn.name}" failed: ${e.message}`);
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
      await safeCall(() => client.mutation('mcpConnections:update' as any, { id, isEnabled: true }), 'Failed');
      success(`Connection "${id}" enabled.`);
    });

  mcp
    .command('disable')
    .argument('<id>', 'Connection ID')
    .description('Disable a connection')
    .action(async (id) => {
      const client = await createClient();
      await safeCall(() => client.mutation('mcpConnections:update' as any, { id, isEnabled: false }), 'Failed');
      success(`Connection "${id}" disabled.`);
    });

  mcp
    .command('list-tools')
    .argument('<connection-name>', 'Connection name')
    .description('List available tools from an MCP server')
    .action(async (connectionName) => {
      const client = await createClient();
      const conns = await safeCall(() => client.query('mcpConnections:list' as any, {}), 'Failed to list connections');
      const conn = (conns as any[]).find((c: any) => c.name === connectionName || c._id?.endsWith(connectionName));

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
        () => client.action('mcpConnections:executeToolCall' as any, {
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
        const [command, ...args] = config.connection.serverUrl.split(' ');
        await executor.connect({
          id: conn._id,
          command,
          args,
          env: config.connection.credentials,
        });

        const tools = await executor.listTools();
        header(`Available tools from "${connectionName}":`);
        table(tools.map((t: any) => ({
          Name: t.name,
          Description: t.description || 'N/A',
        })));

        await executor.disconnect();
      } catch (e: any) {
        error(`Failed to list tools: ${e.message}`);
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
      const conns = await safeCall(() => client.query('mcpConnections:list' as any, {}), 'Failed to list connections');
      const conn = (conns as any[]).find((c: any) => c.name === connectionName || c._id?.endsWith(connectionName));

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
        () => client.action('mcpConnections:executeToolCall' as any, {
          id: conn._id,
          toolName,
          toolArgs,
        }),
        'Failed to get connection config'
      );

      // Use MCPExecutor to execute tool (client-side)
      const executor = new MCPExecutor();
      try {
        const [command, ...args] = config.connection.serverUrl.split(' ');
        await executor.connect({
          id: conn._id,
          command,
          args,
          env: config.connection.credentials,
        });

        const result = await executor.executeTool(toolName, toolArgs);
        success(`Tool "${toolName}" executed successfully:`);
        console.log(JSON.stringify(result, null, 2));

        await executor.disconnect();
      } catch (e: any) {
        error(`Failed to execute tool: ${e.message}`);
        process.exit(1);
      }
    });
}
