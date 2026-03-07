import { getActiveModels } from './registry.js';

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  docsUrl?: string;
  colorClass: string;
  description?: string;
  models: string[];
}

const PROVIDER_METADATA: Record<string, Omit<ProviderCatalogEntry, 'models'>> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    docsUrl: 'https://platform.openai.com/docs/models',
    colorClass: 'bg-green-500',
    description: 'GPT-5 family, Codex, and multimodal models.',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    docsUrl: 'https://docs.anthropic.com/en/docs/about-claude/models',
    colorClass: 'bg-orange-500',
    description: 'Claude Sonnet, Opus, and Haiku models.',
  },
  google: {
    id: 'google',
    name: 'Google AI',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/models',
    colorClass: 'bg-blue-500',
    description: 'Gemini 2.5 and Gemini 3 generation models.',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    docsUrl: 'https://openrouter.ai/models',
    colorClass: 'bg-purple-500',
    description: 'Routed access to OpenAI, Anthropic, Google, and open-source models.',
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    docsUrl: 'https://docs.x.ai',
    colorClass: 'bg-slate-500',
    description: 'Grok reasoning and chat models.',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    docsUrl: 'https://docs.mistral.ai',
    colorClass: 'bg-red-500',
    description: 'Mistral frontier and small models.',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    docsUrl: 'https://api-docs.deepseek.com',
    colorClass: 'bg-cyan-500',
    description: 'DeepSeek chat and reasoning models.',
  },
  cohere: {
    id: 'cohere',
    name: 'Cohere',
    docsUrl: 'https://docs.cohere.com',
    colorClass: 'bg-amber-500',
    description: 'Command models and embeddings.',
  },
  moonshotai: {
    id: 'moonshotai',
    name: 'MoonshotAI',
    docsUrl: 'https://platform.moonshot.ai/docs',
    colorClass: 'bg-indigo-500',
    description: 'Kimi long-context models.',
  },
};

const CURATED_OPENROUTER_MODELS = [
  'openrouter/auto',
  'openai/gpt-5.4-pro',
  'openai/gpt-5.4',
  'openai/gpt-5.3-chat',
  'openai/gpt-5.3-codex',
  'openai/gpt-5.2-pro',
  'openai/gpt-5.2',
  'openai/gpt-5.2-codex',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.5',
  'google/gemini-3.1-pro-preview',
  'google/gemini-3-flash-preview',
  'google/gemini-3.1-flash-lite-preview',
  'qwen/qwen3-max',
  'qwen/qwen3-coder',
  'qwen/qwen3-coder-plus',
  'qwen/qwen3-coder-next',
  'qwen/qwen3-235b-a22b',
  'qwen/qwen3-30b-a3b-instruct-2507',
  'qwen/qwen3.5-397b-a17b',
];

const OPENROUTER_MODEL_PREFIXES = [
  'openai/gpt-5',
  'anthropic/claude-opus-4.6',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-haiku-4.5',
  'google/gemini-2.5',
  'google/gemini-3',
  'qwen/qwen3',
  'qwen/qwen3.5',
];

let openAiCache: { expiresAt: number; models: string[] } | null = null;
let openRouterCache: { expiresAt: number; models: string[] } | null = null;

function stripProviderPrefix(provider: string, modelId: string): string {
  const prefix = `${provider}/`;
  return modelId.startsWith(prefix) ? modelId.slice(prefix.length) : modelId;
}

function compareModels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function isDatedSnapshot(modelId: string): boolean {
  return /-\d{4}-\d{2}-\d{2}$/.test(modelId);
}

function isSupportedOpenAIModel(modelId: string): boolean {
  if (modelId.startsWith('text-embedding-')) return false;
  if (modelId.includes('search-api') || modelId.includes('image')) return false;
  if (isDatedSnapshot(modelId)) return false;
  if (modelId === 'o3' || modelId === 'o3-mini' || modelId === 'o4-mini') return true;
  return modelId === 'gpt-5' || modelId.startsWith('gpt-5-') || modelId.startsWith('gpt-5.');
}

function isSupportedOpenRouterModel(modelId: string): boolean {
  if (modelId === 'openrouter/auto') {
    return true;
  }
  return OPENROUTER_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

function getRegistryModels(): ProviderCatalogEntry[] {
  const grouped = new Map<string, string[]>();

  for (const model of getActiveModels()) {
    if (!model.roles.has('agent') && !model.roles.has('observer') && !model.capabilities.has('chat')) {
      continue;
    }
    if (model.provider === 'openrouter') {
      continue;
    }
    const existing = grouped.get(model.provider) ?? [];
    existing.push(stripProviderPrefix(model.provider, model.id));
    grouped.set(model.provider, existing);
  }

  return Array.from(grouped.entries())
    .map(([provider, models]) => ({
      ...(PROVIDER_METADATA[provider] ?? {
        id: provider,
        name: provider,
        colorClass: 'bg-slate-500',
      }),
      models: Array.from(new Set(models)).sort(compareModels),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getOpenRouterModels(): Promise<string[]> {
  const now = Date.now();
  if (openRouterCache && openRouterCache.expiresAt > now) {
    return openRouterCache.models;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`OpenRouter returned ${response.status}`);
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> };
    const availableIds = new Set(
      Array.isArray(payload.data)
        ? payload.data
            .map((entry) => entry.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [],
    );

    const discovered = Array.from(availableIds)
      .filter(isSupportedOpenRouterModel)
      .sort(compareModels);
    const models = Array.from(new Set(['openrouter/auto', ...discovered, ...CURATED_OPENROUTER_MODELS]));
    openRouterCache = {
      expiresAt: now + 15 * 60 * 1000,
      models,
    };
    return models;
  } catch {
    const fallback = Array.from(new Set(CURATED_OPENROUTER_MODELS));
    openRouterCache = {
      expiresAt: now + 5 * 60 * 1000,
      models: fallback,
    };
    return fallback;
  }
}

async function getOpenAIModels(fallback: string[]): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const now = Date.now();
  if (openAiCache && openAiCache.expiresAt > now) {
    return openAiCache.models;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}`);
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> };
    const models = Array.isArray(payload.data)
      ? payload.data
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .filter(isSupportedOpenAIModel)
          .sort(compareModels)
      : [];

    if (models.length === 0) {
      throw new Error('OpenAI returned no supported agent models');
    }

    openAiCache = {
      expiresAt: now + 15 * 60 * 1000,
      models,
    };
    return models;
  } catch {
    openAiCache = {
      expiresAt: now + 5 * 60 * 1000,
      models: fallback,
    };
    return fallback;
  }
}

export async function getProviderCatalog(): Promise<ProviderCatalogEntry[]> {
  const providers = getRegistryModels();
  const openAiFallback = providers.find((provider) => provider.id === 'openai')?.models ?? [];
  const openAiModels = await getOpenAIModels(openAiFallback);
  const openRouterModels = await getOpenRouterModels();

  const openAiIndex = providers.findIndex((provider) => provider.id === 'openai');
  const openai: ProviderCatalogEntry = {
    ...PROVIDER_METADATA.openai,
    models: openAiModels,
  };

  if (openAiIndex >= 0) {
    providers.splice(openAiIndex, 1, openai);
  } else {
    providers.push(openai);
  }

  const existingIndex = providers.findIndex((provider) => provider.id === 'openrouter');
  const openrouter: ProviderCatalogEntry = {
    ...PROVIDER_METADATA.openrouter,
    models: openRouterModels,
  };

  if (existingIndex >= 0) {
    providers.splice(existingIndex, 1, openrouter);
  } else {
    providers.push(openrouter);
  }

  return providers.sort((a, b) => a.name.localeCompare(b.name));
}
