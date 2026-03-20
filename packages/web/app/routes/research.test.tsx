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
  api: {
    research: { create: 'research.create', update: 'research.update' },
  },
}));

vi.mock('../lib/runtime', () => ({
  getDaemonUrl: () => 'http://localhost:3001',
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => {
    return (opts: { component: React.ComponentType }) => {
      captured.Component = opts.component;
      return {};
    };
  },
  Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/research' } }),
}));

import './research';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('research — Research Orchestrator UI', () => {
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
    expect(screen.getByText('Research Mode')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    renderComponent();
    expect(screen.getByText('Deep research with parallel multi-agent orchestration')).toBeInTheDocument();
  });

  it('renders the research input form', () => {
    renderComponent();
    expect(screen.getByText('Start New Research')).toBeInTheDocument();
    expect(screen.getByText('Research Topic')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter a topic or question to research...')).toBeInTheDocument();
  });

  it('renders depth selector with all options', () => {
    renderComponent();
    expect(screen.getByText('Research Depth')).toBeInTheDocument();
    expect(screen.getByText('Shallow (3 agents)')).toBeInTheDocument();
    expect(screen.getByText('Medium (5 agents)')).toBeInTheDocument();
    expect(screen.getByText('Deep (10 agents)')).toBeInTheDocument();
  });

  it('renders start research button', () => {
    renderComponent();
    expect(screen.getByText('Start Research')).toBeInTheDocument();
  });

  it('shows empty state when no research jobs exist', () => {
    renderComponent();
    expect(screen.getByText('No research yet')).toBeInTheDocument();
    expect(screen.getByText('Start a research task to see results here.')).toBeInTheDocument();
  });

  it('start button is disabled when topic is empty', () => {
    renderComponent();
    const button = screen.getByText('Start Research').closest('button');
    expect(button).toBeDisabled();
  });

  it('shows parallel agents count derived from depth', () => {
    renderComponent();
    // Default depth is 'medium' => 5 agents
    expect(screen.getByText('5 agents (derived from depth)')).toBeInTheDocument();
  });
});
