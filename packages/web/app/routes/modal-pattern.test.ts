import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROUTES_DIR = path.resolve(import.meta.dirname, '.');

const ROUTES_WITH_MODALS = [
  'chat.tsx',
  'agents.tsx',
  'connections.tsx',
  'cron.tsx',
  'projects.tsx',
  'settings.tsx',
  'skills.tsx',
];

const HAND_ROLLED_PATTERN = /className="fixed inset-0[^"]*bg-black/;

describe('modal pattern enforcement', () => {
  for (const routeFile of ROUTES_WITH_MODALS) {
    it(`${routeFile} should use Radix Dialog, not hand-rolled overlay`, () => {
      const filePath = path.join(ROUTES_DIR, routeFile);
      const source = fs.readFileSync(filePath, 'utf-8');

      const handRolledCount = (source.match(HAND_ROLLED_PATTERN) || []).length;
      expect(
        handRolledCount,
        `${routeFile} has ${handRolledCount} hand-rolled modal overlay(s). Use <Dialog>/<DialogContent> from components/ui/dialog instead.`,
      ).toBe(0);
    });
  }

  for (const routeFile of ROUTES_WITH_MODALS) {
    it(`${routeFile} should import from components/ui/dialog`, () => {
      const filePath = path.join(ROUTES_DIR, routeFile);
      const source = fs.readFileSync(filePath, 'utf-8');

      expect(
        source,
        `${routeFile} should import Dialog primitives from components/ui/dialog or ~/components/ui/dialog`,
      ).toMatch(/from ['"](?:\.\.\/|~\/)components\/ui\/dialog['"]/);
    });
  }
});
