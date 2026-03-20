import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// vi.hoisted — variables accessible to vi.mock factory functions
// ---------------------------------------------------------------------------

const {
  captured,
  mockUseQuery,
  mockUseMutation,
  mockUseParams,
} = vi.hoisted(() => ({
  captured: { Component: null as React.ComponentType | null },
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(() => vi.fn()),
  mockUseParams: vi.fn(() => ({ agentId: 'test-agent-1' })),
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
    agents: { get: 'agents.get', update: 'agents.update' },
    sessions: { list: 'sessions.list' },
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
  useRouterState: () => ({ location: { pathname: '/agents/test-agent-1' } }),
}));

// Import triggers createFileRoute and captures the component
import './agents.$agentId';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockAgent = {
  _id: 'agent-123',
  id: 'test-agent-1',
  name: 'Test Agent',
  description: 'A test agent for unit tests',
  instructions: 'Be helpful',
  model: 'openai/gpt-4o',
  provider: 'openai',
  temperature: 0.7,
  maxTokens: 4096,
  isActive: true,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now(),
  failoverModels: [],
  sandboxEnabled: false,
};

const mockSessions = [
  {
    _id: 'session-1',
    sessionId: 'sess-abc',
    agentId: 'test-agent-1',
    status: 'active',
    startedAt: Date.now() - 3600000,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agents.$agentId — Agent Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ agentId: 'test-agent-1' });
  });

  function renderComponent() {
    const Comp = captured.Component;
    if (!Comp) throw new Error('Component not captured from createFileRoute');
    return render(<Comp />);
  }

  it('renders loading state when agent data is undefined', () => {
    mockUseQuery.mockReturnValue(undefined);
    renderComponent();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders not-found state when agent is null', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'agents.get') return null;
      return undefined;
    });
    renderComponent();
    expect(screen.getByText('Agent Not Found')).toBeInTheDocument();
    expect(screen.getByText(/does not exist or has been deleted/)).toBeInTheDocument();
  });

  it('renders agent detail page with agent data', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'agents.get') return mockAgent;
      if (ref === 'sessions.list') return mockSessions;
      return undefined;
    });
    renderComponent();

    // Agent name appears in both the heading and the overview Name field
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Agent');
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    // "Overview" appears in sidebar nav and tab trigger — use getAllByText
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    // "Settings" appears in sidebar nav and tab trigger — use getAllByText
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('shows agent configuration details in overview tab', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'agents.get') return mockAgent;
      if (ref === 'sessions.list') return [];
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Agent Configuration')).toBeInTheDocument();
    expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('openai')).toBeInTheDocument();
  });

  it('displays session count in sessions tab trigger', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'agents.get') return mockAgent;
      if (ref === 'sessions.list') return mockSessions;
      return undefined;
    });
    renderComponent();

    expect(screen.getByText('Sessions (1)')).toBeInTheDocument();
  });

  it('renders back-to-agents link', () => {
    mockUseQuery.mockImplementation((ref: string) => {
      if (ref === 'agents.get') return mockAgent;
      if (ref === 'sessions.list') return [];
      return undefined;
    });
    renderComponent();

    const links = screen.getAllByTestId('link');
    const agentsLink = links.find(l => l.getAttribute('href') === '/agents');
    expect(agentsLink).toBeTruthy();
  });
});
