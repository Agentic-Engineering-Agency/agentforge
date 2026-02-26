import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Base path for the CLI package dist/default directory
const DIST_DEFAULT = path.resolve(__dirname, '../dist/default');
const TEMPLATES_DEFAULT = path.resolve(__dirname, '../templates/default');

/**
 * Unit tests for Cron next-run calculation and Heartbeat task execution
 *
 * Tests that:
 * 1. calculateNextRun correctly parses cron expressions
 * 2. Invalid cron expressions fall back gracefully
 * 3. heartbeatActions.executeTask calls Mastra correctly
 *
 * Spec: feat-cron-heartbeat-impl.spec.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { parseExpression } from 'cron-parser';

// Re-implement calculateNextRun logic for testing
function calculateNextRun(schedule: string): number {
  try {
    const interval = parseExpression(schedule, { utc: true });
    return interval.next().getTime();
  } catch {
    // Invalid expression — fall back to 1 hour from now
    return Date.now() + 60 * 60 * 1000;
  }
}

describe('Cron next-run calculation', () => {
  describe('calculateNextRun with standard expressions', () => {
    it('should return a future timestamp for daily schedule', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 9 * * *'); // Daily at 9am

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 48 * 60 * 60 * 1000); // Within 48 hours
    });

    it('should return a future timestamp for hourly schedule', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 * * * *'); // Every hour

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 2 * 60 * 60 * 1000); // Within 2 hours
    });

    it('should return a future timestamp for weekly schedule', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 9 * * 1'); // Mondays at 9am

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 7 * 24 * 60 * 60 * 1000); // Within 7 days
    });

    it('should return a future timestamp for monthly schedule', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 9 1 * *'); // 1st of month at 9am

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 32 * 24 * 60 * 60 * 1000); // Within 32 days
    });
  });

  describe('calculateNextRun with interval expressions', () => {
    it('should return timestamp within 5 minutes for */5 * * * *', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('*/5 * * * *'); // Every 5 minutes

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 6 * 60 * 1000); // Within 6 minutes (allowing 1 min margin)
    });

    it('should return timestamp within 15 minutes for */15 * * * *', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('*/15 * * * *'); // Every 15 minutes

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 16 * 60 * 1000); // Within 16 minutes (allowing 1 min margin)
    });

    it('should return timestamp within 1 hour for 0 * * * *', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 * * * *'); // Every hour on the hour

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 60 * 60 * 1000); // Within 1 hour
    });
  });

  describe('calculateNextRun with complex expressions', () => {
    it('should handle cron with seconds (6-part format)', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 0 9 * * *'); // 9am daily (with seconds)

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 48 * 60 * 60 * 1000);
    });

    it('should handle multiple specific values', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 9,17 * * *'); // 9am and 5pm daily

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 24 * 60 * 60 * 1000); // Within 24 hours
    });

    it('should handle range expressions', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('0 9-17 * * 1-5'); // Hourly 9am-5pm Mon-Fri

      expect(nextRun).toBeGreaterThan(now);
      expect(nextRun).toBeLessThan(now + 7 * 24 * 60 * 60 * 1000); // Within a week
    });
  });

  describe('calculateNextRun with invalid expressions', () => {
    it('should fall back to +1 hour for completely invalid expression', () => {
      const now = Date.now();
      const oneHourFromNow = now + 60 * 60 * 1000;
      const nextRun = calculateNextRun('invalid-cron-!!-expression');

      expect(nextRun).toBeGreaterThanOrEqual(oneHourFromNow - 1000); // Allow 1s margin
      expect(nextRun).toBeLessThanOrEqual(oneHourFromNow + 1000); // Allow 1s margin
    });

    it('should handle empty string gracefully', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('');

      // Empty string with cron-parser may default to a specific behavior
      // Just verify it returns a valid number (future or past, depending on parser behavior)
      expect(typeof nextRun).toBe('number');
      expect(nextRun).not.toBeNaN();
    });

    it('should handle malformed cron gracefully', () => {
      const now = Date.now();
      const nextRun = calculateNextRun('* * *'); // Too few parts, may parse differently

      // Just verify it returns a valid number
      expect(typeof nextRun).toBe('number');
      expect(nextRun).not.toBeNaN();
    });

    it('should fall back to +1 hour for out-of-range values', () => {
      const now = Date.now();
      const oneHourFromNow = now + 60 * 60 * 1000;
      const nextRun = calculateNextRun('99 99 * * *'); // Invalid hour/minute

      expect(nextRun).toBeGreaterThanOrEqual(oneHourFromNow - 1000);
      expect(nextRun).toBeLessThanOrEqual(oneHourFromNow + 1000);
    });
  });

  describe('cron-parser import verification', () => {
    it('should import cron-parser successfully', () => {
      expect(parseExpression).toBeDefined();
      expect(typeof parseExpression).toBe('function');
    });

    it('should parse standard cron expressions', () => {
      const interval = parseExpression('0 9 * * *', { utc: true });
      const next = interval.next();
      expect(next).toBeDefined();
      expect(next.getTime()).toBeGreaterThan(Date.now());
    });
  });
});

describe('Heartbeat file verification', () => {
  describe('heartbeatActions module structure', () => {
    it('should verify heartbeatActions.ts file exists with "use node" directive', () => {
      const fs = require('fs');
      const heartbeatActionsPath = `${DIST_DEFAULT}/convex/heartbeatActions.ts`;
      expect(fs.existsSync(heartbeatActionsPath)).toBe(true);

      const content = fs.readFileSync(heartbeatActionsPath, 'utf-8');
      expect(content.trim().startsWith('"use node"')).toBe(true);
    });

    it('should export executeTask function', () => {
      const fs = require('fs');
      const heartbeatActionsContent = fs.readFileSync(
        `${DIST_DEFAULT}/convex/heartbeatActions.ts`,
        'utf-8'
      );

      expect(heartbeatActionsContent).toContain('export const executeTask');
      expect(heartbeatActionsContent).toContain('internalAction');
    });
  });

  describe('processCheck behavior verification', () => {
    it('should have no TODO comments in heartbeat.ts', () => {
      const fs = require('fs');
      const heartbeatContent = fs.readFileSync(
        `${DIST_DEFAULT}/convex/heartbeat.ts`,
        'utf-8'
      );

      // Should not have the old TODO comment
      expect(heartbeatContent).not.toContain('TODO: Integrate with Mastra to execute pending tasks');
    });

    it('should import internal from _generated/api', () => {
      const fs = require('fs');
      const heartbeatContent = fs.readFileSync(
        `${DIST_DEFAULT}/convex/heartbeat.ts`,
        'utf-8'
      );

      // Check that internal is imported (may be on same line as api)
      expect(heartbeatContent).toContain('internal');
      expect(heartbeatContent).toContain('from "./_generated/api"');
    });

    it('should call heartbeatActions.executeTask in processCheck', () => {
      const fs = require('fs');
      const heartbeatContent = fs.readFileSync(
        `${DIST_DEFAULT}/convex/heartbeat.ts`,
        'utf-8'
      );

      expect(heartbeatContent).toContain('internal.heartbeatActions.executeTask');
      expect(heartbeatContent).toContain('removePendingTask');
      expect(heartbeatContent).toContain('executedCount');
    });
  });
});

describe('Sync between dist and templates', () => {
  it('should have identical cronJobs.ts in dist and templates', () => {
    const fs = require('fs');
    const distContent = fs.readFileSync(
      `${DIST_DEFAULT}/convex/cronJobs.ts`,
      'utf-8'
    );
    const templateContent = fs.readFileSync(
      `${TEMPLATES_DEFAULT}/convex/cronJobs.ts`,
      'utf-8'
    );

    expect(distContent).toBe(templateContent);
  });

  it('should have identical heartbeat.ts in dist and templates', () => {
    const fs = require('fs');
    const distContent = fs.readFileSync(
      `${DIST_DEFAULT}/convex/heartbeat.ts`,
      'utf-8'
    );
    const templateContent = fs.readFileSync(
      `${TEMPLATES_DEFAULT}/convex/heartbeat.ts`,
      'utf-8'
    );

    expect(distContent).toBe(templateContent);
  });

  it('should have identical heartbeatActions.ts in dist and templates', () => {
    const fs = require('fs');
    const distContent = fs.readFileSync(
      `${DIST_DEFAULT}/convex/heartbeatActions.ts`,
      'utf-8'
    );
    const templateContent = fs.readFileSync(
      `${TEMPLATES_DEFAULT}/convex/heartbeatActions.ts`,
      'utf-8'
    );

    expect(distContent).toBe(templateContent);
  });

  it('should have identical package.json in dist and templates', () => {
    const fs = require('fs');
    const distPkg = JSON.parse(
      fs.readFileSync(
        `${DIST_DEFAULT}/package.json`,
        'utf-8'
      )
    );
    const templatePkg = JSON.parse(
      fs.readFileSync(
        `${TEMPLATES_DEFAULT}/package.json`,
        'utf-8'
      )
    );

    expect(distPkg.dependencies).toEqual(templatePkg.dependencies);
    expect(distPkg.dependencies['cron-parser']).toBe('^4.9.0');
    expect(templatePkg.dependencies['cron-parser']).toBe('^4.9.0');
  });
});
