/**
 * Observability Dashboard Test Suite
 *
 * Tests for AGE-19: Observability Dashboard UI
 * Uses static file analysis since component rendering via vitest is not feasible
 * without a DOM environment configured for the web package.
 *
 * Covers:
 *   1. Route file exists at the correct path
 *   2. Route file exports Route using createFileRoute
 *   3. Route file imports DashboardLayout
 *   4. DashboardLayout contains a link to /observability
 *   5. The page contains a Trace List section
 *   6. The page contains a Cost Analytics section
 *   7. The page contains a Scorer Results section
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROUTE_PATH = path.resolve('packages/web/app/routes/observability.tsx');
const LAYOUT_PATH = path.resolve('packages/web/app/components/DashboardLayout.tsx');

describe('Observability Dashboard — structural tests', () => {
  it('route file exists at packages/web/app/routes/observability.tsx', () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
  });

  it('route file exports Route using createFileRoute', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toContain('createFileRoute');
    expect(content).toContain("export const Route");
    expect(content).toContain('/observability');
  });

  it('route file imports DashboardLayout', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toContain('DashboardLayout');
  });

  it('DashboardLayout.tsx contains a link to /observability', () => {
    const content = fs.readFileSync(LAYOUT_PATH, 'utf-8');
    expect(content).toContain('/observability');
  });

  it('DashboardLayout.tsx imports Activity icon from lucide-react', () => {
    const content = fs.readFileSync(LAYOUT_PATH, 'utf-8');
    expect(content).toContain('Activity');
  });

  it('observability page contains Trace List section', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toMatch(/[Tt]race[s]?\s*[Ll]ist|[Tt]races/);
  });

  it('observability page contains Cost Analytics section', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toMatch(/[Cc]ost\s*[Aa]nalytics|Cost Analytics/);
  });

  it('observability page contains Scorer Results section', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toMatch(/[Ss]corer\s*[Rr]esults|Scorer Results/);
  });

  it('route file uses Tabs component for navigation between panels', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toContain('Tabs');
    expect(content).toContain('TabsList');
    expect(content).toContain('TabsTrigger');
    expect(content).toContain('TabsContent');
  });

  it('route file contains trace mock data with expected fields', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    // Should have trace-like data with latency, tokens, status
    expect(content).toMatch(/[Ll]atency|latency/);
    expect(content).toMatch(/[Ss]tatus|status/);
  });

  it('route file contains cost mock data with cost field', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toMatch(/cost|Cost/);
  });

  it('route file contains scorer data with quality score field', () => {
    const content = fs.readFileSync(ROUTE_PATH, 'utf-8');
    expect(content).toMatch(/[Qq]uality|quality/);
  });

  it('DashboardLayout observability entry is in the Control section', () => {
    const content = fs.readFileSync(LAYOUT_PATH, 'utf-8');
    // Find the Control section and check observability appears within it
    const controlIndex = content.indexOf('"Control"');
    const nextSectionIndex = content.indexOf('section:', controlIndex + 1);
    const controlBlock = content.slice(controlIndex, nextSectionIndex > controlIndex ? nextSectionIndex : undefined);
    expect(controlBlock).toContain('/observability');
  });
});
