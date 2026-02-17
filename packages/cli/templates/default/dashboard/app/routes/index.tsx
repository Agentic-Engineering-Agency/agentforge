import { createFileRoute, Link } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Bot, MessageSquare, FileText, Activity, Zap, Plus, CheckCircle, AlertTriangle } from 'lucide-react';

export const Route = createFileRoute('/')({ component: OverviewPage });

function StatCard({ icon: Icon, title, value, subtitle }: { icon: any; title: string; value: string | number; subtitle?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, to }: { icon: any; label: string; to: string }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center p-4 rounded-lg border border-border hover:bg-muted transition-colors gap-2">
      <Icon className="w-6 h-6 text-primary" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </Link>
  );
}

function OverviewPage() {
  const agents = useQuery(api.agents.list, {});
  const sessions = useQuery(api.sessions.list, {});
  const files = useQuery(api.files.list, {});
  const usage = useQuery(api.usage.list, {});
  const logs = useQuery(api.logs.list, { limit: 5 });

  const totalAgents = agents?.length ?? 0;
  const activeSessions = sessions?.filter((s: any) => s.status === 'active').length ?? 0;
  const totalFiles = files?.length ?? 0;
  const totalTokens = usage?.reduce((sum: number, u: any) => sum + (u.totalTokens || 0), 0) ?? 0;
  const isLoading = agents === undefined;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Overview</h1>
            <p className="text-muted-foreground">Welcome back. Here is a snapshot of your workspace.</p>
          </div>
          <div className="flex items-center space-x-2">
            {isLoading ? (
              <span className="text-sm text-muted-foreground animate-pulse">Connecting to Convex...</span>
            ) : (
              <><CheckCircle className="w-5 h-5 text-green-500" /><span className="text-sm font-medium text-green-500">All systems operational</span></>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={Bot} title="Total Agents" value={totalAgents} subtitle={`${agents?.filter((a: any) => a.isActive).length ?? 0} active`} />
          <StatCard icon={Activity} title="Active Sessions" value={activeSessions} />
          <StatCard icon={MessageSquare} title="Total Tokens Used" value={totalTokens.toLocaleString()} />
          <StatCard icon={FileText} title="Total Files" value={totalFiles} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow-sm border border-border">
            <h2 className="text-xl font-semibold mb-4 flex items-center"><Activity className="w-6 h-6 mr-2 text-primary" />Recent Activity</h2>
            {logs && logs.length > 0 ? (
              <ul>
                {logs.map((log: any) => (
                  <li key={log._id} className="flex items-center space-x-4 py-3 border-b border-border last:border-b-0">
                    <div className="bg-primary/10 p-2 rounded-full">
                      {log.level === 'error' ? <AlertTriangle className="w-5 h-5 text-destructive" /> : <Activity className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm text-foreground truncate">{log.message}</p>
                      <p className="text-xs text-muted-foreground">{log.source}</p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10">
                <Activity className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No recent activity yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Activity will appear here as you use your agents.</p>
              </div>
            )}
          </div>

          <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
            <h2 className="text-xl font-semibold mb-4 flex items-center"><Zap className="w-6 h-6 mr-2 text-primary" />Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <QuickActionButton icon={Bot} label="Create Agent" to="/agents" />
              <QuickActionButton icon={MessageSquare} label="Start Chat" to="/chat" />
              <QuickActionButton icon={FileText} label="Upload File" to="/files" />
              <QuickActionButton icon={Plus} label="New Project" to="/projects" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
