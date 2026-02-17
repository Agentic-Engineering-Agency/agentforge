import { Command } from 'commander';
import { createClient, safeCall } from '../lib/convex-client.js';
import { header, table, success, error, info, dim, colors, formatDate } from '../lib/display.js';
import readline from 'node:readline';

function prompt(q: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

function promptSecret(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Disable echo for secret input
    if (process.stdin.isTTY) {
      process.stdout.write(q);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf-8');
      const onData = (char: string) => {
        if (char === '\n' || char === '\r') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          console.log();
          rl.close();
          resolve(input);
        } else if (char === '\u0003') {
          process.exit();
        } else if (char === '\u007F') {
          input = input.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(q + '*'.repeat(input.length));
        } else {
          input += char;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(q, (ans) => { rl.close(); resolve(ans.trim()); });
    }
  });
}

export function registerVaultCommand(program: Command) {
  const vault = program.command('vault').description('Manage secrets securely');

  vault
    .command('list')
    .option('--json', 'Output as JSON')
    .description('List all stored secrets (values hidden)')
    .action(async (opts) => {
      const client = await createClient();
      const result = await safeCall(() => client.query('vault:list' as any, {}), 'Failed to list secrets');
      if (opts.json) {
        const safe = ((result as any[]) || []).map((s: any) => ({ ...s, encryptedValue: undefined }));
        console.log(JSON.stringify(safe, null, 2));
        return;
      }
      header('Vault — Stored Secrets');
      const items = (result as any[]) || [];
      if (items.length === 0) { info('No secrets stored. Add one with: agentforge vault set <name> <value>'); return; }
      table(items.map((s: any) => ({
        Name: s.name,
        Category: s.category || 'general',
        Provider: s.provider || 'N/A',
        'Last Rotated': s.lastRotatedAt ? formatDate(s.lastRotatedAt) : 'Never',
        Created: formatDate(s.createdAt),
      })));
    });

  vault
    .command('set')
    .argument('<name>', 'Secret name (e.g., OPENAI_API_KEY)')
    .argument('[value]', 'Secret value (omit for secure prompt)')
    .option('--category <cat>', 'Category (api_key, token, secret, credential)', 'api_key')
    .option('--provider <provider>', 'Provider name (openai, anthropic, etc.)')
    .description('Store a secret securely')
    .action(async (name, value, opts) => {
      if (!value) {
        value = await promptSecret(`Enter value for ${name}: `);
      }
      if (!value) { error('Value is required.'); process.exit(1); }

      const client = await createClient();
      await safeCall(
        () => client.mutation('vault:store' as any, {
          name,
          encryptedValue: value,
          category: opts.category,
          provider: opts.provider,
        }),
        'Failed to store secret'
      );
      success(`Secret "${name}" stored securely.`);
    });

  vault
    .command('get')
    .argument('<name>', 'Secret name')
    .option('--reveal', 'Show the actual value (use with caution)')
    .description('Retrieve a secret')
    .action(async (name, opts) => {
      const client = await createClient();
      const result = await safeCall(() => client.query('vault:list' as any, {}), 'Failed');
      const secret = ((result as any[]) || []).find((s: any) => s.name === name);
      if (!secret) { error(`Secret "${name}" not found.`); process.exit(1); }

      if (opts.reveal) {
        const value = await safeCall(
          () => client.query('vault:getDecrypted' as any, { _id: secret._id }),
          'Failed to retrieve secret'
        );
        console.log(value);
      } else {
        const masked = secret.encryptedValue
          ? secret.encryptedValue.slice(0, 4) + '****' + secret.encryptedValue.slice(-4)
          : '****';
        info(`${name} = ${masked}`);
        dim('  Use --reveal to show the full value.');
      }
    });

  vault
    .command('delete')
    .argument('<name>', 'Secret name')
    .option('-f, --force', 'Skip confirmation')
    .description('Delete a secret')
    .action(async (name, opts) => {
      if (!opts.force) {
        const confirm = await prompt(`Delete secret "${name}"? This cannot be undone. (y/N): `);
        if (confirm.toLowerCase() !== 'y') { info('Cancelled.'); return; }
      }
      const client = await createClient();
      const result = await safeCall(() => client.query('vault:list' as any, {}), 'Failed');
      const secret = ((result as any[]) || []).find((s: any) => s.name === name);
      if (!secret) { error(`Secret "${name}" not found.`); process.exit(1); }
      await safeCall(() => client.mutation('vault:remove' as any, { _id: secret._id }), 'Failed');
      success(`Secret "${name}" deleted.`);
    });

  vault
    .command('rotate')
    .argument('<name>', 'Secret name')
    .description('Rotate a secret (set a new value)')
    .action(async (name) => {
      const client = await createClient();
      const result = await safeCall(() => client.query('vault:list' as any, {}), 'Failed');
      const secret = ((result as any[]) || []).find((s: any) => s.name === name);
      if (!secret) { error(`Secret "${name}" not found.`); process.exit(1); }

      const newValue = await promptSecret(`Enter new value for ${name}: `);
      if (!newValue) { error('Value is required.'); process.exit(1); }

      await safeCall(
        () => client.mutation('vault:rotate' as any, { _id: secret._id, newValue }),
        'Failed to rotate secret'
      );
      success(`Secret "${name}" rotated.`);
    });
}
