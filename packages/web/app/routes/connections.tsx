
import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Plug, Plus, RefreshCw, CheckCircle, XCircle, Trash2, MoreVertical, Edit, Search, MessageCircle, Send, Hash } from 'lucide-react';

// --- Types ---
type ConnectionStatus = 'connected' | 'disconnected' | 'testing';

type ConnectionFormData = {
    _id?: Id<'mcpConnections'>;
    name: string;
    serverUrl: string;
    protocol: string;
};

interface Connection {
  _id: Id<'mcpConnections'>;
  name: string;
  serverUrl: string;
  protocol: string;
  isEnabled: boolean;
  isConnected: boolean;
  lastConnectedAt: number | undefined;
  credentials: any;
  capabilities: any;
}

// --- Reusable UI Components (assuming these are in a components/ui folder) ---
const Button = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={`px-4 py-2 rounded-md font-semibold transition-colors ${className}`} {...props}>
    {children}
  </button>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className={`w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${props.className}`} />
);

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select {...props} className={`w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary ${props.className}`}>
        {children}
    </select>
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`bg-card border border-border rounded-lg shadow-sm ${className}`} {...props}>
    {children}
  </div>
);

const Dialog = ({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md m-4">
                {children}
            </div>
        </div>
    );
};

const DialogHeader = ({ children }: { children: React.ReactNode }) => <div className="p-4 border-b border-border">{children}</div>;
const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2 className="text-lg font-semibold text-foreground">{children}</h2>;
const DialogContent = ({ children }: { children: React.ReactNode }) => <div className="p-4 space-y-4">{children}</div>;
const DialogFooter = ({ children }: { children: React.ReactNode }) => <div className="p-4 border-t border-border flex justify-end space-x-2">{children}</div>;

const Switch = ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`${checked ? 'bg-primary' : 'bg-muted'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background`}
    >
        <span className={`${checked ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
    </button>
);

// --- Page Specific Components ---

function ConnectionCard({ connection, onTest, onEdit, onDelete, onToggle, isTesting }: {
    connection: Connection & { status: ConnectionStatus; enabled: boolean; lastConnected: string | null };
    onTest: (id: Id<'mcpConnections'>) => void;
    onEdit: (connection: Connection) => void;
    onDelete: (id: Id<'mcpConnections'>) => void;
    onToggle: (id: Id<'mcpConnections'>) => void;
    isTesting: boolean;
}) {
    const StatusIndicator = () => {
        if (isTesting) return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
        switch (connection.status) {
            case 'connected': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'disconnected': return <XCircle className="h-5 w-5 text-red-500" />;
        }
    };

    return (
        <Card className="flex flex-col justify-between">
            <div className="p-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-3">
                        <Plug className="h-8 w-8 text-primary" />
                        <div>
                            <h3 className="font-bold text-foreground">{connection.name}</h3>
                            <p className="text-sm text-muted-foreground">{connection.protocol}</p>
                        </div>
                    </div>
                    <Switch checked={connection.enabled} onCheckedChange={() => onToggle(connection._id)} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                        <StatusIndicator />
                        <span className="capitalize text-muted-foreground">{isTesting ? 'testing' : connection.status}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <RefreshCw className="h-4 w-4" />
                        <span>Last connected: {connection.lastConnected ? new Date(connection.lastConnected).toLocaleDateString() : 'Never'}</span>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-background/50 border-t border-border flex items-center justify-end space-x-2">
                <Button onClick={() => onTest(connection._id)} disabled={isTesting} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm">Test</Button>
                <Button onClick={() => onEdit(connection)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm"><Edit className="h-4 w-4" /></Button>
                <Button onClick={() => onDelete(connection._id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/80 text-sm"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </Card>
    );
}

function ConnectionFormModal({ open, onClose, onSave, connection: initialConnection }: {
    open: boolean;
    onClose: () => void;
    onSave: (connection: ConnectionFormData) => void;
    connection: Connection | null;
}) {
    const [name, setName] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [protocol, setProtocol] = useState('mcp');

    React.useEffect(() => {
        if (initialConnection) {
            setName(initialConnection.name);
            setServerUrl(initialConnection.serverUrl);
            setProtocol(initialConnection.protocol);
        } else {
            setName('');
            setServerUrl('');
            setProtocol('mcp');
        }
    }, [initialConnection, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            _id: initialConnection?._id,
            name,
            serverUrl,
            protocol,
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <DialogHeader>
                    <DialogTitle>{initialConnection ? 'Edit Connection' : 'Add New Connection'}</DialogTitle>
                </DialogHeader>
                <DialogContent>
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium text-muted-foreground">Name</label>
                        <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="My Awesome API" required />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="serverUrl" className="text-sm font-medium text-muted-foreground">Server URL</label>
                        <Input id="serverUrl" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://example.com/api" required />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="protocol" className="text-sm font-medium text-muted-foreground">Protocol</label>
                        <Select id="protocol" value={protocol} onChange={e => setProtocol(e.target.value)} required>
                            <option value="mcp">MCP</option>
                            <option value="https">HTTPS</option>
                        </Select>
                    </div>
                </DialogContent>
                <DialogFooter>
                    <Button type="button" onClick={onClose} className="bg-muted text-muted-foreground hover:bg-muted/80">Cancel</Button>
                    <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/80">{initialConnection ? 'Save Changes' : 'Add Connection'}</Button>
                </DialogFooter>
            </form>
        </Dialog>
    );
}

// --- Main Page Component ---

export const Route = createFileRoute('/connections')({ component: ConnectionsPage });

function ConnectionsPage() {
    // --- Convex Hooks ---
    const connectionsQuery = useQuery(api.mcpConnections.list, {}) as Connection[] | undefined;
    const channelConns = useQuery(api.channelConnections.list, {}) ?? [];
    const createChannelConn = useMutation(api.channelConnections.create);
    const removeChannelConn = useMutation(api.channelConnections.remove);
    const [showTelegramDialog, setShowTelegramDialog] = React.useState(false);
    const [showSlackDialog, setShowSlackDialog] = React.useState(false);
    const [botToken, setBotToken] = React.useState('');
    const [savingChannel, setSavingChannel] = React.useState(false);
    const connections = connectionsQuery ?? [];
    const createConnection = useMutation(api.mcpConnections.create);
    const updateConnection = useMutation(api.mcpConnections.update);
    const updateStatusConnection = useMutation(api.mcpConnections.updateStatus);
    const deleteConnection = useMutation(api.mcpConnections.remove);
    const toggleConnection = useMutation(api.mcpConnections.toggleEnabled);

    // --- Local State ---
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);

    const isLoading = connectionsQuery === undefined;

    // Map Convex data to UI format first, then filter
    const uiConnections = (connections as typeof connections).map(c => ({
        ...c,
        status: c.isConnected ? 'connected' : 'disconnected' as ConnectionStatus,
        lastConnected: c.lastConnectedAt ? new Date(c.lastConnectedAt).toISOString() : null,
        enabled: c.isEnabled,
    }));

    const filteredConnections = useMemo(() =>
        uiConnections.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [uiConnections, searchTerm]
    );

    const handleAdd = () => {
        setEditingConnection(null);
        setIsModalOpen(true);
    };

    const handleEdit = (connection: Connection) => {
        setEditingConnection(connection);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: Id<'mcpConnections'>) => {
        await deleteConnection({ id });
    };

    const handleSave = async (data: ConnectionFormData) => {
        if (data._id) {
            const { _id, protocol, ...updatePayload } = data;
            await updateConnection({ id: _id!, ...updatePayload });
        } else {
            await createConnection(data);
        }
        setIsModalOpen(false);
    };

    const handleTest = async (id: Id<'mcpConnections'>) => {
        setTestingId(id);
        // TODO: Implement real connection test mutation when available
        // For now, mark as connected (placeholder until SPEC-012 channelConnections table)
        await updateStatusConnection({ id, isConnected: true });
        setTestingId(null);
    };

    const handleToggle = async (id: Id<'mcpConnections'>) => {
        await toggleConnection({ id });
    };

    return (
        <DashboardLayout>
            <div className="bg-background text-foreground p-4 sm:p-6 lg:p-8">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Connections</h1>
                        <p className="text-muted-foreground">Manage your MCP connections.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search connections..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full sm:w-64"
                            />
                        </div>
                        <Button onClick={handleAdd} className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            <span>Add Connection</span>
                        </Button>
                    </div>
                </header>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(3)].map((_, i) => <Card key={i} className="h-48 animate-pulse"></Card>)}
                    </div>
                ) : filteredConnections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredConnections.map(conn => (
                            <ConnectionCard
                                key={conn._id}
                                connection={conn}
                                onTest={handleTest}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
                                isTesting={testingId === conn._id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center h-64 bg-card rounded-lg border-2 border-dashed border-border">
                        <Plug className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold">No Connections Found</h3>
                        <p className="text-muted-foreground mb-4">Get started by adding your first connection.</p>
                        <Button onClick={handleAdd} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            Add Connection
                        </Button>
                    </div>
                )}
            </div>

            <ConnectionFormModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                connection={editingConnection}
            />
  
        <div className="mt-8 border-t border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Messaging Channels</h2>
            <span className="text-xs text-gray-400">Connect agents to chat platforms</span>
          </div>
          {channelConns.length > 0 && (
            <div className="space-y-2 mb-4">
              {(channelConns as any[]).map((cc) => (
                <div key={cc._id} className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {cc.channel === 'telegram' ? <Send className="w-4 h-4 text-blue-400" /> : <Hash className="w-4 h-4 text-purple-400" />}
                    <span className="text-sm text-white capitalize">{cc.channel} &mdash; {cc.config?.botUsername ?? 'bot'}</span>
                    <span className="text-xs text-gray-400">Agent: {cc.agentId}</span>
                  </div>
                  <button onClick={() => removeChannelConn({ id: cc._id })} className="text-xs text-red-400 border border-red-700 rounded px-2 py-1 hover:text-red-300">Remove</button>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3"><Send className="w-5 h-5 text-blue-400" /><p className="text-sm font-medium text-white">Telegram</p></div>
              <button onClick={() => setShowTelegramDialog(true)} className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded">+ Connect Bot</button>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3"><Hash className="w-5 h-5 text-purple-400" /><p className="text-sm font-medium text-white">Slack</p></div>
              <button onClick={() => setShowSlackDialog(true)} className="w-full text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded">+ Connect App</button>
            </div>
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 opacity-50">
              <div className="flex items-center gap-2 mb-3"><MessageCircle className="w-5 h-5 text-indigo-400" /><p className="text-sm font-medium text-white">Discord</p></div>
              <button disabled className="w-full text-xs bg-gray-700 text-gray-500 px-3 py-2 rounded cursor-not-allowed">Coming Soon</button>
            </div>
          </div>
        </div>
        {showTelegramDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-white font-semibold mb-2">Connect Telegram Bot</h3>
              <input type="password" placeholder="1234567890:ABCDEF..." value={botToken} onChange={e => setBotToken(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-blue-500" />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowTelegramDialog(false); setBotToken(''); }} className="text-xs text-gray-400 px-4 py-2">Cancel</button>
                <button disabled={!botToken || savingChannel} onClick={async () => { setSavingChannel(true); try { await createChannelConn({ channel: 'telegram', botToken, agentId: 'default' }); setShowTelegramDialog(false); setBotToken(''); } finally { setSavingChannel(false); } }} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded">{savingChannel ? 'Saving...' : 'Connect'}</button>
              </div>
            </div>
          </div>
        )}
        {showSlackDialog && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-white font-semibold mb-2">Connect Slack App</h3>
              <input type="password" placeholder="xoxb-..." value={botToken} onChange={e => setBotToken(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white mb-4 focus:outline-none focus:border-purple-500" />
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setShowSlackDialog(false); setBotToken(''); }} className="text-xs text-gray-400 px-4 py-2">Cancel</button>
                <button disabled={!botToken || savingChannel} onClick={async () => { setSavingChannel(true); try { await createChannelConn({ channel: 'slack', botToken, agentId: 'default' }); setShowSlackDialog(false); setBotToken(''); } finally { setSavingChannel(false); } }} className="text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded">{savingChannel ? 'Saving...' : 'Connect'}</button>
              </div>
            </div>
          </div>
        )}

      </DashboardLayout>
    );
}

// ─── Messaging Channels Section (added after Team C SPEC-012) ───────────────
// This is appended below the MCP connections component.
// The route itself exports the full page including both sections.
