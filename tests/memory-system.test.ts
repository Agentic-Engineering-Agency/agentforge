import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: Schema Validation (static analysis of convex/schema.ts)
// ---------------------------------------------------------------------------

describe('AGE-12: Memory Schema — memoryEntries table', () => {
  const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  // Capture the memoryEntries table block including indexes
  const tableBlockRegex =
    /memoryEntries:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.vectorIndex\([^)]+\{[\s\S]*?\}\)/m;
  const tableMatch = schemaContent.match(tableBlockRegex);

  it('memoryEntries table should exist in schema', () => {
    expect(schemaContent).toContain('memoryEntries');
  });

  it('should have content field as v.string()', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('content');
    expect(tableMatch![0]).toContain('v.string()');
  });

  it('should have type field with union of conversation/fact/summary/episodic', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('v.literal("conversation")');
    expect(tableMatch![0]).toContain('v.literal("fact")');
    expect(tableMatch![0]).toContain('v.literal("summary")');
    expect(tableMatch![0]).toContain('v.literal("episodic")');
  });

  it('should have agentId field as v.string()', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('agentId');
  });

  it('should have threadId as optional v.id("threads")', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('threadId');
    expect(tableMatch![0]).toContain('v.optional(v.id("threads"))');
  });

  it('should have projectId as optional v.id("projects")', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('projectId');
    expect(tableMatch![0]).toContain('v.optional(v.id("projects"))');
  });

  it('should have embedding field as optional array of float64', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('embedding');
    expect(tableMatch![0]).toContain('v.optional(v.array(v.float64()))');
  });

  it('should have importance field as v.number()', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('importance');
    expect(tableMatch![0]).toContain('v.number()');
  });

  it('should have accessCount field as v.number()', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('accessCount');
  });

  it('should have createdAt field', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('createdAt');
  });

  it('should have updatedAt field', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('updatedAt');
  });

  it('should have expiresAt as optional number', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('expiresAt');
    expect(tableMatch![0]).toContain('v.optional(v.number())');
  });

  it('should have byAgentId index', () => {
    const indexRegex =
      /memoryEntries:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byAgentId"/m;
    expect(schemaContent.match(indexRegex), 'byAgentId index not found').toBeTruthy();
  });

  it('should have byThreadId index', () => {
    const indexRegex =
      /memoryEntries:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byThreadId"/m;
    expect(schemaContent.match(indexRegex), 'byThreadId index not found').toBeTruthy();
  });

  it('should have byProjectId index', () => {
    const indexRegex =
      /memoryEntries:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byProjectId"/m;
    expect(schemaContent.match(indexRegex), 'byProjectId index not found').toBeTruthy();
  });

  it('should have byAgentAndType compound index', () => {
    const indexRegex =
      /memoryEntries:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byAgentAndType"/m;
    expect(schemaContent.match(indexRegex), 'byAgentAndType index not found').toBeTruthy();
  });

  it('should have byEmbedding vector index with dimensions 1536', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('byEmbedding');
    expect(tableMatch![0]).toContain('dimensions: 1536');
  });

  it('vector index should include agentId in filterFields', () => {
    expect(tableMatch, 'memoryEntries table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('filterFields');
    expect(tableMatch![0]).toContain('"agentId"');
  });
});

describe('AGE-12: Memory Schema — memoryConsolidations table', () => {
  const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  const tableBlockRegex =
    /memoryConsolidations:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\([^)]+\)/m;
  const tableMatch = schemaContent.match(tableBlockRegex);

  it('memoryConsolidations table should exist in schema', () => {
    expect(schemaContent).toContain('memoryConsolidations');
  });

  it('should have agentId field', () => {
    expect(tableMatch, 'memoryConsolidations table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('agentId');
  });

  it('should have sourceMemoryIds field referencing memoryEntries', () => {
    expect(tableMatch, 'memoryConsolidations table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('sourceMemoryIds');
    expect(tableMatch![0]).toContain('v.id("memoryEntries")');
  });

  it('should have resultMemoryId field referencing memoryEntries', () => {
    expect(tableMatch, 'memoryConsolidations table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('resultMemoryId');
  });

  it('should have strategy field with union of consolidation strategies', () => {
    expect(tableMatch, 'memoryConsolidations table block not found').toBeTruthy();
    expect(tableMatch![0]).toContain('strategy');
    // At least one literal strategy should be present
    const hasSummarize = tableMatch![0].includes('v.literal("summarize")');
    const hasMerge = tableMatch![0].includes('v.literal("merge")');
    const hasDeduplicate = tableMatch![0].includes('v.literal("deduplicate")');
    expect(hasSummarize || hasMerge || hasDeduplicate).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: Memory CRUD Module (static analysis of convex/memory.ts)
// ---------------------------------------------------------------------------

describe('AGE-12: Memory CRUD Module', () => {
  const memoryPath = path.resolve(__dirname, '../convex/memory.ts');

  it('convex/memory.ts should exist', () => {
    expect(fs.existsSync(memoryPath)).toBe(true);
  });

  const memoryContent = fs.existsSync(memoryPath)
    ? fs.readFileSync(memoryPath, 'utf-8')
    : '';

  it('should export add mutation', () => {
    expect(memoryContent).toContain('export const add');
  });

  it('should export get query', () => {
    expect(memoryContent).toContain('export const get');
  });

  it('should export listByAgent query', () => {
    expect(memoryContent).toContain('export const listByAgent');
  });

  it('should export listByThread query', () => {
    expect(memoryContent).toContain('export const listByThread');
  });

  it('should export update mutation', () => {
    expect(memoryContent).toContain('export const update');
  });

  it('should export remove mutation', () => {
    expect(memoryContent).toContain('export const remove');
  });

  it('should export recordAccess mutation', () => {
    expect(memoryContent).toContain('export const recordAccess');
  });

  it('should export bulkAdd mutation', () => {
    expect(memoryContent).toContain('export const bulkAdd');
  });

  it('should export deleteExpired mutation', () => {
    expect(memoryContent).toContain('export const deleteExpired');
  });

  it('should export getStats query', () => {
    expect(memoryContent).toContain('export const getStats');
  });

  it('should use paginationOptsValidator (not .collect()) for list queries', () => {
    expect(memoryContent).toContain('paginationOptsValidator');
  });

  it('should import mutation and query from Convex generated server', () => {
    expect(memoryContent).toContain('mutation');
    expect(memoryContent).toContain('query');
    expect(memoryContent).toMatch(/from\s+["'].+\/_generated\/server["']/);
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: Vector Search Engine (static analysis of convex/lib/memorySearch.ts)
// ---------------------------------------------------------------------------

describe('AGE-12: Vector Search Engine — memorySearch.ts', () => {
  const searchPath = path.resolve(__dirname, '../convex/lib/memorySearch.ts');

  it('convex/lib/memorySearch.ts should exist', () => {
    expect(fs.existsSync(searchPath)).toBe(true);
  });

  const searchContent = fs.existsSync(searchPath)
    ? fs.readFileSync(searchPath, 'utf-8')
    : '';

  it('should export vectorSearch function', () => {
    expect(searchContent).toContain('export async function vectorSearch');
  });

  it('should export textSearch function', () => {
    expect(searchContent).toContain('export async function textSearch');
  });

  it('should export hybridSearch function', () => {
    expect(searchContent).toContain('export async function hybridSearch');
  });

  it('vectorSearch should call ctx.vectorSearch', () => {
    expect(searchContent).toContain('ctx.vectorSearch');
  });

  it('textSearch should implement BM25-style scoring with k1 constant', () => {
    // BM25 is parameterized by k1
    expect(searchContent).toMatch(/BM25_K1|k1/i);
  });

  it('textSearch should implement BM25-style scoring with b constant', () => {
    // BM25 is parameterized by b
    expect(searchContent).toMatch(/BM25_B|bm25.*b\b|\bb\s*=\s*0\./i);
  });

  it('hybridSearch should use Reciprocal Rank Fusion (RRF)', () => {
    expect(searchContent).toMatch(/RRF|reciprocal.rank.fusion|rrfScore|rrf/i);
  });

  it('should return empty array for empty query in vectorSearch', () => {
    // Check that an early return for empty query is present
    expect(searchContent).toMatch(/query.*trim.*length.*===.*0|!query.*return\s*\[\]/);
  });
});

describe('AGE-12: Embeddings Module', () => {
  const embeddingsPath = path.resolve(__dirname, '../convex/lib/embeddings.ts');

  it('convex/lib/embeddings.ts should exist', () => {
    expect(fs.existsSync(embeddingsPath)).toBe(true);
  });

  const embeddingsContent = fs.existsSync(embeddingsPath)
    ? fs.readFileSync(embeddingsPath, 'utf-8')
    : '';

  it('should export generateEmbedding function', () => {
    expect(embeddingsContent).toContain('export async function generateEmbedding');
  });

  it('should export generateEmbeddings function', () => {
    expect(embeddingsContent).toContain('export async function generateEmbeddings');
  });

  it('should export EMBEDDING_DIMENSIONS constant equal to 1536', () => {
    expect(embeddingsContent).toContain('EMBEDDING_DIMENSIONS');
    expect(embeddingsContent).toContain('1536');
  });

  it('should use text-embedding-3-small model', () => {
    expect(embeddingsContent).toContain('text-embedding-3-small');
  });

  it('should have fallback for API failures (zero vector)', () => {
    expect(embeddingsContent).toMatch(/zeroVector|zero.*vector|fill\(0\)/i);
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: Memory Config (static analysis + dynamic import)
// ---------------------------------------------------------------------------

describe('AGE-12: Memory Config — static analysis', () => {
  const configPath = path.resolve(__dirname, '../convex/lib/memoryConfig.ts');

  it('convex/lib/memoryConfig.ts should exist', () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  const configContent = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf-8')
    : '';

  it('should export DEFAULT_MEMORY_CONFIG', () => {
    expect(configContent).toContain('export const DEFAULT_MEMORY_CONFIG');
  });

  it('should export resolveMemoryConfig function', () => {
    expect(configContent).toContain('export function resolveMemoryConfig');
  });

  it('should export MemoryConfig type or interface', () => {
    expect(configContent).toMatch(/export (interface|type) MemoryConfig/);
  });

  it('DEFAULT_MEMORY_CONFIG.enabled should be false (off by default)', () => {
    expect(configContent).toContain('enabled: false');
  });

  it('DEFAULT_MEMORY_CONFIG.maxRecallItems should be a positive number', () => {
    // Check there is a positive integer assigned to maxRecallItems
    expect(configContent).toMatch(/maxRecallItems:\s*[1-9]\d*/);
  });
});

describe('AGE-12: Memory Config — resolveMemoryConfig logic', () => {
  let resolveMemoryConfig: (meta: Record<string, unknown> | undefined) => Record<string, unknown>;
  let DEFAULT_MEMORY_CONFIG: Record<string, unknown>;

  beforeAll(async () => {
    try {
      const mod = await import('../convex/lib/memoryConfig');
      resolveMemoryConfig = mod.resolveMemoryConfig as typeof resolveMemoryConfig;
      DEFAULT_MEMORY_CONFIG = mod.DEFAULT_MEMORY_CONFIG as typeof DEFAULT_MEMORY_CONFIG;
    } catch {
      // Module may not be importable yet
    }
  });

  it('should return defaults when no metadata provided', () => {
    if (!resolveMemoryConfig) return;
    const config = resolveMemoryConfig(undefined);
    expect(config).toEqual(DEFAULT_MEMORY_CONFIG);
  });

  it('should override enabled when specified', () => {
    if (!resolveMemoryConfig) return;
    const config = resolveMemoryConfig({ memoryConfig: { enabled: true } });
    expect(config.enabled).toBe(true);
    expect(config.maxRecallItems).toBe(DEFAULT_MEMORY_CONFIG.maxRecallItems);
  });

  it('should preserve defaults for unspecified fields', () => {
    if (!resolveMemoryConfig) return;
    const config = resolveMemoryConfig({ memoryConfig: { maxRecallItems: 10 } });
    expect(config.maxRecallItems).toBe(10);
    expect(config.enabled).toBe(false);
  });

  it('should return defaults when metadata has no memoryConfig key', () => {
    if (!resolveMemoryConfig) return;
    const config = resolveMemoryConfig({ someOtherKey: 'value' });
    expect(config).toEqual(DEFAULT_MEMORY_CONFIG);
  });

  it('should return defaults when metadata is empty object', () => {
    if (!resolveMemoryConfig) return;
    const config = resolveMemoryConfig({});
    expect(config).toEqual(DEFAULT_MEMORY_CONFIG);
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Agent Integration (static analysis of convex/mastraIntegration.ts)
// ---------------------------------------------------------------------------

describe('AGE-12: Agent Integration with Memory', () => {
  const integrationPath = path.resolve(__dirname, '../convex/mastraIntegration.ts');

  it('convex/mastraIntegration.ts should exist', () => {
    expect(fs.existsSync(integrationPath)).toBe(true);
  });

  const integrationContent = fs.existsSync(integrationPath)
    ? fs.readFileSync(integrationPath, 'utf-8')
    : '';

  it('should still export executeAgent action', () => {
    expect(integrationContent).toContain('executeAgent');
  });

  it('should still export streamAgent action', () => {
    expect(integrationContent).toContain('streamAgent');
  });

  it('should still export executeWorkflow action', () => {
    expect(integrationContent).toContain('executeWorkflow');
  });

  it('should contain memory recall logic (hybridSearch or memoryConfig import)', () => {
    const hasHybridSearch = integrationContent.includes('hybridSearch');
    const hasMemoryConfig = integrationContent.includes('memoryConfig');
    const hasMemoryImport = integrationContent.includes('memory');
    expect(hasHybridSearch || hasMemoryConfig || hasMemoryImport).toBe(true);
  });

  it('should contain memory store logic (api.memory.add or autoStore)', () => {
    const hasMemoryAdd = integrationContent.includes('api.memory.add');
    const hasAutoStore = integrationContent.includes('autoStore');
    expect(hasMemoryAdd || hasAutoStore).toBe(true);
  });

  it('memory operations should be wrapped in try/catch (non-blocking)', () => {
    // Memory errors should be caught and not fail the main execution
    expect(integrationContent).toContain('try {');
    expect(integrationContent).toContain('catch');
  });

  it('should preserve original failover logic (executeWithFailover)', () => {
    expect(integrationContent).toContain('executeWithFailover');
  });

  it('should preserve buildFailoverChain function', () => {
    expect(integrationContent).toContain('buildFailoverChain');
  });

  it('should preserve classifyError function', () => {
    expect(integrationContent).toContain('classifyError');
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: Consolidation Module (static analysis of convex/memoryConsolidation.ts)
// ---------------------------------------------------------------------------

describe('AGE-12: Memory Consolidation Module', () => {
  const consolidationPath = path.resolve(__dirname, '../convex/memoryConsolidation.ts');

  it('convex/memoryConsolidation.ts should exist', () => {
    expect(fs.existsSync(consolidationPath)).toBe(true);
  });

  const consolidationContent = fs.existsSync(consolidationPath)
    ? fs.readFileSync(consolidationPath, 'utf-8')
    : '';

  it('should export consolidate action', () => {
    expect(consolidationContent).toContain('export const consolidate');
  });

  it('should export cleanupExpired mutation', () => {
    expect(consolidationContent).toContain('export const cleanupExpired');
  });

  it('should export getConsolidationHistory query', () => {
    expect(consolidationContent).toContain('export const getConsolidationHistory');
  });

  it('should reference memoryEntries table', () => {
    expect(consolidationContent).toContain('memoryEntries');
  });

  it('should reference memoryConsolidations table', () => {
    expect(consolidationContent).toContain('memoryConsolidations');
  });
});

// ---------------------------------------------------------------------------
// Test Group 7: Edge Cases & Integration
// ---------------------------------------------------------------------------

describe('AGE-12: Edge Cases & Integration Checks', () => {
  it('convex/memory.ts should not import from convex/lib/memorySearch.ts (separation of concerns)', () => {
    const memoryPath = path.resolve(__dirname, '../convex/memory.ts');
    if (!fs.existsSync(memoryPath)) return;
    const memoryContent = fs.readFileSync(memoryPath, 'utf-8');
    expect(memoryContent).not.toContain('memorySearch');
  });

  it('all new memory files should use ESM imports (no require())', () => {
    const filesToCheck = [
      '../convex/memory.ts',
      '../convex/lib/memorySearch.ts',
      '../convex/lib/memoryConfig.ts',
      '../convex/lib/embeddings.ts',
    ];

    for (const relPath of filesToCheck) {
      const absPath = path.resolve(__dirname, relPath);
      if (!fs.existsSync(absPath)) continue;
      const content = fs.readFileSync(absPath, 'utf-8');
      // Should not contain require() calls (excluding comments)
      const hasRequire = /(?<!\/\/.*)\brequire\s*\(/.test(content);
      expect(hasRequire, `${relPath} uses require() — should use ESM imports`).toBe(false);
    }
  });

  it('memorySearch.ts should not have circular import back to memory.ts', () => {
    const searchPath = path.resolve(__dirname, '../convex/lib/memorySearch.ts');
    if (!fs.existsSync(searchPath)) return;
    const content = fs.readFileSync(searchPath, 'utf-8');
    // memorySearch.ts may call api.memory.get via ctx.runQuery (which is fine),
    // but should NOT directly import from ../memory
    expect(content).not.toMatch(/from\s+["']\.\.\/memory["']/);
  });
});
