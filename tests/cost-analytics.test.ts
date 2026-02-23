import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Group 1: Schema static analysis — usageEvents table
// ---------------------------------------------------------------------------

describe('AGE-19: usageEvents schema', () => {
  const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  it('usageEvents table exists in schema.ts', () => {
    expect(schemaContent).toContain('usageEvents:');
    expect(schemaContent).toContain('defineTable');
  });

  it('usageEvents table has agentId field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('agentId');
  });

  it('usageEvents table has projectId field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('projectId');
  });

  it('usageEvents table has threadId field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('threadId');
  });

  it('usageEvents table has model field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('model');
  });

  it('usageEvents table has inputTokens field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('inputTokens');
  });

  it('usageEvents table has outputTokens field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('outputTokens');
  });

  it('usageEvents table has costUsd field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('costUsd');
  });

  it('usageEvents table has timestamp field', () => {
    const tableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)\s*\.index/m;
    const match = schemaContent.match(tableRegex);
    expect(match, 'usageEvents table block not found').toBeTruthy();
    expect(match![0]).toContain('timestamp');
  });

  it('usageEvents table has byAgentId index', () => {
    const fullTableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byAgentId"/m;
    const match = schemaContent.match(fullTableRegex);
    expect(match, 'usageEvents should have byAgentId index').toBeTruthy();
  });

  it('usageEvents table has byTimestamp index', () => {
    const fullTableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byTimestamp"/m;
    const match = schemaContent.match(fullTableRegex);
    expect(match, 'usageEvents should have byTimestamp index').toBeTruthy();
  });

  it('usageEvents table has byModel index', () => {
    const fullTableRegex = /usageEvents:\s*defineTable\(\{[\s\S]*?\}\)[\s\S]*?\.index\("byModel"/m;
    const match = schemaContent.match(fullTableRegex);
    expect(match, 'usageEvents should have byModel index').toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Group 2: Cost computation — computeCost()
// ---------------------------------------------------------------------------

describe('AGE-19: computeCost()', () => {
  // Dynamic import so tests fail clearly if the file doesn't exist
  let computeCost: (model: string, inputTokens: number, outputTokens: number) => number;
  let MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }>;

  // Vitest doesn't support top-level await in describe, so we use a lazy loader
  async function loadModule() {
    if (!computeCost) {
      const mod = await import('../convex/lib/costAnalytics');
      computeCost = mod.computeCost;
      MODEL_PRICING = mod.MODEL_PRICING;
    }
  }

  it('MODEL_PRICING export exists and has expected keys', async () => {
    await loadModule();
    expect(MODEL_PRICING).toBeDefined();
    expect(MODEL_PRICING).toHaveProperty('anthropic/claude-sonnet-4-6');
    expect(MODEL_PRICING).toHaveProperty('anthropic/claude-opus-4-6');
    expect(MODEL_PRICING).toHaveProperty('openai/gpt-4o');
    expect(MODEL_PRICING).toHaveProperty('openai/gpt-4o-mini');
    expect(MODEL_PRICING).toHaveProperty('google/gemini-3.1-pro');
    expect(MODEL_PRICING).toHaveProperty('google/gemini-3-flash');
  });

  it('computeCost("anthropic/claude-sonnet-4-6", 1000, 500) returns correct cost', async () => {
    await loadModule();
    const pricing = MODEL_PRICING['anthropic/claude-sonnet-4-6'];
    const expected = (1000 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M;
    const result = computeCost('anthropic/claude-sonnet-4-6', 1000, 500);
    expect(result).toBeCloseTo(expected, 8);
    expect(result).toBeGreaterThan(0);
  });

  it('computeCost("anthropic/claude-opus-4-6", 1000, 500) returns correct cost', async () => {
    await loadModule();
    const pricing = MODEL_PRICING['anthropic/claude-opus-4-6'];
    const expected = (1000 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M;
    const result = computeCost('anthropic/claude-opus-4-6', 1000, 500);
    expect(result).toBeCloseTo(expected, 8);
    expect(result).toBeGreaterThan(0);
  });

  it('computeCost("openai/gpt-4o", 1000, 500) returns correct cost', async () => {
    await loadModule();
    const pricing = MODEL_PRICING['openai/gpt-4o'];
    const expected = (1000 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M;
    const result = computeCost('openai/gpt-4o', 1000, 500);
    expect(result).toBeCloseTo(expected, 8);
    expect(result).toBeGreaterThan(0);
  });

  it('computeCost("openai/gpt-4o-mini", 1000, 500) returns correct cost', async () => {
    await loadModule();
    const pricing = MODEL_PRICING['openai/gpt-4o-mini'];
    const expected = (1000 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M;
    const result = computeCost('openai/gpt-4o-mini', 1000, 500);
    expect(result).toBeCloseTo(expected, 8);
    expect(result).toBeGreaterThan(0);
  });

  it('computeCost("google/gemini-3.1-pro", 1000, 500) returns correct cost', async () => {
    await loadModule();
    const pricing = MODEL_PRICING['google/gemini-3.1-pro'];
    const expected = (1000 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M;
    const result = computeCost('google/gemini-3.1-pro', 1000, 500);
    expect(result).toBeCloseTo(expected, 8);
    expect(result).toBeGreaterThan(0);
  });

  it('computeCost("google/gemini-3-flash", 1000, 500) returns correct cost', async () => {
    await loadModule();
    const pricing = MODEL_PRICING['google/gemini-3-flash'];
    const expected = (1000 / 1_000_000) * pricing.inputPer1M + (500 / 1_000_000) * pricing.outputPer1M;
    const result = computeCost('google/gemini-3-flash', 1000, 500);
    expect(result).toBeCloseTo(expected, 8);
    expect(result).toBeGreaterThan(0);
  });

  it('computeCost("unknown/model", 1000, 500) returns 0 (graceful fallback)', async () => {
    await loadModule();
    const result = computeCost('unknown/model', 1000, 500);
    expect(result).toBe(0);
  });

  it('computeCost with 0 input and 0 output tokens returns 0', async () => {
    await loadModule();
    const result = computeCost('anthropic/claude-sonnet-4-6', 0, 0);
    expect(result).toBe(0);
  });

  it('claude-opus-4-6 is more expensive than claude-sonnet-4-6', async () => {
    await loadModule();
    const opusCost = computeCost('anthropic/claude-opus-4-6', 1000, 500);
    const sonnetCost = computeCost('anthropic/claude-sonnet-4-6', 1000, 500);
    expect(opusCost).toBeGreaterThan(sonnetCost);
  });

  it('gpt-4o-mini is cheaper than gpt-4o', async () => {
    await loadModule();
    const miniCost = computeCost('openai/gpt-4o-mini', 1000, 500);
    const fullCost = computeCost('openai/gpt-4o', 1000, 500);
    expect(miniCost).toBeLessThan(fullCost);
  });
});

// ---------------------------------------------------------------------------
// Group 3: Analytics — aggregateUsage()
// ---------------------------------------------------------------------------

describe('AGE-19: aggregateUsage()', () => {
  type UsageEvent = {
    agentId: string;
    projectId?: string;
    threadId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    timestamp: number;
  };

  let aggregateUsage: (
    events: UsageEvent[],
    groupBy: 'model' | 'agentId' | 'projectId'
  ) => Record<string, { totalCost: number; totalInputTokens: number; totalOutputTokens: number; count: number }>;

  async function loadModule() {
    if (!aggregateUsage) {
      const mod = await import('../convex/lib/costAnalytics');
      aggregateUsage = mod.aggregateUsage;
    }
  }

  const sampleEvents: UsageEvent[] = [
    {
      agentId: 'agent-1',
      projectId: 'proj-1',
      model: 'anthropic/claude-sonnet-4-6',
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.010500,
      timestamp: 1000,
    },
    {
      agentId: 'agent-1',
      projectId: 'proj-1',
      model: 'anthropic/claude-sonnet-4-6',
      inputTokens: 2000,
      outputTokens: 800,
      costUsd: 0.018000,
      timestamp: 2000,
    },
    {
      agentId: 'agent-2',
      projectId: 'proj-2',
      model: 'openai/gpt-4o',
      inputTokens: 500,
      outputTokens: 300,
      costUsd: 0.004250,
      timestamp: 3000,
    },
  ];

  it('aggregateUsage() groups and sums costs by model', async () => {
    await loadModule();
    const result = aggregateUsage(sampleEvents, 'model');

    expect(result).toHaveProperty('anthropic/claude-sonnet-4-6');
    expect(result).toHaveProperty('openai/gpt-4o');

    const sonnetGroup = result['anthropic/claude-sonnet-4-6'];
    expect(sonnetGroup.count).toBe(2);
    expect(sonnetGroup.totalInputTokens).toBe(3000);
    expect(sonnetGroup.totalOutputTokens).toBe(1300);
    expect(sonnetGroup.totalCost).toBeCloseTo(0.010500 + 0.018000, 6);

    const gptGroup = result['openai/gpt-4o'];
    expect(gptGroup.count).toBe(1);
    expect(gptGroup.totalInputTokens).toBe(500);
    expect(gptGroup.totalOutputTokens).toBe(300);
    expect(gptGroup.totalCost).toBeCloseTo(0.004250, 6);
  });

  it('aggregateUsage() groups and sums costs by agentId', async () => {
    await loadModule();
    const result = aggregateUsage(sampleEvents, 'agentId');

    expect(result).toHaveProperty('agent-1');
    expect(result).toHaveProperty('agent-2');

    const agent1Group = result['agent-1'];
    expect(agent1Group.count).toBe(2);
    expect(agent1Group.totalInputTokens).toBe(3000);
    expect(agent1Group.totalOutputTokens).toBe(1300);
    expect(agent1Group.totalCost).toBeCloseTo(0.010500 + 0.018000, 6);

    const agent2Group = result['agent-2'];
    expect(agent2Group.count).toBe(1);
  });

  it('aggregateUsage() groups and sums costs by projectId', async () => {
    await loadModule();
    const result = aggregateUsage(sampleEvents, 'projectId');

    expect(result).toHaveProperty('proj-1');
    expect(result).toHaveProperty('proj-2');

    const proj1Group = result['proj-1'];
    expect(proj1Group.count).toBe(2);

    const proj2Group = result['proj-2'];
    expect(proj2Group.count).toBe(1);
  });

  it('aggregateUsage() handles empty input', async () => {
    await loadModule();
    const result = aggregateUsage([], 'model');
    expect(result).toEqual({});
  });

  it('aggregateUsage() events with missing projectId are grouped under "unknown"', async () => {
    await loadModule();
    const eventsWithMissingProject: UsageEvent[] = [
      {
        agentId: 'agent-3',
        model: 'openai/gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.000045,
        timestamp: 4000,
      },
    ];
    const result = aggregateUsage(eventsWithMissingProject, 'projectId');
    expect(result).toHaveProperty('unknown');
    expect(result['unknown'].count).toBe(1);
  });
});
