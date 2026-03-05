import { Command } from 'commander';
import { createClient } from '../lib/convex-client.js';
import { header, success, error, info, dim, table } from '../lib/display.js';

const PROVIDERS = ['openai','anthropic','openrouter','mistral','google','groq','xai'];

export function registerModelsCommand(program: Command) {
  const models = program.command('models').description('Manage AI model lists');

  models
    .command('list')
    .option('--provider <provider>', 'Filter by provider')
    .option('--refresh', 'Force-refresh cached models from provider API')
    .option('--json', 'Output as JSON')
    .description('List available AI models (fetched from provider APIs)')
    .action(async (opts) => {
      const client = await createClient();
      const providers = opts.provider ? [opts.provider] : PROVIDERS;
      const allModels: Record<string, string[]> = {};

      for (const provider of providers) {
        const cached = await client.action('modelFetcher:getModelsForProvider' as any, { provider }).catch(() => null);
        if (cached && !opts.refresh) {
          allModels[provider] = Array.isArray(cached) ? cached : (cached as any).models ?? cached;
        } else {
          info(`Fetching ${provider} models...`);
          const result = await client.action('modelFetcher:refreshAllModels' as any, { provider, apiKey: '' })
            .catch(() => null);
          if (result) allModels[provider] = (result as string[]);
        }
      }

      if (opts.json) { console.log(JSON.stringify(allModels, null, 2)); return; }
      header('Available Models');
      for (const [provider, list] of Object.entries(allModels)) {
        if (!list?.length) { dim(`  ${provider}: no models cached (add API key first)`); continue; }
        info(`${provider} (${list.length} models):`);
        list.slice(0, 10).forEach((m: any) => dim(`  ${m.displayName ?? m.id ?? m} ${m.isFromAPI ? "(live)" : "(static)"}`));
        if (list.length > 10) dim(`  ... and ${list.length - 10} more`);
      }
    });

  models
    .command('refresh')
    .argument('[provider]', 'Provider to refresh (default: all)')
    .description('Refresh model list from provider API')
    .action(async (provider) => {
      const client = await createClient();
      const providers = provider ? [provider] : PROVIDERS;
      for (const p of providers) {
        await client.action('modelFetcher:refreshAllModels' as any, { provider: p, apiKey: '' }).catch(() => {});
        success(`Refreshed ${p} models`);
      }
    });
}
