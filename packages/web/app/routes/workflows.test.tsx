import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------

const {
  captured,
  mockUseQuery,
  mockUseMutation,
} = vi.hoisted(() => ({
  captured: { Component: null as React.ComponentType | null },
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(() => vi.fn()),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useConvexConnectionState: () => ({ isWebSocketConnected: true, hasEverConnected: true }),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    workflows: {
      list: 'workflows.list',
      listRuns: 'workflows.listRuns',
      createRun: 'workflows.createRun',
    },
  },
}));

vi.mock('@convex/_generated/dataModel', () => ({
  Id: {},
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => {
    return (opts: { component: React.ComponentType }) => {
      captured.Component = opts.component;
      return {};
    };
  },
  Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/workflows' } }),
}));

import './workflows';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockWorkflows = [
  {
    _id: 'wf-1',
    name: 'Data Pipeline',
    description: 'Extract, transform, load data',
    steps: JSON.stringify([{ id: 'step1' }, { id: 'step2' }]),
    isActive: true,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
];

const mockRuns = [
  {
    _id: 'run-1',
    workflowId: 'wf-1',
    status: 'completed',
    input: 'test input',
    output: 'test output',
    startedAt: Date.now() - 10000,
    completedAt: Date.now(),
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workflows — Workflows Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderComponent() {
    const Comp = captured.Component;
    if (!Comp) throw new Error('Component not captured');
    return render(<Comp />);
  }

  it('renders the page heading', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    // "Workflows" appears in breadcrumb and h1
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Workflows');
  });

  it('renders the page description', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText('Multi-agent pipeline orchestration')).toBeInTheDocument();
  });

  it('renders Workflow Definitions section', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText('Workflow Definitions')).toBeInTheDocument();
  });

  it('renders Recent Runs section', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText('Recent Runs')).toBeInTheDocument();
  });

  it('shows loading state when workflows are undefined', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
  });

  it('shows empty state when no workflows exist', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.list') return [];
      if (ref === 'workflows.listRuns') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('No workflows yet')).toBeInTheDocument();
  });

  it('renders workflow definitions when data is loaded', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.list') return mockWorkflows;
      if (ref === 'workflows.listRuns') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Extract, transform, load data')).toBeInTheDocument();
  });

  it('renders Run button for each workflow', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.list') return mockWorkflows;
      if (ref === 'workflows.listRuns') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Run')).toBeInTheDocument();
  });

  it('shows empty state when no runs exist', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.list') return [];
      if (ref === 'workflows.listRuns') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('No workflow runs yet')).toBeInTheDocument();
  });

  it('renders workflow runs when data exists', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.list') return mockWorkflows;
      if (ref === 'workflows.listRuns') return mockRuns;
      return undefined;
    });
    renderComponent();

    // "Data Pipeline" appears in both definitions and runs sections
    expect(screen.getAllByText('Data Pipeline').length).toBeGreaterThanOrEqual(2);
  });

  it('shows step count for workflow definitions', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.list') return mockWorkflows;
      if (ref === 'workflows.listRuns') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText(/2 steps/)).toBeInTheDocument();
  });
});
