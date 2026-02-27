/**
 * Cron Scheduling UI Tests (AGE-146)
 *
 * Tests for the cron jobs dashboard UI and Convex backend.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const DIST_CRON_JOBS = resolve(root, 'packages/cli/dist/default/convex/cronJobs.ts');
const DIST_CRON_UI = resolve(root, 'packages/cli/dist/default/dashboard/app/routes/cron.tsx');
const TMPL_CRON_JOBS = resolve(root, 'packages/cli/templates/default/convex/cronJobs.ts');
const TMPL_CRON_UI = resolve(root, 'packages/cli/templates/default/dashboard/app/routes/cron.tsx');

describe('Cron Jobs - Convex Functions', () => {
  describe('triggerNow action', () => {
    it('should have triggerNow function exported from cronJobs', () => {
      const content = readFileSync(DIST_CRON_JOBS, 'utf-8');
      expect(content).toContain('export const triggerNow');
      expect(content).toContain('args: { id: v.id("cronJobs") }');
      expect(content).toContain('action({');
      expect(content).toContain('api.agents.run');
    });

    it('should record run as "running" first, then execute agent', () => {
      const content = readFileSync(DIST_CRON_JOBS, 'utf-8');
      expect(content).toContain('status: "running"');
      expect(content).toContain('finalStatus: "success"');
      expect(content).toContain('finalStatus = "failed"');
    });
  });

  describe('getRunHistory query', () => {
    it('should exist and accept cronJobId and optional limit', () => {
      const content = readFileSync(DIST_CRON_JOBS, 'utf-8');
      expect(content).toContain('export const getRunHistory');
      expect(content).toContain('cronJobId: v.id("cronJobs")');
      expect(content).toContain('limit: v.optional(v.number())');
    });

    it('should return runs sorted by startedAt descending', () => {
      const content = readFileSync(DIST_CRON_JOBS, 'utf-8');
      expect(content).toContain('runs.sort((a, b) => b.startedAt - a.startedAt)');
    });
  });
});

describe('Cron UI - Dashboard Page', () => {
  it('should have Run Now button with loading state', () => {
    const content = readFileSync(DIST_CRON_UI, 'utf-8');
    expect(content).toContain('const triggerNow = useMutation(api.cronJobs.triggerNow)');
    expect(content).toContain('runningJobId');
    expect(content).toContain('Loader2');
    expect(content).toContain('disabled={!job.isEnabled || runningJobId === job._id}');
  });

  it('should display next run time in human-readable format', () => {
    const content = readFileSync(DIST_CRON_UI, 'utf-8');
    expect(content).toContain('formatNextRun');
    expect(content).toContain('Next Run');
    expect(content).toContain('In less than a minute');
    expect(content).toContain('minute');
    expect(content).toContain('hour');
    expect(content).toContain('day');
  });

  it('should display agent name instead of agentId', () => {
    const content = readFileSync(DIST_CRON_UI, 'utf-8');
    expect(content).toContain('agentMap');
    expect(content).toContain('new Map(agents.map');
    expect(content).toContain('const agent = agentMap.get(job.agentId)');
    expect(content).toContain('agent?.name || job.agentId');
  });

  it('should show run history panel with status indicators', () => {
    const content = readFileSync(DIST_CRON_UI, 'utf-8');
    expect(content).toContain('RunHistoryPanel');
    expect(content).toContain('api.cronJobs.getRunHistory');
    expect(content).toContain('limit: 10');
    expect(content).toContain('CheckCircle');
    expect(content).toContain('XCircle');
    expect(content).toContain("run.status === 'success'");
    expect(content).toContain("run.status === 'failed'");
  });

  it('should have edit functionality', () => {
    const content = readFileSync(DIST_CRON_UI, 'utf-8');
    expect(content).toContain('setEditingJob');
    expect(content).toContain('const updateCron = useMutation(api.cronJobs.update)');
    expect(content).toContain('handleEdit');
  });

  it('should use two-step confirm delete (no window.confirm)', () => {
    const content = readFileSync(DIST_CRON_UI, 'utf-8');
    expect(content).toContain('confirmingDeletingId');
    expect(content).toContain('confirmingDeletingId === id');
    expect(content).not.toContain('window.confirm');
  });
});

describe('Cron UI - Synchronization (dist ↔ templates)', () => {
  it('cron.tsx should be identical in dist/default and templates/default', () => {
    const dist = readFileSync(DIST_CRON_UI, 'utf-8');
    const tmpl = readFileSync(TMPL_CRON_UI, 'utf-8');
    expect(dist).toBe(tmpl);
  });

  it('cronJobs.ts should be identical in dist/default and templates/default', () => {
    const dist = readFileSync(DIST_CRON_JOBS, 'utf-8');
    const tmpl = readFileSync(TMPL_CRON_JOBS, 'utf-8');
    expect(dist).toBe(tmpl);
  });
});
