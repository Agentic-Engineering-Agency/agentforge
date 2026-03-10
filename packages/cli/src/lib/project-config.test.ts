import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadProjectConfig } from './project-config.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir)));
});

describe('loadProjectConfig', () => {
  it('falls back to the canonical template config when the repo root has no local config', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-project-config-'));
    tempDirs.push(tempDir);

    const templateDir = path.join(tempDir, 'packages', 'cli', 'templates', 'default');
    await fs.ensureDir(templateDir);
    await fs.writeFile(
      path.join(templateDir, 'agentforge.config.ts'),
      `export default {
        daemon: { defaultModel: 'openai/gpt-5.1-chat-latest' },
        workspace: { basePath: './workspace', skills: ['/skills'], search: true },
      };`,
      'utf-8',
    );

    const config = await loadProjectConfig(tempDir);

    expect(config?.daemon?.defaultModel).toBe('openai/gpt-5.1-chat-latest');
    expect(config?.workspace?.basePath).toBe('./workspace');
    expect(config?.workspace?.skills).toEqual(['/skills']);
  });
});
