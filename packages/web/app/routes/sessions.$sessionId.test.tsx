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
  mockUseParams: vi.fn(() => ({ sessionId: 'sess-abc' })),
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
    sessions: { getWithMessages: 'sessions.getWithMessages' },
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
  useRouterState: () => ({ location: { pathname: '/sessions/sess-abc' } }),
}));

import './sessions.$sessionId';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockSessionData = {
  _id: 'session-1',
  sessionId: 'sess-abc',
  agentId: 'agent-1',
  userId: 'user-1',
  status: 'active',
  startedAt: Date.now() - 3600000,
  completedAt: null,
  lastActivityAt: Date.now() - 60000,
  messagePreview: [
    {
      _id: 'msg-1',
      role: 'user',
      content: 'Hello, agent!',
      createdAt: Date.now() - 120000,
    },
    {
      _id: 'msg-2',
      role: 'assistant',
      content: 'Hello! How can I help?',
      createdAt: Date.now() - 60000,
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sessions.$sessionId — Session Detail View', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ sessionId: 'sess-abc' });
  });

  function renderComponent() {
    const Comp = captured.Component;
    if (!Comp) throw new Error('Component not captured');
    return render(<Comp />);
  }

  it('renders not-found state when session data is null', () => {
    mockUseQuery.mockReturnValue(null);
    renderComponent();

    expect(screen.getByText('Session Not Found')).toBeInTheDocument();
    expect(screen.getByText(/could not be found/)).toBeInTheDocument();
  });

  it('renders session detail page with session data', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    expect(screen.getByText('Session Details')).toBeInTheDocument();
  });

  it('displays session ID', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    const sessionIdElements = screen.getAllByText('sess-abc');
    expect(sessionIdElements.length).toBeGreaterThan(0);
  });

  it('renders summary cards', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    // "Agent" appears in sidebar nav heading and summary card label — use getAllByText
    expect(screen.getAllByText('Agent').length).toBeGreaterThan(0);
    // "Status" may appear in summary card and session info
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    expect(screen.getByText('Duration')).toBeInTheDocument();
    // "Messages" appears in summary card label
    expect(screen.getAllByText('Messages').length).toBeGreaterThan(0);
  });

  it('renders message history', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    expect(screen.getByText('Message History')).toBeInTheDocument();
    expect(screen.getByText('Hello, agent!')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
  });

  it('shows message count in summary card', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Session Information card', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    expect(screen.getByText('Session Information')).toBeInTheDocument();
  });

  it('renders back link to sessions list', () => {
    mockUseQuery.mockReturnValue(mockSessionData);
    renderComponent();

    const links = screen.getAllByTestId('link');
    const sessionsLink = links.find(l => l.getAttribute('href') === '/sessions');
    expect(sessionsLink).toBeTruthy();
  });

  it('renders empty message state when session has no messages', () => {
    const emptySession = { ...mockSessionData, messagePreview: [] };
    mockUseQuery.mockReturnValue(emptySession);
    renderComponent();

    expect(screen.getByText('No messages')).toBeInTheDocument();
    expect(screen.getByText('This session has no message history.')).toBeInTheDocument();
  });
});
