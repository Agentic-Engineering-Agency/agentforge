import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------

const { captured } = vi.hoisted(() => ({
  captured: { Component: null as React.ComponentType | null },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
  useConvexConnectionState: () => ({ isWebSocketConnected: true, hasEverConnected: true }),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {},
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => {
    return (opts: { component: React.ComponentType }) => {
      captured.Component = opts.component;
      return {};
    };
  },
  Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/observability' } }),
}));

import './observability';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('observability — Observability Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderComponent() {
    const Comp = captured.Component;
    if (!Comp) throw new Error('Component not captured');
    return render(<Comp />);
  }

  it('renders the page heading', () => {
    renderComponent();
    // "Observability" appears in both the breadcrumb and the h1 heading
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Observability');
  });

  it('renders the page description', () => {
    renderComponent();
    expect(screen.getByText('Monitor LLM traces, costs, and agent quality scores')).toBeInTheDocument();
  });

  it('renders all three tab triggers', () => {
    renderComponent();
    expect(screen.getByText('Trace List')).toBeInTheDocument();
    expect(screen.getByText('Cost Analytics')).toBeInTheDocument();
    expect(screen.getByText('Scorer Results')).toBeInTheDocument();
  });

  it('shows empty state for traces in the default active tab', () => {
    renderComponent();
    // "traces" is the default tab, so empty state should be visible
    expect(screen.getByText('No traces yet')).toBeInTheDocument();
    expect(screen.getByText('Run an agent to see LLM traces.')).toBeInTheDocument();
  });

  it('renders the Recent LLM Traces section heading', () => {
    renderComponent();
    expect(screen.getByText('Recent LLM Traces')).toBeInTheDocument();
  });
});
