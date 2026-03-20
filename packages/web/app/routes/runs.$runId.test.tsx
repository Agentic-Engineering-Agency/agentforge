import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// vi.hoisted
// ---------------------------------------------------------------------------

const {
  captured,
  mockUseQuery,
  mockUseParams,
} = vi.hoisted(() => ({
  captured: { Component: null as React.ComponentType | null },
  mockUseQuery: vi.fn(),
  mockUseParams: vi.fn(() => ({ runId: 'run-123' })),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('convex/react', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: vi.fn(() => vi.fn()),
  useConvexConnectionState: () => ({ isWebSocketConnected: true, hasEverConnected: true }),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    workflows: {
      getRun: 'workflows.getRun',
      getRunSteps: 'workflows.getRunSteps',
    },
  },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => {
    return (opts: { component: React.ComponentType }) => {
      captured.Component = opts.component;
      return { useParams: mockUseParams };
    };
  },
  Link: ({ children, to, ...rest }: any) => <a href={to} data-testid="link" {...rest}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/runs/run-123' } }),
}));

import './runs.$runId';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockRun = {
  _id: 'run-123',
  workflowId: 'wf-1',
  status: 'completed',
  startedAt: Date.now() - 5000,
  completedAt: Date.now(),
  input: 'test input',
};

const mockRunSteps = [
  {
    _id: 'step-1',
    name: 'Step One',
    stepId: 'step-1',
    status: 'completed',
    startedAt: Date.now() - 4000,
    completedAt: Date.now() - 2000,
    createdAt: Date.now() - 4000,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runs.$runId — Run Detail View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ runId: 'run-123' });
  });

  function renderComponent() {
    const Comp = captured.Component;
    if (!Comp) throw new Error('Component not captured');
    return render(<Comp />);
  }

  it('renders the page heading', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText('Agent Run')).toBeInTheDocument();
  });

  it('displays run ID', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    expect(screen.getByText('run-123')).toBeInTheDocument();
  });

  it('renders summary cards', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.getRun') return mockRun;
      if (ref === 'workflows.getRunSteps') return mockRunSteps;
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('renders Event Timeline section', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.getRun') return mockRun;
      if (ref === 'workflows.getRunSteps') return mockRunSteps;
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Event Timeline')).toBeInTheDocument();
  });

  it('shows empty state when no events exist', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.getRun') return mockRun;
      if (ref === 'workflows.getRunSteps') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('No events yet')).toBeInTheDocument();
    expect(screen.getByText('Waiting for agent run events to stream in...')).toBeInTheDocument();
  });

  it('renders event timeline entries when steps exist', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'workflows.getRun') return mockRun;
      if (ref === 'workflows.getRunSteps') return mockRunSteps;
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Step One')).toBeInTheDocument();
    expect(screen.getByText('LLM Call')).toBeInTheDocument();
  });

  it('renders back link to chat', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();

    const links = screen.getAllByTestId('link');
    const chatLink = links.find(l => l.getAttribute('href') === '/chat');
    expect(chatLink).toBeTruthy();
  });
});
