import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadExecutableSkillTools } from './executable-skill-loader.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('loadExecutableSkillTools', () => {
  it('loads executable tools from skill entry modules', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-skill-tools-'));
    tempDirs.push(tempDir);

    const skillDir = path.join(tempDir, 'browser-automation');
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, 'index.ts'),
      `
        export const tools = [
          {
            name: 'browser',
            description: 'Test browser tool',
            handler: async (input) => ({ ok: true, received: input }),
          },
        ];
      `,
      'utf-8',
    );

    const tools = await loadExecutableSkillTools(tempDir);
    expect(Object.keys(tools)).toEqual(['browser']);

    const result = await tools.browser.execute({ url: 'https://example.com' });
    expect(result).toEqual({ ok: true, received: { url: 'https://example.com' } });
  });

  it('prefixes duplicate tool names with the skill name', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-skill-tools-'));
    tempDirs.push(tempDir);

    for (const [skillName, value] of [
      ['alpha', 'one'],
      ['beta', 'two'],
    ] as const) {
      const skillDir = path.join(tempDir, skillName);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, 'index.ts'),
        `
          export const tools = [
            {
              name: 'shared',
              handler: async () => '${value}',
            },
          ];
        `,
        'utf-8',
      );
    }

    const tools = await loadExecutableSkillTools(tempDir);
    expect(Object.keys(tools).sort()).toEqual(['beta__shared', 'shared']);
    await expect(tools.shared.execute({})).resolves.toBe('one');
    await expect(tools['beta__shared'].execute({})).resolves.toBe('two');
  });

  it('ignores skills without executable entry files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-skill-tools-'));
    tempDirs.push(tempDir);

    await fs.mkdir(path.join(tempDir, 'docs-only-skill'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'docs-only-skill', 'SKILL.md'), '# Docs only', 'utf-8');

    await expect(loadExecutableSkillTools(tempDir)).resolves.toEqual({});
  });
});
