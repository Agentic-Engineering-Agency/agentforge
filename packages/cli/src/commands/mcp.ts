import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, details, success, error, info, formatDate } from '../lib/display.js';
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
}
