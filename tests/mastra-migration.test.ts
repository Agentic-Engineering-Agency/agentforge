import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

describe('Mastra Migration - No @ai-sdk imports', () => {
  const projectRoot = join(__dirname, '..');

  // Helper to read all .ts files in a directory
  function getTypeScriptFiles(dir: string): string[] {
    try {
      return readdirSync(dir, { recursive: true })
        .filter((f): f is string => typeof f === 'string' && f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .map(f => join(dir, f));
    } catch { return []; }
  }

  it('convex/ should have no @ai-sdk imports', () => {
    const files = getTypeScriptFiles(join(projectRoot, 'convex'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/@ai-sdk\//);
      // Also check for dynamic import("ai") — the Vercel AI SDK generateText
      expect(content).not.toMatch(/import\(["']ai["']\)/);
    }
  });

  it('packages/core/src/agent.ts should have no ai SDK type imports', () => {
    const content = readFileSync(join(projectRoot, 'packages/core/src/agent.ts'), 'utf-8');
    expect(content).not.toMatch(/from ['"]ai['"]/);
    expect(content).not.toMatch(/@ai-sdk\//);
  });

  it('packages/core/package.json should not depend on "ai"', () => {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'packages/core/package.json'), 'utf-8'));
    expect(pkg.dependencies).not.toHaveProperty('ai');
    expect(Object.keys(pkg.dependencies || {})).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^@ai-sdk\//)])
    );
  });

  it('packages/core/package.json should have @mastra/core ^1.5.0', () => {
    const pkg = JSON.parse(readFileSync(join(projectRoot, 'packages/core/package.json'), 'utf-8'));
    expect(pkg.dependencies['@mastra/core']).toBe('^1.5.0');
  });

  it('convex/mastraIntegration.ts should use Mastra Agent', () => {
    const content = readFileSync(join(projectRoot, 'convex/mastraIntegration.ts'), 'utf-8');
    expect(content).toMatch(/from ['"]@mastra\/core\/agent['"]/);
    expect(content).not.toContain('resolveModel');
  });

  it('convex/chat.ts should use Mastra Agent', () => {
    const content = readFileSync(join(projectRoot, 'convex/chat.ts'), 'utf-8');
    expect(content).toMatch(/from ['"]@mastra\/core\/agent['"]/);
    expect(content).not.toContain('resolveModel');
  });

  it('CLI templates should also be migrated', () => {
    const templateDir = join(projectRoot, 'packages/cli/templates/default/convex');
    const files = getTypeScriptFiles(templateDir);
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/@ai-sdk\//);
      expect(content).not.toMatch(/import\(["']ai["']\)/);
    }
  });
});
