import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * SPEC-20260313-003: Fix Agent Selection in Project Configuration
 * GitHub Issue: #216
 *
 * These tests verify that the agent-selection bug is fixed:
 * - detailProject must be derived from the live Convex subscription, not stored as stale state
 * - No manual optimistic setDetailProject calls should exist (Convex handles reactivity)
 */

const projectsRoutePath = resolve(__dirname, '../packages/web/app/routes/projects.tsx');
const templateRoutePath = resolve(__dirname, '../packages/cli/templates/default/dashboard/app/routes/projects.tsx');
const distRoutePath = resolve(__dirname, '../packages/cli/dist/default/dashboard/app/routes/projects.tsx');

describe('SPEC-20260313-003: Agent Selection Fix', () => {
  const source = readFileSync(projectsRoutePath, 'utf-8');

  describe('Stale state pattern eliminated', () => {
    it('should NOT store detailProject as direct useState', () => {
      // The bug: useState<any>(null) creates a stale snapshot
      expect(source).not.toMatch(/const \[detailProject, setDetailProject\] = useState/);
    });

    it('should store only the project ID in state', () => {
      expect(source).toMatch(/detailProjectId/);
    });

    it('should derive detailProject from the live projects array', () => {
      expect(source).toMatch(/projects\.find/);
    });
  });

  describe('No manual optimistic state updates', () => {
    it('should NOT manually patch agentIds via setDetailProject', () => {
      // The bug: manual optimistic updates created parallel state that drifted
      expect(source).not.toMatch(/setDetailProject\(\(current/);
    });

    it('handleToggleAgent should only call mutations, not patch state', () => {
      // assignAgent and unassignAgent mutations should be called directly
      // Convex subscription handles the UI update reactively
      expect(source).toMatch(/await assignAgent\(/);
      expect(source).toMatch(/await unassignAgent\(/);
    });
  });

  describe('Close handler clears ID, not object', () => {
    it('should clear detailProjectId on close', () => {
      expect(source).toMatch(/setDetailProjectId\(null\)/);
    });
  });

  describe('Template sync (CLAUDE.md Rule 6)', () => {
    it('template should match packages/web version', () => {
      const templateSource = readFileSync(templateRoutePath, 'utf-8');
      expect(templateSource).toBe(source);
    });

    it('dist should match packages/web version', () => {
      const distSource = readFileSync(distRoutePath, 'utf-8');
      expect(distSource).toBe(source);
    });
  });
});
