import { Command } from 'commander';
import { createClient } from '../lib/convex-client.js';
import { header, success, error, info, dim, table } from '../lib/display.js';

function safeCall<T>(fn: () => Promise<T>, msg: string): Promise<T> {
  return fn().catch((e: any) => { error(`${msg}: ${e.message}`); process.exit(1); });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function maskKey(key: string): string {
  if (key.length <= 12) return key.substring(0, 4) + '****';
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

function promptSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline');
    if (process.stdin.isTTY) {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      let input = '';
      const onData = (char: string) => {
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(input);
        } else if (char === '\u0003') {
          process.exit(0);
        } else if (char === '\u007f' || char === '\b') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += char;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(question, (ans: string) => { rl.close(); resolve(ans.trim()); });
    }
  });
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', prefix: 'sk-' },
  { id: 'anthropic', name: 'Anthropic', prefix: 'sk-ant-' },
  { id: 'openrouter', name: 'OpenRouter', prefix: 'sk-or-' },
  { id: 'google', name: 'Google AI', prefix: 'AIza' },
  { id: 'xai', name: 'xAI', prefix: 'xai-' },
  { id: 'groq', name: 'Groq', prefix: 'gsk_' },
  { id: 'together', name: 'Together AI', prefix: '' },
  { id: 'perplexity', name: 'Perplexity', prefix: 'pplx-' },
];

export function registerKeysCommand(program: Command) {
  const keys = program.command('keys').description('Manage AI provider API keys');

  keys
    .command('list')
    .option('--provider <provider>', 'Filter by provider')
    .option('--json', 'Output as JSON')
    .description('List all configured API keys')
    .action(async (opts) => {
      const client = await createClient();
      const result = await safeCall(
        () => client.query('apiKeys:list' as any, opts.provider ? { provider: opts.provider } : {}),
        'Failed to list API keys'
      );

      const items = (result as any[]) || [];

      if (opts.json) {
        const safe = items.map((k: any) => ({ ...k, encryptedKey: maskKey(k.encryptedKey) }));
        console.log(JSON.stringify(safe, null, 2));
        return;
      }

      header('API Keys');

      if (items.length === 0) {
        info('No API keys configured.');
        dim('  Add one with: agentforge keys add <provider> [key]');
        dim('');
        dim('  Supported providers:');
        PROVIDERS.forEach(p => dim(`    ${p.id.padEnd(12)} ${p.name}`));
        return;
      }

      table(items.map((k: any) => ({
        Provider: k.provider,
        Name: k.keyName,
        Key: maskKey(k.encryptedKey),
        Active: k.isActive ? '✓' : '✗',
        Created: formatDate(k.createdAt),
        'Last Used': k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never',
      })));
    });

  keys
    .command('add')
    .argument('<provider>', `Provider (${PROVIDERS.map(p => p.id).join(', ')})`)
    .argument('[key]', 'API key value (omit for secure prompt)')
    .option('--name <name>', 'Key display name')
    .description('Add an AI provider API key')
    .action(async (provider, key, opts) => {
      const providerInfo = PROVIDERS.find(p => p.id === provider);
      if (!providerInfo) {
        error(`Unknown provider "${provider}". Supported: ${PROVIDERS.map(p => p.id).join(', ')}`);
        process.exit(1);
      }

      if (!key) {
        key = await promptSecret(`Enter ${providerInfo.name} API key: `);
      }
      if (!key) { error('API key is required.'); process.exit(1); }

      if (providerInfo.prefix && !key.startsWith(providerInfo.prefix)) {
        info(`Warning: ${providerInfo.name} keys typically start with "${providerInfo.prefix}".`);
      }

      const keyName = opts.name || `${providerInfo.name} Key`;
      const client = await createClient();
      await safeCall(
        () => client.action('apiKeys:create' as any, {
          provider,
          keyName,
          encryptedKey: key,
        }),
        'Failed to store API key'
      );
      success(`${providerInfo.name} API key "${keyName}" stored successfully.`);
    });

  keys
    .command('remove')
    .argument('<provider>', 'Provider name')
    .option('-f, --force', 'Skip confirmation')
    .description('Remove an API key')
    .action(async (provider, opts) => {
      const client = await createClient();
      const result = await safeCall(
        () => client.query('apiKeys:list' as any, { provider }),
        'Failed to list keys'
      );
      const items = (result as any[]) || [];
      if (items.length === 0) { error(`No API keys found for "${provider}".`); process.exit(1); }

      // If multiple keys, remove the first one (or we could add selection)
      const target = items[0];

      if (!opts.force) {
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
          rl.question(`Delete "${target.keyName}" for ${provider}? (y/N): `, (ans: string) => { rl.close(); resolve(ans.trim()); });
        });
        if (answer.toLowerCase() !== 'y') { info('Cancelled.'); return; }
      }

      await safeCall(
        () => client.mutation('apiKeys:remove' as any, { id: target._id }),
        'Failed to remove API key'
      );
      success(`API key "${target.keyName}" removed.`);
    });

  keys
    .command('test')
    .argument('<provider>', 'Provider to test')
    .description('Test an API key by making a simple request')
    .action(async (provider) => {
      const client = await createClient();
      const result = await safeCall(
        () => client.query('apiKeys:getActiveForProvider' as any, { provider }),
        'Failed to get key'
      );

      if (!result) { error(`No active API key for "${provider}". Add one with: agentforge keys add ${provider}`); process.exit(1); }

      const key = (result as any).encryptedKey;
      info(`Testing ${provider} API key...`);

      try {
        let ok = false;
        if (provider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
          ok = res.ok;
        } else if (provider === 'anthropic') {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
          });
          ok = res.ok;
        } else if (provider === 'openrouter') {
          const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${key}` } });
          ok = res.ok;
        } else if (provider === 'google') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          ok = res.ok;
        } else if (provider === 'groq') {
          const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
          ok = res.ok;
        } else {
          info(`No test endpoint configured for "${provider}". Key is stored.`);
          return;
        }

        if (ok) {
          success(`${provider} API key is valid and working.`);
          await safeCall(
            () => client.mutation('apiKeys:updateLastUsed' as any, { id: (result as any)._id }),
            'Failed to update last used'
          );
        } else {
          error(`${provider} API key returned an error. Check that the key is valid.`);
        }
      } catch (e: any) {
        error(`Connection failed: ${e.message}`);
      }
    });
}
