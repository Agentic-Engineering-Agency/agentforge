/**
 * Tests for AGE-119: Live Agent Run View
 *
 * Covers: route existence, timeline rendering structure, empty state,
 * chat integration ("View Run" link), component patterns.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Test Group 1: Route file existence and structure
// ---------------------------------------------------------------------------

describe('AGE-119: Agent Run Route — file existence', () => {
  const routePath = path.resolve(__dirname, '../packages/web/app/routes/agent-run.tsx');

  it('agent-run.tsx route file should exist', () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  const routeContent = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf-8') : '';

  it('should use createFileRoute from TanStack Router', () => {
    expect(routeContent).toContain("createFileRoute");
  });

  it('should define route path /runs/$runId', () => {
    expect(routeContent).toContain('/runs/$runId');
  });

  it('should use DashboardLayout wrapper', () => {
    expect(routeContent).toContain('DashboardLayout');
    expect(routeContent).toContain('<DashboardLayout>');
  });

  it('should export Route constant', () => {
    expect(routeContent).toContain('export const Route');
  });
});

// ---------------------------------------------------------------------------
// Test Group 2: Timeline event types
// ---------------------------------------------------------------------------

describe('AGE-119: Agent Run Route — event types', () => {
  const routePath = path.resolve(__dirname, '../packages/web/app/routes/agent-run.tsx');
  const routeContent = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf-8') : '';

  it('should define llm event type', () => {
    expect(routeContent).toContain('"llm"');
  });

  it('should define tool event type', () => {
    expect(routeContent).toContain('"tool"');
  });

  it('should define memory event type', () => {
    expect(routeContent).toContain('"memory"');
  });

  it('should define error event type', () => {
    expect(routeContent).toContain('"error"');
  });

  it('should color-code event types (blue for LLM)', () => {
    expect(routeContent).toContain('text-blue-400');
  });

  it('should color-code event types (green for tool)', () => {
    expect(routeContent).toContain('text-green-400');
  });

  it('should color-code event types (purple for memory)', () => {
    expect(routeContent).toContain('text-purple-400');
  });

  it('should color-code event types (red for error)', () => {
    expect(routeContent).toContain('text-red-400');
  });
});

// ---------------------------------------------------------------------------
// Test Group 3: Timeline structure and summary
// ---------------------------------------------------------------------------

describe('AGE-119: Agent Run Route — timeline structure', () => {
  const routePath = path.resolve(__dirname, '../packages/web/app/routes/agent-run.tsx');
  const routeContent = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf-8') : '';

  it('should show timestamp for each event', () => {
    expect(routeContent).toContain('formatTimestamp');
    expect(routeContent).toContain('timestamp');
  });

  it('should show duration for each event', () => {
    expect(routeContent).toContain('durationMs');
    expect(routeContent).toContain('formatDuration');
  });

  it('should show summary cards (duration, cost, model, events)', () => {
    expect(routeContent).toContain('Duration');
    expect(routeContent).toContain('Cost');
    expect(routeContent).toContain('Model');
    expect(routeContent).toContain('Events');
  });

  it('should show token counts for LLM events', () => {
    expect(routeContent).toContain('inputTokens');
    expect(routeContent).toContain('outputTokens');
  });

  it('should show event details', () => {
    expect(routeContent).toContain('event.details');
  });
});

// ---------------------------------------------------------------------------
// Test Group 4: Empty state
// ---------------------------------------------------------------------------

describe('AGE-119: Agent Run Route — empty state', () => {
  const routePath = path.resolve(__dirname, '../packages/web/app/routes/agent-run.tsx');
  const routeContent = fs.existsSync(routePath) ? fs.readFileSync(routePath, 'utf-8') : '';

  it('should handle empty events gracefully', () => {
    expect(routeContent).toContain('isEmpty');
    expect(routeContent).toContain('No events yet');
  });

  it('should show loading spinner for empty state', () => {
    expect(routeContent).toContain('Loader2');
    expect(routeContent).toContain('animate-spin');
  });
});

// ---------------------------------------------------------------------------
// Test Group 5: Chat integration — "View Run" link
// ---------------------------------------------------------------------------

describe('AGE-119: Chat — View Run link', () => {
  const chatPath = path.resolve(__dirname, '../packages/web/app/routes/chat.tsx');
  const chatContent = fs.existsSync(chatPath) ? fs.readFileSync(chatPath, 'utf-8') : '';

  it('chat.tsx should contain View Run link text', () => {
    expect(chatContent).toContain('View Run');
  });

  it('View Run link should point to /runs/ path', () => {
    expect(chatContent).toContain('/runs/');
  });

  it('View Run should only show for assistant messages', () => {
    expect(chatContent).toContain('msg.role === "assistant"');
    expect(chatContent).toContain('msg.traceId');
  });

  it('should import ExternalLink icon for View Run', () => {
    expect(chatContent).toContain('ExternalLink');
  });
});

// ---------------------------------------------------------------------------
// Test Group 6: Spec existence
// ---------------------------------------------------------------------------

describe('AGE-119: Spec file', () => {
  it('spec file should exist', () => {
    const specPath = path.resolve(__dirname, '../specs/active/SPEC-20260223-live-agent-run.md');
    expect(fs.existsSync(specPath)).toBe(true);
  });

  it('voice spec file should exist', () => {
    const specPath = path.resolve(__dirname, '../specs/active/SPEC-20260223-voice-tts.md');
    expect(fs.existsSync(specPath)).toBe(true);
  });
});
