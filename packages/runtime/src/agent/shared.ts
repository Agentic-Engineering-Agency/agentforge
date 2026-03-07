import { ConvexStore } from '@mastra/convex';
import { ConvexVector } from '@mastra/convex';
import { Memory } from '@mastra/memory';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

export const DAEMON_MODEL = 'moonshotai/kimi-k2.5';
export const OBSERVER_MODEL = 'google/gemini-2.5-flash';
export const EMBEDDING_MODEL = process.env.AGENTFORGE_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';
export const DEFAULT_TOKEN_LIMIT = 100_000;

export interface StandardMemoryOptions {
  lastMessages?: number;
  semanticRecall?: { topK: number; messageRange: number; scope: 'resource' | 'thread' };
  workingMemoryTemplate?: string;
  observationalMemory?: { observation?: { messageTokens: number }; reflection?: { observationTokens: number } } | false;
}

// Initialized at daemon startup — singletons shared across all agents
let _storage: ConvexStore | null = null;
let _vector: ConvexVector | null = null;

export function initStorage(deploymentUrl: string, adminAuthToken: string): void {
  _storage = new ConvexStore({
    id: 'agentforge-storage',
    deploymentUrl,
    adminAuthToken,
  });
  _vector = new ConvexVector({
    id: 'agentforge-vectors',
    deploymentUrl,
    adminAuthToken,
  });
}

export function getStorage(): ConvexStore {
  if (!_storage) throw new Error('Storage not initialized. Call initStorage() first.');
  return _storage;
}

export function getVector(): ConvexVector {
  if (!_vector) throw new Error('Vector not initialized. Call initStorage() first.');
  return _vector;
}

export function createStandardMemory(opts?: StandardMemoryOptions): Memory {
  const options = opts ?? {};
  const storage = getStorage();
  const vector = getVector();
  const embedder = new ModelRouterEmbeddingModel(EMBEDDING_MODEL);

  return new Memory({
    storage,
    vector,
    embedder,
    options: {
      lastMessages: options.lastMessages ?? 20,
      semanticRecall: options.semanticRecall ?? {
        topK: 3,
        messageRange: 2,
        scope: 'resource',
      },
      workingMemory: options.workingMemoryTemplate ? {
        enabled: true,
        scope: 'resource',
        template: options.workingMemoryTemplate,
      } : undefined,
      observationalMemory: options.observationalMemory === false ? undefined : {
        model: OBSERVER_MODEL,
        scope: 'thread',
        observation: { messageTokens: 30_000 },
        reflection: { observationTokens: 40_000 },
        ...(options.observationalMemory ?? {}),
      },
    },
  });
}

/** Returns true if initStorage() has been called. Use to guard createStandardAgent() calls. */
export function isStorageInitialized(): boolean {
  return _storage !== null && _vector !== null;
}
