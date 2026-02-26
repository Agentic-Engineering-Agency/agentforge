import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Plug, Plus, Trash2, Search, X, Check, ExternalLink, Globe, Database, Mail, MessageSquare, FileText, Code, Zap, Shield, Loader2 } from 'lucide-react';

export const Route = createFileRoute('/connections')({ component: ConnectionsPage });

// ─── MCP Integrations Catalog ─────────────────────────────────────
const MCP_CATALOG = [
  {
    name: 'GitHub',
    description: 'Access repositories, issues, pull requests, and code search. Automate GitHub workflows from your agents.',
    serverUrl: 'npx -y @modelcontextprotocol/server-github',
    protocol: 'mcp',
    category: 'Development',
    icon: Code,
    authFields: [{ key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'Personal Access Token', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx', helpUrl: 'https://github.com/settings/tokens' }],
    capabilities: ['repos', 'issues', 'pull_requests', 'code_search', 'actions'],
  },
  {
    name: 'Slack',
    description: 'Send messages, read channels, manage conversations, and automate Slack workflows.',
    serverUrl: 'npx -y @modelcontextprotocol/server-slack',
    protocol: 'mcp',
    category: 'Communication',
    icon: MessageSquare,
    authFields: [{ key: 'SLACK_BOT_TOKEN', label: 'Bot Token', placeholder: 'xoxb-xxxxxxxxxxxx', helpUrl: 'https://api.slack.com/apps' }],
    capabilities: ['send_messages', 'read_channels', 'manage_users'],
  },
  {
    name: 'Google Drive',
    description: 'Search, read, and manage files in Google Drive. Access documents, spreadsheets, and presentations.',
    serverUrl: 'npx -y @modelcontextprotocol/server-gdrive',
    protocol: 'mcp',
    category: 'Productivity',
    icon: FileText,
    authFields: [{ key: 'GOOGLE_CLIENT_ID', label: 'Client ID', placeholder: 'xxxxx.apps.googleusercontent.com', helpUrl: 'https://console.cloud.google.com/apis/credentials' }, { key: 'GOOGLE_CLIENT_SECRET', label: 'Client Secret', placeholder: 'GOCSPX-xxxxxxxxxxxx' }],
    capabilities: ['search_files', 'read_files', 'create_files', 'manage_permissions'],
  },
  {
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases. Run read-only queries, inspect schemas, and analyze data.',
    serverUrl: 'npx -y @modelcontextprotocol/server-postgres',
    protocol: 'mcp',
    category: 'Database',
    icon: Database,
    authFields: [{ key: 'POSTGRES_CONNECTION_STRING', label: 'Connection String', placeholder: 'postgresql://user:pass@host:5432/db' }],
    capabilities: ['query', 'schema_inspection', 'data_analysis'],
  },
  {
    name: 'Brave Search',
    description: 'Web and local search powered by Brave. Get real-time search results with privacy-focused indexing.',
    serverUrl: 'npx -y @modelcontextprotocol/server-brave-search',
    protocol: 'mcp',
    category: 'Search',
    icon: Globe,
    authFields: [{ key: 'BRAVE_API_KEY', label: 'API Key', placeholder: 'BSAxxxxxxxxxxxxxxxxxxxx', helpUrl: 'https://brave.com/search/api/' }],
    capabilities: ['web_search', 'local_search', 'news_search'],
  },
  {
    name: 'Notion',
    description: 'Search, read, and create pages in Notion. Manage databases, blocks, and workspace content.',
    serverUrl: 'npx -y @modelcontextprotocol/server-notion',
    protocol: 'mcp',
    category: 'Productivity',
    icon: FileText,
    authFields: [{ key: 'NOTION_API_KEY', label: 'Integration Token', placeholder: 'ntn_xxxxxxxxxxxxxxxxxxxx', helpUrl: 'https://www.notion.so/my-integrations' }],
    capabilities: ['search_pages', 'read_pages', 'create_pages', 'manage_databases'],
  },
  {
    name: 'Sentry',
    description: 'Monitor errors, performance issues, and releases. Query issues and analyze stack traces.',
    serverUrl: 'npx -y @modelcontextprotocol/server-sentry',
    protocol: 'mcp',
    category: 'Development',
    icon: Shield,
    authFields: [{ key: 'SENTRY_AUTH_TOKEN', label: 'Auth Token', placeholder: 'sntrys_xxxxxxxxxxxxxxxxxxxx', helpUrl: 'https://sentry.io/settings/auth-tokens/' }],
    capabilities: ['list_issues', 'get_issue_details', 'search_events'],
  },
  {
    name: 'Filesystem',
    description: 'Read, write, and manage files on the local filesystem. Useful for agents that need file access.',
    serverUrl: 'npx -y @modelcontextprotocol/server-filesystem /path/to/allowed/dir',
    protocol: 'mcp',
    category: 'System',
    icon: FileText,
    authFields: [],
    capabilities: ['read_files', 'write_files', 'list_directories', 'search_files'],
  },
];

const CATEGORIES = ['All', 'Development', 'Communication', 'Productivity', 'Database', 'Search', 'System'];

function ConnectionsPage() {
  const connections = useQuery(api.mcpConnections.list, {}) ?? [];
  const createConnection = useMutation(api.mcpConnections.create);
  const removeConnection = useMutation(api.mcpConnections.remove);
  const toggleConnection = useMutation(api.mcpConnections.toggleEnabled);
  const testConnection = useAction(api.mcpConnectionActions.testConnection);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [tab, setTab] = useState<'catalog' | 'connected'>('catalog');
  const [connectingItem, setConnectingItem] = useState<typeof MCP_CATALOG[0] | null>(null);
  const [authValues, setAuthValues] = useState<Record<string, string>>({});
  const [confirmingDisconnectId, setConfirmingDisconnectId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; tools: string[]; error?: string }>>({});

  const connectedNames = new Set(connections.map((c: any) => c.name));

  const filteredCatalog = useMemo(() => {
    let result = MCP_CATALOG;
    if (categoryFilter !== 'All') result = result.filter(s => s.category === categoryFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
    }
    return result;
  }, [searchQuery, categoryFilter]);

  const handleConnect = async () => {
    if (!connectingItem) return;
    await createConnection({
      name: connectingItem.name,
      serverUrl: connectingItem.serverUrl,
      protocol: connectingItem.protocol,
      credentials: connectingItem.authFields.length > 0 ? authValues : undefined,
      capabilities: connectingItem.capabilities,
    });
    setConnectingItem(null);
    setAuthValues({});
    setTab('connected');
  };

  const handleDisconnectClick = (id: any) => {
    if (confirmingDisconnectId === id) {
      // Second click - actually disconnect
      removeConnection({ id });
      setConfirmingDisconnectId(null);
    } else {
      // First click - show confirm state
      setConfirmingDisconnectId(id);
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testConnection({ id });
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, tools: [], error: 'Test failed' } }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect MCP servers and external services to extend your agents.</p>
        </div>

        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          <button onClick={() => setTab('catalog')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'catalog' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Plug className="w-4 h-4 inline mr-2" />Catalog ({MCP_CATALOG.length})
          </button>
          <button onClick={() => setTab('connected')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'connected' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Check className="w-4 h-4 inline mr-2" />Connected ({connections.length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search integrations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-lg text-sm ${categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>{cat}</button>
            ))}
          </div>
        </div>

        {tab === 'catalog' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map(item => {
              const isConnected = connectedNames.has(item.name);
              const Icon = item.icon;
              return (
                <div key={item.name} className="bg-card border border-border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="font-semibold text-foreground">{item.name}</h3>
                        <p className="text-xs text-muted-foreground">{item.category}</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {item.capabilities.slice(0, 3).map(cap => (
                      <span key={cap} className="text-xs bg-muted px-2 py-0.5 rounded">{cap.replace(/_/g, ' ')}</span>
                    ))}
                    {item.capabilities.length > 3 && <span className="text-xs text-muted-foreground">+{item.capabilities.length - 3} more</span>}
                  </div>
                  <div className="pt-3 border-t border-border">
                    {isConnected ? (
                      <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Connected</span>
                    ) : (
                      <button onClick={() => { setConnectingItem(item); setAuthValues({}); }} className="w-full bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm hover:bg-primary/90 flex items-center justify-center gap-2">
                        <Plug className="w-4 h-4" /> Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          connections.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-lg">
              <Plug className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No integrations connected</h3>
              <p className="text-muted-foreground">Browse the catalog to connect your first integration.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((conn: any) => {
                const testResult = testResults[conn._id];
                const isTesting = testingId === conn._id;
                return (
                  <div key={conn._id} className="bg-card border border-border rounded-lg p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{conn.name}</h3>
                        {conn.toolCount !== undefined && conn.toolCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                            {conn.toolCount} tools
                          </span>
                        )}
                        {testResult?.ok && testResult.tools.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                            ✓ {testResult.tools.includes('stdio-protocol') ? 'connected' : `${testResult.tools.length} tools`}
                          </span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${conn.isEnabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>{conn.isEnabled ? 'Active' : 'Disabled'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 font-mono truncate">{conn.serverUrl}</p>
                    <p className="text-xs text-muted-foreground mb-3">Protocol: {conn.protocol}</p>
                    {testResult && !testResult.ok && (
                      <div className="mb-3 text-xs text-destructive bg-destructive/10 px-2 py-1 rounded">
                        {testResult.error || 'Connection failed'}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestConnection(conn._id)}
                          disabled={isTesting || !conn.isEnabled}
                          className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {isTesting ? 'Testing...' : 'Test'}
                        </button>
                        <button onClick={() => toggleConnection({ id: conn._id })} className="text-xs text-muted-foreground hover:text-foreground">{conn.isEnabled ? 'Disable' : 'Enable'}</button>
                      </div>
                      <button
                        onClick={() => handleDisconnectClick(conn._id)}
                        className={`p-1.5 rounded transition-colors ${
                          confirmingDisconnectId === conn._id
                            ? 'bg-destructive text-destructive-foreground'
                            : 'hover:bg-destructive/10'
                        }`}
                        title={confirmingDisconnectId === conn._id ? 'Click to confirm disconnect' : 'Disconnect integration'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Connect Modal */}
        {connectingItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg">
              <div className="flex justify-between items-center p-4 border-b border-border">
                <h2 className="text-lg font-bold">Connect {connectingItem.name}</h2>
                <button onClick={() => setConnectingItem(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">{connectingItem.description}</p>
                {connectingItem.authFields.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Authentication</h3>
                    {connectingItem.authFields.map(field => (
                      <div key={field.key}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium">{field.label}</label>
                          {field.helpUrl && <a href={field.helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">Get token <ExternalLink className="w-3 h-3" /></a>}
                        </div>
                        <input type="password" placeholder={field.placeholder} value={authValues[field.key] || ''} onChange={(e) => setAuthValues(prev => ({ ...prev, [field.key]: e.target.value }))} className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-green-500">No authentication required for this integration.</p>
                )}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-mono">{connectingItem.serverUrl}</p>
                </div>
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button onClick={() => setConnectingItem(null)} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm">Cancel</button>
                <button onClick={handleConnect} disabled={connectingItem.authFields.length > 0 && connectingItem.authFields.some(f => !authValues[f.key])} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  <Plug className="w-4 h-4" /> Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
