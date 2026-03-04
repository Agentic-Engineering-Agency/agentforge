import { createFileRoute, Outlet, useMatch, Link } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Activity, Clock, MessageSquare, XCircle, ExternalLink } from 'lucide-react';

export const Route = createFileRoute('/sessions')({ component: SessionsPageLayout });

function SessionsPageLayout() {
  const childMatch = useMatch({ from: '/sessions/$sessionId', shouldThrow: false });
  if (childMatch) return <Outlet />;
  return <SessionsPage />;
}

function formatDuration(startTime: number, endTime?: number | null) {
  const end = endTime ?? Date.now();
  const seconds = Math.floor((end - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function statusBadgeVariant(status: string) {
  if (status === 'active') return 'default';
  if (status === 'completed') return 'secondary';
  if (status === 'error') return 'destructive';
  return 'outline';
}

function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const sessionsData = useQuery(api.sessions.list, {});
  const endSession = useMutation(api.sessions.endSession);

  const sessions = sessionsData ?? [];
  const isLoading = sessionsData === undefined;

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return sessions;
    return sessions.filter((s: any) => {
      if (statusFilter === 'active') return s.status === 'active';
      if (statusFilter === 'idle') return s.status === 'idle';
      if (statusFilter === 'ended') return s.status === 'completed' || s.status === 'error';
      return true;
    });
  }, [sessions, statusFilter]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-gray-400 text-sm mt-1">Manage and monitor all agent sessions.</p>
        </div>

        <div className="flex gap-2">
          {['all', 'active', 'idle', 'ended'].map(f => (
            <Button key={f} variant={statusFilter === f ? 'default' : 'ghost'} size="sm"
              onClick={() => setStatusFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-gray-400 py-8 text-center">Loading sessions…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-400 py-8 text-center">No sessions found.</div>
        ) : (
          <div className="rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-800/50">
                <tr>
                  {['Session ID', 'Agent', 'Status', 'Started', 'Duration', 'Messages', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-gray-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any) => (
                  <tr key={s._id} className="border-t border-gray-700 hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">
                      <Link to="/sessions/$sessionId" params={{ sessionId: s._id }}
                        className="hover:text-blue-400 flex items-center gap-1">
                        {s.sessionId?.slice(0, 20)}… <ExternalLink size={10} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{s.agentId}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadgeVariant(s.status) as any}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(s._creationTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDuration(s._creationTime, s.endTime)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={12} />
                        {s.messageCount ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'active' && (
                        <Button variant="destructive" size="sm"
                          onClick={() => endSession({ sessionId: s._id })}>
                          <XCircle size={12} className="mr-1" /> End
                        </Button>
                      )}
                      <Link to="/sessions/$sessionId" params={{ sessionId: s._id }}>
                        <Button variant="ghost" size="sm" className="ml-1">View</Button>
                      </Link>
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
