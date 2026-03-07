import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveWorkspaceSkillsBasePath } from './runtime-workspace.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('resolveWorkspaceSkillsBasePath', () => {
  it('uses the project skills directory when it contains skills', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-runtime-workspace-'));
    tempDirs.push(tempDir);

    await fs.ensureDir(path.join(tempDir, 'skills', 'browser-automation'));
    await fs.writeFile(path.join(tempDir, 'skills', 'browser-automation', 'SKILL.md'), '# Browser', 'utf-8');

    expect(resolveWorkspaceSkillsBasePath(tempDir)).toBe(path.join(tempDir, 'skills'));
  });

  it('falls back to the canonical template skills when the local skills directory is empty', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-runtime-workspace-'));
    tempDirs.push(tempDir);

    await fs.ensureDir(path.join(tempDir, 'skills'));
    await fs.ensureDir(path.join(tempDir, 'packages', 'cli', 'templates', 'default', 'skills', 'browser-automation'));
    await fs.writeFile(
      path.join(tempDir, 'packages', 'cli', 'templates', 'default', 'skills', 'browser-automation', 'SKILL.md'),
      '# Browser',
      'utf-8',
    );

    expect(resolveWorkspaceSkillsBasePath(tempDir)).toBe(
      path.join(tempDir, 'packages', 'cli', 'templates', 'default', 'skills'),
    );
  });

  it('falls back to the project skills path when no local or canonical template skills exist', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-runtime-workspace-'));
    tempDirs.push(tempDir);

    expect(resolveWorkspaceSkillsBasePath(tempDir)).toBe(path.join(tempDir, 'skills'));
  });
});
