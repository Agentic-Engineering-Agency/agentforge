import { Command } from 'commander';
import { createClient } from '../lib/convex-client.js';
import { header, success, error, info, dim, table } from '../lib/display.js';

export function registerTokensCommand(program: Command) {
  const tokens = program.command('tokens').description('Manage API access tokens (for /v1/chat/completions)');

  tokens
    .command('generate')
    .option('--name <name>', 'Token name (required)')
    .option('--agent <agentId>', 'Scope to specific agent')
    .description('Generate a new API access token (shown once only)')
    .action(async (opts) => {
      if (!opts.name) { error('--name is required'); process.exit(1); }
      const client = await createClient();
      const result = await client.action('apiAccessTokens:generate' as any, {
        name: opts.name,
        ...(opts.agent ? { agentId: opts.agent } : {}),
      }) as any;
      success(`Token "${result.name}" created.`);
      info(`\n  Token: ${result.plaintext}`);
      info(`\n  ⚠️  This token will NOT be shown again. Store it securely.`);
      if (result.agentId) info(`  Scoped to agent: ${result.agentId}`);
      dim(`\nUse it as: Authorization: Bearer ${result.plaintext}`);
    });

  tokens
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all active API access tokens')
    .action(async (opts) => {
      const client = await createClient();
      const items = await client.query('apiAccessTokens:list' as any, {}) as any[];
      if (opts.json) { console.log(JSON.stringify(items, null, 2)); return; }
      header('API Access Tokens');
      if (!items.length) { dim('No tokens. Create one: agentforge tokens generate --name "my-app"'); return; }
      table(items.map((t: any) => ({
        Name: t.name,
        Agent: t.agentId || 'all agents',
        Created: new Date(t.createdAt).toLocaleDateString(),
        'Last Used': t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'Never',
      })));
    });

  tokens
    .command('revoke <id>')
    .description('Revoke an API access token')
    .action(async (id) => {
      const client = await createClient();
      await client.mutation('apiAccessTokens:revoke' as any, { id });
      success(`Token revoked.`);
    });
}
