import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Activity, Clock, Trash2, Search, Filter, X, MessageSquare } from 'lucide-react';

export const Route = createFileRoute('/sessions')({ component: SessionsPage });

function SessionsPage() {
  const sessions = useQuery(api.sessions.list, {}) ?? [];
  const removeSession = useMutation(api.sessions.remove);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = sessions;
    if (statusFilter !== 'all') {
      result = result.filter((s: any) => s.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s: any) => s.sessionId.toLowerCase().includes(q) || s.agentId.toLowerCase().includes(q));
    }
    return result;
  }, [sessions, searchQuery, statusFilter]);

  const handleDelete = async (id: any) => {
    if (confirm('Delete this session?')) {
      await removeSession({ id });
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-500',
    paused: 'bg-yellow-500/10 text-yellow-500',
    completed: 'bg-blue-500/10 text-blue-500',
    error: 'bg-red-500/10 text-red-500',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">Monitor active and past agent sessions.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search by session or agent ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-lg">
            <Activity className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{sessions.length === 0 ? 'No sessions yet' : 'No matching sessions'}</h3>
            <p className="text-muted-foreground">Sessions are created when agents start conversations.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Session ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Channel</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Started</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Activity</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session: any) => (
                  <tr key={session._id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{session.sessionId}</td>
                    <td className="px-4 py-3">{session.agentId}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[session.status] || 'bg-muted text-muted-foreground'}`}>{session.status}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{session.channel || 'dashboard'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(session.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(session.lastActivityAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(session._id)} className="p-1.5 rounded hover:bg-destructive/10"><Trash2 className="w-4 h-4 text-destructive" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
