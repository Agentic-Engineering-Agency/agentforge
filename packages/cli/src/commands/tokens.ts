import { Command } from 'commander';
import { createClient } from '../lib/convex-client.js';
import { header, success, error, info, dim, table } from '../lib/display.js';

export function registerTokensCommand(program: Command) {
  const tokens = program.command('tokens').description('Manage API access tokens (for /v1/chat/completions)');

  tokens
    .command('generate')
    .option('--name <name>', 'Token name (required)')
    .description('Generate a new API access token (shown once only)')
    .action(async (opts) => {
      if (!opts.name) { error('--name is required'); process.exit(1); }
      const client = await createClient();
      const result = await client.mutation('apiAccessTokens:generate' as any, {
        name: opts.name,
      }) as { id: string; token: string };
      success(`Token "${opts.name}" created.`);
      info(`\n  Token: ${result.token}`);
      info(`\n  ⚠️  This token will NOT be shown again. Store it securely.`);
      dim(`\nUse it as: Authorization: Bearer ${result.token}`);
    });

  tokens
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all API access tokens')
    .action(async (opts) => {
      const client = await createClient();
      const items = await client.query('apiAccessTokens:list' as any, {}) as any[];
      if (opts.json) { console.log(JSON.stringify(items, null, 2)); return; }
      header('API Access Tokens');
      if (!items.length) { dim('No tokens. Create one: agentforge tokens generate --name "my-app"'); return; }
      table(items.map((t: any) => {
        // Mask token: show first 8 chars + ... + last 4 chars
        const maskedToken = t.token ? `${t.token.slice(0, 8)}...${t.token.slice(-4)}` : '...';
        return {
          Name: t.name,
          Token: maskedToken,
          Status: t.isActive ? 'Active' : 'Revoked',
          Created: new Date(t.createdAt).toLocaleDateString(),
          Expires: t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'Never',
        };
      }));
    });

  tokens
    .command('revoke <id>')
    .description('Revoke an API access token')
    .action(async (id) => {
      const client = await createClient();
      try {
        await client.mutation('apiAccessTokens:revoke' as any, { id });
        success(`Token ${id} revoked.`);
      } catch (err) {
        error(`Failed to revoke token: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
