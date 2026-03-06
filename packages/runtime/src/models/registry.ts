export interface ModelEntry {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  maxOutputTokens?: number;
  costPerMInput: number;
  costPerMOutput: number;
  tier: 'free' | 'budget' | 'standard' | 'premium';
  capabilities: Set<'chat' | 'vision' | 'code' | 'long-context' | 'embedding' | 'structured-output'>;
  roles: Set<'agent' | 'observer' | 'guardrail' | 'embedding'>;
  active: boolean;
}

const MODELS: readonly ModelEntry[] = [
  // OpenAI
  {
    id: 'openai/gpt-5.1',
    displayName: 'GPT-5.1',
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPerMInput: 15,
    costPerMOutput: 60,
    tier: 'premium',
    capabilities: new Set(['chat', 'code', 'vision', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'openai/gpt-5.1-mini',
    displayName: 'GPT-5.1 Mini',
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 16384,
    costPerMInput: 0.15,
    costPerMOutput: 0.60,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'structured-output']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },
  {
    id: 'openai/gpt-4.1',
    displayName: 'GPT-4.1',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    costPerMInput: 2.50,
    costPerMOutput: 10,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'vision', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'openai/gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPerMInput: 0.15,
    costPerMOutput: 0.60,
    tier: 'budget',
    capabilities: new Set(['chat', 'code', 'structured-output']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },
  {
    id: 'openai/gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    costPerMInput: 2.50,
    costPerMOutput: 10,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'vision', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPerMInput: 0.15,
    costPerMOutput: 0.60,
    tier: 'budget',
    capabilities: new Set(['chat', 'code', 'vision', 'structured-output']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },
  {
    id: 'openai/o3',
    displayName: 'O3',
    provider: 'openai',
    contextWindow: 200000,
    costPerMInput: 60,
    costPerMOutput: 60,
    tier: 'premium',
    capabilities: new Set(['code', 'long-context']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'openai/o4-mini',
    displayName: 'O4 Mini',
    provider: 'openai',
    contextWindow: 200000,
    costPerMInput: 1.50,
    costPerMOutput: 6,
    tier: 'standard',
    capabilities: new Set(['code', 'long-context']),
    roles: new Set(['agent']),
    active: true,
  },

  // Anthropic
  {
    id: 'anthropic/claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPerMInput: 15,
    costPerMOutput: 75,
    tier: 'premium',
    capabilities: new Set(['chat', 'code', 'vision', 'long-context', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'anthropic/claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPerMInput: 3,
    costPerMOutput: 15,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'vision', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'anthropic/claude-haiku-4-5',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPerMInput: 0.80,
    costPerMOutput: 4,
    tier: 'budget',
    capabilities: new Set(['chat', 'code', 'vision']),
    roles: new Set(['observer']),
    active: true,
  },

  // Google
  {
    id: 'google/gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    costPerMInput: 1.25,
    costPerMOutput: 5,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'vision', 'long-context', 'structured-output']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },
  {
    id: 'google/gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    costPerMInput: 0.075,
    costPerMOutput: 0.30,
    tier: 'budget',
    capabilities: new Set(['chat', 'code', 'vision', 'long-context']),
    roles: new Set(['agent', 'observer', 'guardrail']),
    active: true,
  },
  {
    id: 'google/gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    costPerMInput: 0.015,
    costPerMOutput: 0.06,
    tier: 'free',
    capabilities: new Set(['chat', 'vision', 'long-context']),
    roles: new Set(['observer']),
    active: true,
  },
  {
    id: 'google/gemini-3.1-flash-lite-preview',
    displayName: 'Gemini 3.1 Flash Lite (Preview)',
    provider: 'google',
    contextWindow: 1000000,
    costPerMInput: 0.01,
    costPerMOutput: 0.04,
    tier: 'free',
    capabilities: new Set(['chat', 'vision']),
    roles: new Set(['observer']),
    active: true,
  },
  {
    id: 'google/gemini-embedding-001',
    displayName: 'Gemini Embedding 001',
    provider: 'google',
    contextWindow: 2048,
    costPerMInput: 0.01,
    costPerMOutput: 0,
    tier: 'free',
    capabilities: new Set(['embedding']),
    roles: new Set(['embedding']),
    active: true,
  },

  // Mistral
  {
    id: 'mistral/mistral-large-latest',
    displayName: 'Mistral Large',
    provider: 'mistral',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    costPerMInput: 2,
    costPerMOutput: 6,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'vision', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'mistral/mistral-small-latest',
    displayName: 'Mistral Small',
    provider: 'mistral',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    costPerMInput: 0.20,
    costPerMOutput: 0.60,
    tier: 'budget',
    capabilities: new Set(['chat', 'code']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },

  // DeepSeek
  {
    id: 'deepseek/deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'deepseek',
    contextWindow: 128000,
    costPerMInput: 0.14,
    costPerMOutput: 0.28,
    tier: 'budget',
    capabilities: new Set(['chat', 'code', 'long-context']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'deepseek/deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    provider: 'deepseek',
    contextWindow: 64000,
    costPerMInput: 0.55,
    costPerMOutput: 2.19,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'long-context']),
    roles: new Set(['agent']),
    active: true,
  },

  // xAI
  {
    id: 'xai/grok-3',
    displayName: 'Grok 3',
    provider: 'xai',
    contextWindow: 1000000,
    costPerMInput: 2,
    costPerMOutput: 10,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'vision', 'long-context']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'xai/grok-3-mini',
    displayName: 'Grok 3 Mini',
    provider: 'xai',
    contextWindow: 1000000,
    costPerMInput: 0.30,
    costPerMOutput: 1.50,
    tier: 'budget',
    capabilities: new Set(['chat', 'code']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },

  // OpenRouter (pass-through proxy)
  {
    id: 'openrouter/*',
    displayName: 'OpenRouter (Pass-through)',
    provider: 'openrouter',
    contextWindow: 200000,
    costPerMInput: 0,
    costPerMOutput: 0,
    tier: 'standard',
    capabilities: new Set(['chat', 'vision', 'code']),
    roles: new Set(['agent']),
    active: true,
  },

  // Cohere
  {
    id: 'cohere/command-r-plus',
    displayName: 'Command R+',
    provider: 'cohere',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    costPerMInput: 2.50,
    costPerMOutput: 10,
    tier: 'standard',
    capabilities: new Set(['chat', 'code', 'long-context', 'structured-output']),
    roles: new Set(['agent']),
    active: true,
  },
  {
    id: 'cohere/command-r',
    displayName: 'Command R',
    provider: 'cohere',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    costPerMInput: 0.50,
    costPerMOutput: 1.50,
    tier: 'budget',
    capabilities: new Set(['chat', 'code']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },

  // MoonshotAI
  {
    id: 'moonshotai/kimi-k2.5',
    displayName: 'Kimi K2.5',
    provider: 'moonshotai',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPerMInput: 0.12,
    costPerMOutput: 0.12,
    tier: 'budget',
    capabilities: new Set(['chat', 'code', 'long-context']),
    roles: new Set(['agent', 'observer']),
    active: true,
  },
] as const;

const MODEL_MAP = new Map(MODELS.map(m => [m.id, m]));

export function getModel(id: string): ModelEntry | undefined {
  return MODEL_MAP.get(id);
}

export function getModelsByProvider(provider: string): ModelEntry[] {
  return MODELS.filter(m => m.provider === provider);
}

export function getActiveModels(): ModelEntry[] {
  return MODELS.filter(m => m.active);
}

export function getContextLimit(modelId: string): number {
  const model = getModel(modelId);
  return model?.contextWindow ?? 100000;
}
