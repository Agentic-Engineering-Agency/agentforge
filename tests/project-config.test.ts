import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: convex/projects.ts data contract validation
// ---------------------------------------------------------------------------

describe('SPEC-002: convex/projects.ts data contract', () => {
  const projectsPath = path.resolve(__dirname, '../convex/projects.ts');
  let projectsContent: string;

  beforeAll(() => {
    projectsContent = fs.readFileSync(projectsPath, 'utf-8');
  });

  describe('exported functions', () => {
    it('should export assignAgent mutation', () => {
      expect(projectsContent).toContain('export const assignAgent');
      expect(projectsContent).toContain('mutation(');
    });

    it('should export unassignAgent mutation', () => {
      expect(projectsContent).toContain('export const unassignAgent');
    });

    it('should export getAgents query', () => {
      expect(projectsContent).toContain('export const getAgents');
      expect(projectsContent).toContain('query(');
    });

    it('should export getAllAgents query', () => {
      expect(projectsContent).toContain('export const getAllAgents');
    });

    it('should export getProjectSettings query', () => {
      expect(projectsContent).toContain('export const getProjectSettings');
    });
  });

  describe('assignAgent mutation contract', () => {
    it('should accept id (project) and agentId args', () => {
      expect(projectsContent).toContain('v.id("projects")');
      expect(projectsContent).toContain('agentId: v.string()');
    });

    it('should use Set to prevent duplicate assignment', () => {
      expect(projectsContent).toContain('new Set');
    });

    it('should throw if project not found', () => {
      expect(projectsContent).toContain('Project not found');
    });
  });

  describe('unassignAgent mutation contract', () => {
    it('should filter the agentId from the array', () => {
      expect(projectsContent).toContain('.filter(');
    });

    it('should throw if project not found', () => {
      // Already covered by general check, but verify the function has its own check
      const unassignBlock = projectsContent.slice(
        projectsContent.indexOf('export const unassignAgent')
      );
      expect(unassignBlock).toContain('Project not found');
    });
  });

  describe('getAgents query contract', () => {
    it('should lookup agents by agentIds stored on the project', () => {
      expect(projectsContent).toContain('project.agentIds');
    });

    it('should return empty array when no agents assigned', () => {
      expect(projectsContent).toContain('return []');
    });

    it('should use byAgentId index for lookup', () => {
      expect(projectsContent).toContain('byAgentId');
    });
  });

  describe('getProjectSettings query contract', () => {
    it('should return settings fields from the project', () => {
      const getSettingsBlock = projectsContent.slice(
        projectsContent.indexOf('export const getProjectSettings')
      );
      expect(getSettingsBlock).toContain('systemPrompt');
      expect(getSettingsBlock).toContain('defaultModel');
      expect(getSettingsBlock).toContain('defaultProvider');
    });
  });

  describe('updateSettings mutation contract', () => {
    it('should accept systemPrompt, defaultModel, defaultProvider', () => {
      expect(projectsContent).toContain('systemPrompt: v.optional(v.string())');
      expect(projectsContent).toContain('defaultModel: v.optional(v.string())');
      expect(projectsContent).toContain('defaultProvider: v.optional(v.string())');
    });

    it('should store settings as top-level fields on the project document', () => {
      const updateSettingsBlock = projectsContent.slice(
        projectsContent.indexOf('export const updateSettings')
      );
      expect(updateSettingsBlock).toContain('ctx.db.patch');
    });
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: configCascade resolution
// ---------------------------------------------------------------------------

describe('SPEC-002: Config cascade — resolveConfig', () => {
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

  it('SYSTEM_DEFAULTS.model should be openai/gpt-4o', () => {
    expect(SYSTEM_DEFAULTS.model).toBe('openai/gpt-4o');
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
    expect(result.failoverModels).toEqual(agentFailover);
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: Template sync — all 4 locations must be identical
// ---------------------------------------------------------------------------

describe('SPEC-002: Template sync — projects.ts in all 4 locations', () => {
  const locations = [
    'convex/projects.ts',
    'packages/cli/templates/default/convex/projects.ts',
    'packages/cli/dist/default/convex/projects.ts',
    'templates/default/convex/projects.ts',
  ];

  const rootDir = path.resolve(__dirname, '..');
  const contents: Record<string, string> = {};

  beforeAll(() => {
    for (const loc of locations) {
      const fullPath = path.join(rootDir, loc);
      if (fs.existsSync(fullPath)) {
        contents[loc] = fs.readFileSync(fullPath, 'utf-8');
      }
    }
  });

  it('canonical source should exist', () => {
    expect(contents['packages/cli/templates/default/convex/projects.ts']).toBeTruthy();
  });

  it('all 4 locations should have identical content', () => {
    const canonical = contents['packages/cli/templates/default/convex/projects.ts'];
    for (const loc of locations) {
      if (contents[loc]) {
        expect(contents[loc], `${loc} should match canonical`).toBe(canonical);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: Schema — projects table fields
// ---------------------------------------------------------------------------

describe('SPEC-002: projects schema completeness', () => {
  const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  it('projects table should have agentIds field', () => {
    expect(schemaContent).toContain('agentIds: v.optional(v.array(v.string()))');
  });

  it('projects table should have systemPrompt field', () => {
    expect(schemaContent).toContain('systemPrompt: v.optional(v.string())');
  });

  it('projects table should have defaultModel field', () => {
    expect(schemaContent).toContain('defaultModel: v.optional(v.string())');
  });

  it('projects table should have defaultProvider field', () => {
    expect(schemaContent).toContain('defaultProvider: v.optional(v.string())');
  });

  it('projects table should have settings field', () => {
    expect(schemaContent).toContain('settings: v.optional(v.any())');
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Dashboard projects route consistency
// ---------------------------------------------------------------------------

describe('SPEC-002: Dashboard projects route — no placeholder logic', () => {
  const dashboardLocations = [
    'packages/cli/templates/default/dashboard/app/routes/projects.tsx',
    'packages/web/app/routes/projects.tsx',
  ];

  const rootDir = path.resolve(__dirname, '..');

  for (const loc of dashboardLocations) {
    describe(loc, () => {
      let content: string;

      beforeAll(() => {
        content = fs.readFileSync(path.join(rootDir, loc), 'utf-8');
      });

      it('should use api.projects.assignAgent', () => {
        expect(content).toContain('api.projects.assignAgent');
      });

      it('should use api.projects.unassignAgent', () => {
        expect(content).toContain('api.projects.unassignAgent');
      });

      it('should use api.projects.updateSettings', () => {
        expect(content).toContain('api.projects.updateSettings');
      });

      it('should use api.projects.getAllAgents', () => {
        expect(content).toContain('api.projects.getAllAgents');
      });

      it('should NOT contain hardcoded mock/placeholder data', () => {
        expect(content).not.toContain('mockProjects');
        expect(content).not.toContain('placeholderAgents');
        expect(content).not.toContain('dummySettings');
        expect(content).not.toContain('TODO: replace with real data');
      });

      it('should read real Convex queries for project data', () => {
        expect(content).toContain('useQuery(api.projects.list');
        expect(content).toContain('useQuery(api.projects.getAllAgents');
      });
    });
  }
});
