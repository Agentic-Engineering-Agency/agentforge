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
    skillMarketplace: {
      listSkills: 'skillMarketplace.listSkills',
      install: 'skillMarketplace.install',
    },
  },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => {
    return (opts: { component: React.ComponentType }) => {
      captured.Component = opts.component;
      return {};
    };
  },
  Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
  useRouterState: () => ({ location: { pathname: '/skills-marketplace' } }),
}));

import './skills-marketplace';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockSkills = [
  {
    _id: 'skill-1',
    name: 'web-scraper',
    version: '1.2.0',
    description: 'Scrape web pages and extract structured data',
    author: 'AgentForge',
    category: 'data',
    tags: ['web', 'scraping'],
    downloads: 1500,
    featured: true,
    repositoryUrl: 'https://github.com/example/web-scraper',
  },
  {
    _id: 'skill-2',
    name: 'slack-notifier',
    version: '0.9.1',
    description: 'Send notifications to Slack channels',
    author: 'Community',
    category: 'communication',
    tags: ['slack', 'notifications'],
    downloads: 800,
    featured: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('skills-marketplace — Skills Marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderComponent() {
    const Comp = captured.Component;
    if (!Comp) throw new Error('Component not captured');
    return render(<Comp />);
  }

  it('renders the page heading', () => {
    mockUseQuery.mockReturnValue([]);
    renderComponent();
    expect(screen.getByText('Skill Marketplace')).toBeInTheDocument();
  });

  it('renders the page description', () => {
    mockUseQuery.mockReturnValue([]);
    renderComponent();
    expect(screen.getByText('Discover and install community skills for your agents')).toBeInTheDocument();
  });

  it('renders search input', () => {
    mockUseQuery.mockReturnValue([]);
    renderComponent();
    expect(screen.getByPlaceholderText('Search skills...')).toBeInTheDocument();
  });

  it('renders category filter buttons', () => {
    mockUseQuery.mockReturnValue([]);
    renderComponent();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('automation')).toBeInTheDocument();
    expect(screen.getByText('developer tools')).toBeInTheDocument();
    expect(screen.getByText('communication')).toBeInTheDocument();
    expect(screen.getByText('data')).toBeInTheDocument();
    expect(screen.getByText('research')).toBeInTheDocument();
  });

  it('shows empty state when no skills match', () => {
    mockUseQuery.mockReturnValue([]);
    renderComponent();
    expect(screen.getByText('No skills found matching your criteria.')).toBeInTheDocument();
  });

  it('renders skill cards when skills are loaded', () => {
    mockUseQuery.mockReturnValue(mockSkills);
    renderComponent();
    // Featured skills appear in both Featured and All sections, so use getAllByText
    expect(screen.getAllByText('web-scraper').length).toBeGreaterThan(0);
    expect(screen.getAllByText('slack-notifier').length).toBeGreaterThan(0);
  });

  it('renders Featured section when viewing all skills with no search', () => {
    mockUseQuery.mockReturnValue(mockSkills);
    renderComponent();
    expect(screen.getByText('Featured')).toBeInTheDocument();
  });

  it('renders install buttons on skill cards', () => {
    mockUseQuery.mockReturnValue(mockSkills);
    renderComponent();
    const installButtons = screen.getAllByText('Install');
    expect(installButtons.length).toBeGreaterThan(0);
  });

  it('shows skill version and author', () => {
    mockUseQuery.mockReturnValue(mockSkills);
    renderComponent();
    // Featured skills appear in both Featured and All sections
    expect(screen.getAllByText('v1.2.0').length).toBeGreaterThan(0);
    expect(screen.getAllByText('by AgentForge').length).toBeGreaterThan(0);
  });

  it('shows download count', () => {
    mockUseQuery.mockReturnValue(mockSkills);
    renderComponent();
    // Featured skills appear in both Featured and All sections
    expect(screen.getAllByText('1,500 downloads').length).toBeGreaterThan(0);
  });
});
