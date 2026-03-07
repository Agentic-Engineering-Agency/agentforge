import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const cliRoot = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(cliRoot, '..', '..');

function listFiles(root: string, current = root): string[] {
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      return listFiles(root, fullPath);
    }
    return [path.relative(root, fullPath)];
  });
}

describe('template sync', () => {
  it('keeps the canonical dashboard template mirrored into dist', () => {
    const templateRoot = path.join(repoRoot, 'packages/cli/templates/default/dashboard');
    const distRoot = path.join(repoRoot, 'packages/cli/dist/default/dashboard');

    for (const relativeFile of listFiles(templateRoot)) {
      const templatePath = path.join(templateRoot, relativeFile);
      const distPath = path.join(distRoot, relativeFile);
      expect(existsSync(distPath), `${relativeFile} should exist in dist dashboard`).toBe(true);
      expect(readFileSync(distPath, 'utf-8')).toBe(readFileSync(templatePath, 'utf-8'));
    }
  });

  it('copies the canonical dashboard template into packages/web', () => {
    const templateRoot = path.join(repoRoot, 'packages/cli/templates/default/dashboard');
    const webRoot = path.join(repoRoot, 'packages/web');

    for (const relativeFile of listFiles(templateRoot)) {
      const templatePath = path.join(templateRoot, relativeFile);
      const webPath = path.join(webRoot, relativeFile);
      expect(existsSync(webPath), `${relativeFile} should exist in packages/web`).toBe(true);
      expect(readFileSync(webPath, 'utf-8')).toBe(readFileSync(templatePath, 'utf-8'));
    }
  });

  it('removes the legacy Convex workflow engine shims from the canonical template', () => {
    expect(existsSync(path.join(repoRoot, 'packages/cli/templates/default/convex/workflowEngine.ts'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'packages/cli/templates/default/convex/lib/workflowEngine.ts'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'packages/cli/templates/default/convex/lib/pipeline.ts'))).toBe(false);
  });

  it('routes workflow execution through the daemon endpoint', () => {
    const commandSource = readFileSync(path.join(repoRoot, 'packages/cli/src/commands/workflows.ts'), 'utf-8');
    expect(commandSource).not.toContain('workflowEngine:executeWorkflow');
    expect(commandSource).toContain('/v1/workflows/runs/');
  });
});
