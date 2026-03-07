import { describe, expect, it } from 'vitest';
import { AgentForgeWorkspace } from './workspace.js';

describe('AgentForgeWorkspace compatibility helpers', () => {
  it('supports index and search for legacy callers', async () => {
    const workspace = AgentForgeWorkspace.local({ basePath: '/tmp/agentforge-compat-workspace' });

    await workspace.index('doc-1', 'AgentForge helps build AI agents');
    await workspace.index('doc-2', 'Vitest is used for TypeScript testing');

    const results = await workspace.search('AI agents');
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]).toMatchObject({ id: 'doc-1' });
  });
});
