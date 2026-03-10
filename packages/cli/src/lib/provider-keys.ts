import { ConvexHttpClient } from 'convex/browser';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface AgentProviderConfig {
  provider?: string;
  model?: string;
}

export interface ProviderKeyHydrationResult {
  hydrated: string[];
  missing: string[];
  skipped: string[];
}

export interface ProviderKeyClient {
  action: (fn: any, args: Record<string, unknown>) => Promise<unknown>;
}

export function getProviderEnvKeys(provider: string): string[] {
  if (provider === 'google') {
    return ['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'];
  }
  return [getProviderEnvKey(provider)];
}

export function getProviderEnvKey(provider: string): string {
  const map: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    xai: 'XAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    groq: 'GROQ_API_KEY',
    together: 'TOGETHER_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    elevenlabs: 'ELEVENLABS_API_KEY',
    cohere: 'COHERE_API_KEY',
  };
  return map[provider] ?? `${provider.toUpperCase()}_API_KEY`;
}

export function getAgentProviders(agentConfigs: AgentProviderConfig[]): string[] {
  const providers = new Set<string>();

  for (const config of agentConfigs) {
    if (config.provider) {
      providers.add(config.provider);
      continue;
    }

    if (config.model?.includes('/')) {
      providers.add(config.model.split('/')[0]);
    }
  }

  return [...providers];
}

export function getProvidersFromModels(models: Array<string | undefined | null>): string[] {
  const providers = new Set<string>();

  for (const model of models) {
    if (!model || !model.includes('/')) {
      continue;
    }

    providers.add(model.split('/')[0]!);
  }

  return [...providers];
}

async function loadProjectInternalApi(projectDir: string): Promise<any> {
  const apiPath = path.join(projectDir, 'convex', '_generated', 'api.js');
  const moduleUrl = pathToFileURL(apiPath).href;
  const apiModule = await import(moduleUrl);
  return apiModule.internal;
}

function createAdminClient(convexUrl: string, deployKey: string): ConvexHttpClient {
  const client = new ConvexHttpClient(convexUrl);
  (client as ConvexHttpClient & { setAdminAuth: (token: string) => void }).setAdminAuth(deployKey);
  return client;
}

export async function hydrateProviderEnvVars(options: {
  convexUrl: string;
  deployKey: string;
  projectDir: string;
  providers: string[];
  client?: ProviderKeyClient;
  internalApi?: any;
}): Promise<ProviderKeyHydrationResult> {
  const result: ProviderKeyHydrationResult = {
    hydrated: [],
    missing: [],
    skipped: [],
  };

  if (options.providers.length === 0) {
    return result;
  }

  const client = options.client ?? createAdminClient(options.convexUrl, options.deployKey);
  const internalApi = options.internalApi ?? await loadProjectInternalApi(options.projectDir);

  for (const provider of options.providers) {
    const envKeys = getProviderEnvKeys(provider);
    const existingValue = envKeys
      .map((envKey) => process.env[envKey])
      .find((value): value is string => Boolean(value));

    if (existingValue) {
      for (const envKey of envKeys) {
        process.env[envKey] ??= existingValue;
      }
      result.skipped.push(provider);
      continue;
    }

    const decrypted = await client.action(
      internalApi.apiKeys.getDecryptedForProvider,
      { provider },
    ) as { apiKey?: string } | null;

    if (decrypted?.apiKey) {
      for (const envKey of envKeys) {
        process.env[envKey] = decrypted.apiKey;
      }
      result.hydrated.push(provider);
    } else {
      result.missing.push(provider);
    }
  }

  return result;
}
