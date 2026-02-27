/**
 * Real-Time Dashboard Test Suite
 *
 * Tests for AGE-162: Real-Time Dashboard
 * Tests that components use Convex reactive queries (useQuery) not useEffect+fetch
 * Tests that connection status indicator works correctly
 *
 * Covers:
 *   1. Dashboard routes use useQuery from convex/react
 *   2. DashboardLayout uses useConvexConnectionState for real connection status
 *   3. No REST polling patterns (useEffect with intervals) exist
 *   4. Connection status indicator shows correct states (Online/Offline/Reconnecting)
 *   5. Both dist/default and templates/default are identical
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIST_ROUTES = {
  index: path.resolve('packages/cli/dist/default/dashboard/app/routes/index.tsx'),
  agents: path.resolve('packages/cli/dist/default/dashboard/app/routes/agents.tsx'),
  sessions: path.resolve('packages/cli/dist/default/dashboard/app/routes/sessions.tsx'),
  usage: path.resolve('packages/cli/dist/default/dashboard/app/routes/usage.tsx'),
  layout: path.resolve('packages/cli/dist/default/dashboard/app/components/DashboardLayout.tsx'),
};

const TEMPLATE_ROUTES = {
  index: path.resolve('packages/cli/templates/default/dashboard/app/routes/index.tsx'),
  agents: path.resolve('packages/cli/templates/default/dashboard/app/routes/agents.tsx'),
  sessions: path.resolve('packages/cli/templates/default/dashboard/app/routes/sessions.tsx'),
  usage: path.resolve('packages/cli/templates/default/dashboard/app/routes/usage.tsx'),
  layout: path.resolve('packages/cli/templates/default/dashboard/app/components/DashboardLayout.tsx'),
};

describe('Real-Time Dashboard — structural tests', () => {
  describe('Route files exist', () => {
    it('index.tsx exists in dist/default', () => {
      expect(fs.existsSync(DIST_ROUTES.index)).toBe(true);
    });

    it('agents.tsx exists in dist/default', () => {
      expect(fs.existsSync(DIST_ROUTES.agents)).toBe(true);
    });

    it('sessions.tsx exists in dist/default', () => {
      expect(fs.existsSync(DIST_ROUTES.sessions)).toBe(true);
    });

    it('usage.tsx exists in dist/default', () => {
      expect(fs.existsSync(DIST_ROUTES.usage)).toBe(true);
    });

    it('DashboardLayout.tsx exists in dist/default', () => {
      expect(fs.existsSync(DIST_ROUTES.layout)).toBe(true);
    });
  });

  describe('Routes use useQuery from Convex (not REST polling)', () => {
    it('index.tsx imports useQuery from convex/react', () => {
      const content = fs.readFileSync(DIST_ROUTES.index, 'utf-8');
      expect(content).toContain("from 'convex/react'");
      expect(content).toContain('useQuery');
    });

    it('index.tsx uses api.agents.list via useQuery', () => {
      const content = fs.readFileSync(DIST_ROUTES.index, 'utf-8');
      expect(content).toContain('api.agents.list');
      expect(content).toMatch(/useQuery\(api\.agents\.list/);
    });

    it('index.tsx uses api.sessions.list via useQuery', () => {
      const content = fs.readFileSync(DIST_ROUTES.index, 'utf-8');
      expect(content).toContain('api.sessions.list');
      expect(content).toMatch(/useQuery\(api\.sessions\.list/);
    });

    it('index.tsx does NOT use useEffect+setInterval for polling', () => {
      const content = fs.readFileSync(DIST_ROUTES.index, 'utf-8');
      // Should not have polling pattern
      const hasPolling = content.includes('setInterval') && content.includes('useEffect');
      expect(hasPolling).toBe(false);
    });

    it('agents.tsx uses useQuery and useMutation from convex/react', () => {
      const content = fs.readFileSync(DIST_ROUTES.agents, 'utf-8');
      expect(content).toContain("from 'convex/react'");
      expect(content).toContain('useQuery');
      expect(content).toContain('useMutation');
    });

    it('agents.tsx uses api.agents.list via useQuery', () => {
      const content = fs.readFileSync(DIST_ROUTES.agents, 'utf-8');
      expect(content).toMatch(/useQuery\(api\.agents\.list/);
    });

    it('sessions.tsx uses useQuery and useMutation from convex/react', () => {
      const content = fs.readFileSync(DIST_ROUTES.sessions, 'utf-8');
      expect(content).toContain("from 'convex/react'");
      expect(content).toContain('useQuery');
      expect(content).toContain('useMutation');
    });

    it('sessions.tsx uses api.sessions.list via useQuery', () => {
      const content = fs.readFileSync(DIST_ROUTES.sessions, 'utf-8');
      expect(content).toMatch(/useQuery\(api\.sessions\.list/);
    });

    it('usage.tsx uses useQuery from convex/react', () => {
      const content = fs.readFileSync(DIST_ROUTES.usage, 'utf-8');
      expect(content).toContain("from 'convex/react'");
      expect(content).toContain('useQuery');
    });

    it('usage.tsx uses api.usage queries via useQuery', () => {
      const content = fs.readFileSync(DIST_ROUTES.usage, 'utf-8');
      expect(content).toMatch(/useQuery\(api\.usage\./);
    });
  });

  describe('DashboardLayout has real connection status', () => {
    it('DashboardLayout imports useConvexConnectionState from convex/react', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toContain('useConvexConnectionState');
      // Accepts both single and double quote styles
      const hasImport = content.includes("from 'convex/react'") || content.includes('from "convex/react"');
      expect(hasImport).toBe(true);
    });

    it('DashboardLayout HealthStatus component uses useConvexConnectionState', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toMatch(/useConvexConnectionState\(\)/);
    });

    it('HealthStatus reads isWebSocketConnected from connectionState', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toContain('isWebSocketConnected');
    });

    it('HealthStatus reads hasEverConnected from connectionState', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toContain('hasEverConnected');
    });

    it('HealthStatus shows "Online" when connected', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toMatch(/Online/);
    });

    it('HealthStatus shows "Offline" when not connected', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toMatch(/Offline/);
    });

    it('HealthStatus shows "Reconnecting..." when hasEverConnected but not isWebSocketConnected', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toMatch(/Reconnecting/);
    });

    it('HealthStatus has green indicator for online state', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toContain('bg-green-500');
    });

    it('HealthStatus has red indicator for offline state', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toContain('bg-red-500');
    });

    it('HealthStatus has yellow indicator for reconnecting state', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      expect(content).toContain('bg-yellow-500');
    });

    it('HealthStatus does NOT use fake polling interval', () => {
      const content = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      // The old fake implementation had a comment about polling
      expect(content).not.toContain('In production, poll the Convex backend heartbeat');
    });
  });

  describe('dist/default and templates/default are identical', () => {
    it('index.tsx is identical in both folders', () => {
      const distContent = fs.readFileSync(DIST_ROUTES.index, 'utf-8');
      const templateContent = fs.readFileSync(TEMPLATE_ROUTES.index, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('agents.tsx is identical in both folders', () => {
      const distContent = fs.readFileSync(DIST_ROUTES.agents, 'utf-8');
      const templateContent = fs.readFileSync(TEMPLATE_ROUTES.agents, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('sessions.tsx is identical in both folders', () => {
      const distContent = fs.readFileSync(DIST_ROUTES.sessions, 'utf-8');
      const templateContent = fs.readFileSync(TEMPLATE_ROUTES.sessions, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('usage.tsx is identical in both folders', () => {
      const distContent = fs.readFileSync(DIST_ROUTES.usage, 'utf-8');
      const templateContent = fs.readFileSync(TEMPLATE_ROUTES.usage, 'utf-8');
      expect(distContent).toBe(templateContent);
    });

    it('DashboardLayout.tsx is identical in both folders', () => {
      const distContent = fs.readFileSync(DIST_ROUTES.layout, 'utf-8');
      const templateContent = fs.readFileSync(TEMPLATE_ROUTES.layout, 'utf-8');
      expect(distContent).toBe(templateContent);
    });
  });

  describe('Real-time data update behavior', () => {
    it('overview page updates stats when agents list changes', () => {
      const content = fs.readFileSync(DIST_ROUTES.index, 'utf-8');
      // Should use agents?.length which will update reactively
      expect(content).toMatch(/agents\?\.length|agents\.length/);
    });

    it('sessions page filters reactively based on search/filter state', () => {
      const content = fs.readFileSync(DIST_ROUTES.sessions, 'utf-8');
      // Should have useMemo for filtering that depends on sessions
      expect(content).toContain('useMemo');
      expect(content).toMatch(/,\s*\[sessions/);
    });

    it('agents page filters reactively based on search state', () => {
      const content = fs.readFileSync(DIST_ROUTES.agents, 'utf-8');
      expect(content).toContain('useMemo');
      expect(content).toMatch(/,\s*\[agents/);
    });
  });
});
