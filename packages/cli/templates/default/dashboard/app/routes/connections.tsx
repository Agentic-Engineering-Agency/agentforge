
import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import React, { useState, useMemo } from 'react';
// import { useQuery, useMutation } from 'convex/react';
// import { api } from '../../convex/_generated/api';
import { Plug, Plus, RefreshCw, CheckCircle, XCircle, Trash2, MoreVertical, Edit, Search } from 'lucide-react';

// --- Mock Data and Types ---
type ConnectionStatus = 'connected' | 'disconnected' | 'testing';
type ConnectionType = 'MCP' | 'API' | 'Webhook';

interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  status: ConnectionStatus;
  lastConnected: string | null;
  serverUrl: string;
  protocol: string;
  enabled: boolean;
}

const mockConnections: Connection[] = [
  {
    id: '1',
    name: 'Cloudflare MCP',
    type: 'MCP',
    status: 'connected',
    lastConnected: new Date(Date.now() - 86400000).toISOString(),
    serverUrl: 'https://mcp.cloudflare.com',
    protocol: 'mcp',
    enabled: true,
  },
  {
    id: '2',
    name: 'Stripe API',
    type: 'API',
    status: 'disconnected',
    lastConnected: new Date(Date.now() - 604800000).toISOString(),
    serverUrl: 'https://api.stripe.com',
    protocol: 'https',
    enabled: true,
  },
  {
    id: '3',
    name: 'GitHub Webhook',
    type: 'Webhook',
    status: 'connected',
    lastConnected: new Date().toISOString(),
    serverUrl: 'https://api.github.com/webhooks',
    protocol: 'https',
    enabled: false,
  },
];

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

function ConnectionCard({ connection, onTest, onEdit, onDelete, onToggle }: {
    connection: Connection;
    onTest: (id: string) => void;
    onEdit: (connection: Connection) => void;
    onDelete: (id: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}) {
    const StatusIndicator = () => {
        switch (connection.status) {
            case 'connected': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'disconnected': return <XCircle className="h-5 w-5 text-red-500" />;
            case 'testing': return <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />;
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
                            <p className="text-sm text-muted-foreground">{connection.type}</p>
                        </div>
                    </div>
                    <Switch checked={connection.enabled} onCheckedChange={(checked) => onToggle(connection.id, checked)} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                        <StatusIndicator />
                        <span className="capitalize text-muted-foreground">{connection.status}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                        <RefreshCw className="h-4 w-4" />
                        <span>Last connected: {connection.lastConnected ? new Date(connection.lastConnected).toLocaleDateString() : 'Never'}</span>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-background/50 border-t border-border flex items-center justify-end space-x-2">
                <Button onClick={() => onTest(connection.id)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm">Test</Button>
                <Button onClick={() => onEdit(connection)} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm"><Edit className="h-4 w-4" /></Button>
                <Button onClick={() => onDelete(connection.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/80 text-sm"><Trash2 className="h-4 w-4" /></Button>
            </div>
        </Card>
    );
}

function ConnectionFormModal({ open, onClose, onSave, connection: initialConnection }: {
    open: boolean;
    onClose: () => void;
    onSave: (connection: Omit<Connection, 'id' | 'status' | 'lastConnected'> & { id?: string }) => void;
    connection: Connection | null;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<ConnectionType>('MCP');
    const [serverUrl, setServerUrl] = useState('');
    const [credentials, setCredentials] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'success' | 'error' | null>(null);

    React.useEffect(() => {
        if (initialConnection) {
            setName(initialConnection.name);
            setType(initialConnection.type);
            setServerUrl(initialConnection.serverUrl);
            setCredentials('********'); // Don't expose credentials
        } else {
            setName('');
            setType('MCP');
            setServerUrl('');
            setCredentials('');
        }
        setTestStatus(null);
    }, [initialConnection, open]);

    const handleTest = async () => {
        setIsTesting(true);
        setTestStatus(null);
        // const testConnection = useMutation(api.mcpConnections.test);
        // In a real app, you'd call the mutation:
        // try {
        //   await testConnection({ serverUrl, credentials });
        //   setTestStatus('success');
        // } catch (error) {
        //   setTestStatus('error');
        // }
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        if (serverUrl.includes('fail')) {
            setTestStatus('error');
        } else {
            setTestStatus('success');
        }
        setIsTesting(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: initialConnection?.id,
            name,
            type,
            serverUrl,
            protocol: type === 'MCP' ? 'mcp' : 'https',
            enabled: initialConnection?.enabled ?? true,
            // Credentials would be handled securely, not passed like this
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
                        <label htmlFor="type" className="text-sm font-medium text-muted-foreground">Type</label>
                        <Select id="type" value={type} onChange={e => setType(e.target.value as ConnectionType)} required>
                            <option value="MCP">MCP</option>
                            <option value="API">API</option>
                            <option value="Webhook">Webhook</option>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="serverUrl" className="text-sm font-medium text-muted-foreground">Server URL</label>
                        <Input id="serverUrl" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://example.com/api" required />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="credentials" className="text-sm font-medium text-muted-foreground">Credentials (e.g., API Key)</label>
                        <Input id="credentials" type="password" value={credentials} onChange={e => setCredentials(e.target.value)} placeholder={initialConnection ? 'Enter new key to update' : 'Your secret key'} />
                    </div>
                    {testStatus && (
                        <div className={`flex items-center space-x-2 text-sm p-2 rounded-md ${testStatus === 'success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                            {testStatus === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            <span>{testStatus === 'success' ? 'Connection successful!' : 'Connection failed.'}</span>
                        </div>
                    )}
                </DialogContent>
                <DialogFooter>
                    <Button type="button" onClick={handleTest} className="bg-secondary text-secondary-foreground hover:bg-secondary/80" disabled={isTesting}>
                        {isTesting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</> : 'Test Connection'}
                    </Button>
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
    // --- Convex Hooks (Commented Out) ---
    // const connections = useQuery(api.mcpConnections.list) ?? [];
    // const createConnection = useMutation(api.mcpConnections.create);
    // const updateConnection = useMutation(api.mcpConnections.update);
    // const deleteConnection = useMutation(api.mcpConnections.delete);
    // const testConnection = useMutation(api.mcpConnections.test);
    // const toggleConnection = useMutation(api.mcpConnections.toggle);

    // --- Local State Management ---
    const [connections, setConnections] = useState<Connection[]>(mockConnections);
    const [isLoading, setIsLoading] = useState(false); // For initial load
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConnection, setEditingConnection] = useState<Connection | null>(null);

    const filteredConnections = useMemo(() =>
        connections.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [connections, searchTerm]
    );

    const handleAdd = () => {
        setEditingConnection(null);
        setIsModalOpen(true);
    };

    const handleEdit = (connection: Connection) => {
        setEditingConnection(connection);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this connection?')) {
            // await deleteConnection({ id });
            setConnections(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleSave = (data: Omit<Connection, 'id' | 'status' | 'lastConnected'> & { id?: string }) => {
        if (data.id) { // Update
            // await updateConnection({ id: data.id, ...data });
            setConnections(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
        } else { // Create
            const newId = (Math.random() * 100000).toString();
            // const newId = await createConnection(data);
            const newConnection: Connection = {
                ...data,
                id: newId,
                status: 'disconnected',
                lastConnected: null,
            };
            setConnections(prev => [newConnection, ...prev]);
        }
    };

    const handleTest = async (id: string) => {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, status: 'testing' } : c));
        // const result = await testConnection({ id });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate test
        const result = { success: Math.random() > 0.3 }; // Simulate success/fail

        setConnections(prev => prev.map(c => c.id === id ? {
            ...c,
            status: result.success ? 'connected' : 'disconnected',
            lastConnected: result.success ? new Date().toISOString() : c.lastConnected,
        } : c));
    };

    const handleToggle = (id: string, enabled: boolean) => {
        // await toggleConnection({ id, enabled });
        setConnections(prev => prev.map(c => c.id === id ? { ...c, enabled } : c));
    };

    return (
        <DashboardLayout>
            <div className="bg-background text-foreground p-4 sm:p-6 lg:p-8">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Connections</h1>
                        <p className="text-muted-foreground">Manage your MCP, API, and Webhook connections.</p>
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
                ) : error ? (
                    <div className="flex flex-col items-center justify-center text-center h-64 bg-card rounded-lg">
                        <XCircle className="h-12 w-12 text-destructive mb-4" />
                        <h3 className="text-xl font-semibold">Failed to load connections</h3>
                        <p className="text-muted-foreground">{error}</p>
                    </div>
                ) : filteredConnections.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredConnections.map(conn => (
                            <ConnectionCard
                                key={conn.id}
                                connection={conn}
                                onTest={handleTest}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onToggle={handleToggle}
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
        </DashboardLayout>
    );
}
