import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: Schema Validation (static analysis of convex/schema.ts)
// ---------------------------------------------------------------------------

describe('AGE-106: Project-Scoped Schema', () => {
  const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  const projectScopedTables = [
    'agents', 'skills', 'cronJobs', 'mcpConnections',
    'usage', 'logs', 'channels', 'instances',
  ];

  describe('projectId field', () => {
    for (const table of projectScopedTables) {
      it(`${table} table should have projectId field`, () => {
        // Find the table definition block and check it contains projectId
        // Use a greedy match up to the .index() chain to capture nested v.object() blocks
        const tableRegex = new RegExp(`${table}:\\s*defineTable\\(\\{[\\s\\S]*?\\}\\)\\s*\\.index`, 'm');
        const match = schemaContent.match(tableRegex);
        expect(match, `Table ${table} not found in schema`).toBeTruthy();
        expect(match![0]).toContain('projectId');
        expect(match![0]).toContain('v.optional(v.id("projects"))');
      });
    }
  });

  describe('byProjectId index', () => {
    for (const table of projectScopedTables) {
      it(`${table} table should have byProjectId index`, () => {
        // The index is defined after the table definition using .index()
        const fullTableRegex = new RegExp(
          `${table}:\\s*defineTable\\(\\{[\\s\\S]*?\\}\\)[\\s\\S]*?\\.index\\("byProjectId"`,
          'm',
        );
        const match = schemaContent.match(fullTableRegex);
        expect(match, `Table ${table} should have byProjectId index`).toBeTruthy();
      });
    }
  });

  describe('projects table enhancements', () => {
    it('projects table should have isDefault field', () => {
      const projectsRegex = /projects:\s*defineTable\(\{[\s\S]*?\}\)/m;
      const match = schemaContent.match(projectsRegex);
      expect(match).toBeTruthy();
      expect(match![0]).toContain('isDefault');
    });

    it('projects table should have deletedAt field', () => {
      const projectsRegex = /projects:\s*defineTable\(\{[\s\S]*?\}\)/m;
      const match = schemaContent.match(projectsRegex);
      expect(match).toBeTruthy();
      expect(match![0]).toContain('deletedAt');
    });
  });

  describe('projectMembers table', () => {
    it('should exist in schema', () => {
      expect(schemaContent).toContain('projectMembers');
    });

    it('should have role field with owner/editor/viewer', () => {
      expect(schemaContent).toContain('v.literal("owner")');
      expect(schemaContent).toContain('v.literal("editor")');
      expect(schemaContent).toContain('v.literal("viewer")');
    });
  });

  describe('tables that should NOT have projectId', () => {
    const globalTables = ['apiKeys', 'settings', 'vault'];
    for (const table of globalTables) {
      it(`${table} should NOT have projectId (global-only)`, () => {
        const tableRegex = new RegExp(`${table}:\\s*defineTable\\(\\{([\\s\\S]*?)\\}\\)`, 'm');
        const match = schemaContent.match(tableRegex);
        if (match) {
          expect(match[1]).not.toContain('projectId');
        }
      });
    }

    const derivedTables = ['messages', 'sessions', 'cronJobRuns', 'heartbeats', 'vaultAuditLog'];
    for (const table of derivedTables) {
      it(`${table} should NOT have projectId (derived table)`, () => {
        const tableRegex = new RegExp(`${table}:\\s*defineTable\\(\\{([\\s\\S]*?)\\}\\)`, 'm');
        const match = schemaContent.match(tableRegex);
        if (match) {
          expect(match[1]).not.toContain('projectId');
        }
      });
    }
  });

  describe('backward compatibility', () => {
    it('projectId should be optional (v.optional) in all tables', () => {
      // Every projectId in modified tables should be v.optional
      for (const table of projectScopedTables) {
        const tableRegex = new RegExp(`${table}:\\s*defineTable\\(\\{[\\s\\S]*?\\}\\)`, 'm');
        const match = schemaContent.match(tableRegex);
        if (match && match[0].includes('projectId')) {
          expect(match[0]).toContain('v.optional(v.id("projects"))');
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: Config Cascade Resolution
// ---------------------------------------------------------------------------

describe('AGE-106: Config Cascade Resolution', () => {
  let resolveConfig: (
    agentConfig: Record<string, unknown>,
    projectConfig: Record<string, unknown> | null,
    globalConfig: Record<string, unknown> | null,
  ) => Record<string, unknown>;
  let SYSTEM_DEFAULTS: Record<string, unknown>;

  beforeAll(async () => {
    const mod = await import('../convex/lib/configCascade');
    resolveConfig = mod.resolveConfig;
    SYSTEM_DEFAULTS = mod.SYSTEM_DEFAULTS;
  });

  it('should use agent config when all levels provided', () => {
    const result = resolveConfig(
      { model: 'anthropic/claude-sonnet-4-6', temperature: 0.5, maxTokens: 2048, instructions: 'Agent instructions' },
      { defaultModel: 'openai/gpt-4o-mini', defaultTemperature: 0.8 },
      { defaultModel: 'google/gemini-2.0-flash' },
    );
    expect(result.model).toBe('anthropic/claude-sonnet-4-6');
    expect(result.temperature).toBe(0.5);
    expect(result.maxTokens).toBe(2048);
  });

  it('should fall through to project config when agent has no value', () => {
    const result = resolveConfig(
      { instructions: 'Do stuff' },
      { defaultModel: 'openai/gpt-4o-mini', defaultTemperature: 0.9 },
      { defaultModel: 'google/gemini-2.0-flash' },
    );
    expect(result.model).toBe('openai/gpt-4o-mini');
    expect(result.temperature).toBe(0.9);
  });

  it('should fall through to global config when agent and project have no value', () => {
    const result = resolveConfig(
      { instructions: 'Do stuff' },
      {},
      { defaultModel: 'google/gemini-2.0-flash', defaultTemperature: 0.3 },
    );
    expect(result.model).toBe('google/gemini-2.0-flash');
    expect(result.temperature).toBe(0.3);
  });

  it('should use system defaults when no other config exists', () => {
    const result = resolveConfig({ instructions: '' }, null, null);
    expect(result.model).toBe('openai/gpt-4o');
    expect(result.temperature).toBe(0.7);
    expect(result.maxTokens).toBe(4096);
    expect(result.failoverModels).toEqual([]);
  });

  it('should prepend instruction prefix from project to agent instructions', () => {
    const result = resolveConfig(
      { instructions: 'Handle billing.' },
      { instructionPrefix: 'You work for Acme Corp.' },
      null,
    );
    expect(result.systemPrompt).toBe('You work for Acme Corp.\n\nHandle billing.');
  });

  it('should use global instruction prefix if project has none', () => {
    const result = resolveConfig(
      { instructions: 'Be helpful.' },
      {},
      { instructionPrefix: 'Global prefix.' },
    );
    expect(result.systemPrompt).toBe('Global prefix.\n\nBe helpful.');
  });

  it('should not add prefix when none exists', () => {
    const result = resolveConfig(
      { instructions: 'Just instructions.' },
      {},
      {},
    );
    expect(result.systemPrompt).toBe('Just instructions.');
  });

  it('failover models should not merge across levels', () => {
    const agentFailover = [{ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }];
    const projectFailover = [{ provider: 'openai', model: 'gpt-4o-mini' }];
    const result = resolveConfig(
      { instructions: '', failoverModels: agentFailover },
      { failoverModels: projectFailover },
      null,
    );
    // Should use agent's failover, NOT merge
    expect(result.failoverModels).toEqual(agentFailover);
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: Migration Script Existence
// ---------------------------------------------------------------------------

describe('AGE-106: Migration Script', () => {
  const migrationPath = path.resolve(__dirname, '../convex/migrations/addProjectScoping.ts');

  it('migration file should exist', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('migration should export createDefaultProjects', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('createDefaultProjects');
  });

  it('migration should export backfillProjectIds', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('backfillProjectIds');
  });

  it('migration should handle idempotency', () => {
    const content = fs.readFileSync(migrationPath, 'utf-8');
    // Should check for undefined projectId before updating
    expect(content).toContain('projectId');
    expect(content).toContain('undefined');
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: Query Layer Validation
// ---------------------------------------------------------------------------

describe('AGE-106: Query Layer Updates', () => {
  const queryFiles = [
    { file: 'convex/agents.ts', table: 'agents' },
    { file: 'convex/skills.ts', table: 'skills' },
    { file: 'convex/cronJobs.ts', table: 'cronJobs' },
    { file: 'convex/mcpConnections.ts', table: 'mcpConnections' },
    { file: 'convex/usage.ts', table: 'usage' },
    { file: 'convex/logs.ts', table: 'logs' },
  ];

  for (const { file, table } of queryFiles) {
    describe(file, () => {
      it('list query should accept projectId parameter', () => {
        const filePath = path.resolve(__dirname, '..', file);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain('projectId');
        expect(content).toContain('v.optional(v.id("projects"))');
      });

      it('should use project-scoped index when projectId provided', () => {
        const filePath = path.resolve(__dirname, '..', file);
        const content = fs.readFileSync(filePath, 'utf-8');
        // logs.ts uses compound byProjectAndTimestamp; others use byProjectId
        expect(
          content.includes('byProjectId') || content.includes('byProjectAndTimestamp'),
          `${file} should use a project-scoped index`
        ).toBeTruthy();
      });
    });
  }
});
