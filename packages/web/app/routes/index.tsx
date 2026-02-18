import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState } from 'react';
// import { useQuery } from 'convex/react';
// import { api } from '~/../convex/_generated/api';
import { Bot, Activity, MessageSquare, FileText, Plus, Heart, Zap, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react';

export const Route = createFileRoute('/')({ component: OverviewPage });

function StatCard({ icon: Icon, title, value, change }: { icon: React.ElementType; title: string; value: string | number; change: string }) {
  return (
    <div className="bg-card p-6 rounded-lg shadow-md flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className={`text-xs ${change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{change}</p>
      </div>
      <Icon className="w-10 h-10 text-primary" />
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, to }: { icon: React.ElementType; label: string; to: string }) {
  return (
    <a href={to} className="bg-card hover:bg-primary/10 border border-border p-4 rounded-lg flex flex-col items-center justify-center text-center transition-colors">
      <Icon className="w-8 h-8 text-primary mb-2" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </a>
  );
}

function ActivityItem({ icon: Icon, text, time }: { icon: React.ElementType; text: string; time: string }) {
  return (
    <li className="flex items-center space-x-4 py-3 border-b border-border last:border-b-0">
      <div className="bg-primary/10 p-2 rounded-full">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-grow">
        <p className="text-sm text-foreground">{text}</p>
      </div>
      <p className="text-xs text-muted-foreground whitespace-nowrap">{time}</p>
      <ArrowRight className="w-4 h-4 text-muted-foreground" />
    </li>
  );
}

function SystemHealthIndicator({ isHealthy }: { isHealthy: boolean }) {
    const Icon = isHealthy ? CheckCircle : AlertTriangle;
    const text = isHealthy ? 'All systems operational' : 'Service degradation';
    const color = isHealthy ? 'text-green-500' : 'text-yellow-500';

    return (
        <div className="flex items-center space-x-2">
            <Icon className={`w-5 h-5 ${color}`} />
            <span className={`text-sm font-medium ${color}`}>{text}</span>
        </div>
    );
}

function OverviewPage() {
  // Local state with realistic initial values, simulating data from Convex
  const [stats, setStats] = useState({
    totalAgents: 12,
    activeSessions: 3,
    messagesToday: 1402,
    totalFiles: 256,
  });

  const [activity, setActivity] = useState([
    { id: 1, icon: Bot, text: 'New agent "SupportBot" created.', time: '5m ago' },
    { id: 2, icon: MessageSquare, text: 'Session #1245 ended with 52 messages.', time: '1h ago' },
    { id: 3, icon: FileText, text: 'Uploaded "project_spec.pdf".', time: '3h ago' },
    { id: 4, icon: Zap, text: 'Agent "DataAnalyzer" completed a task.', time: '5h ago' },
    { id: 5, icon: Bot, text: 'Agent "CodeGenerator" was updated.', time: '1d ago' },
  ]);

  const [systemHealth, setSystemHealth] = useState({ isHealthy: true });

  // Commented-out Convex hooks for future integration
  /*
  const overviewStats = useQuery(api.overview.getStats);
  const recentActivity = useQuery(api.overview.getRecentActivity, { count: 5 });
  const systemStatus = useQuery(api.heartbeat.getStatus);

  // In a real implementation, you would use the data from hooks:
  // const stats = overviewStats || { totalAgents: 0, activeSessions: 0, messagesToday: 0, totalFiles: 0 };
  // const activity = recentActivity || [];
  // const systemHealth = { isHealthy: systemStatus === 'operational' };
  */

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-8 bg-background text-foreground">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold">Overview</h1>
                <p className="text-muted-foreground">Welcome back, here's a snapshot of your workspace.</p>
            </div>
            <SystemHealthIndicator isHealthy={systemHealth.isHealthy} />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={Bot} title="Total Agents" value={stats.totalAgents} change="+2 this week" />
          <StatCard icon={Activity} title="Active Sessions" value={stats.activeSessions} change="-1 since yesterday" />
          <StatCard icon={MessageSquare} title="Messages Today" value={stats.messagesToday.toLocaleString()} change="+15%" />
          <StatCard icon={FileText} title="Total Files" value={stats.totalFiles} change="+12 files" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 flex items-center"><Activity className="w-6 h-6 mr-2 text-primary"/>Recent Activity</h2>
            {activity.length > 0 ? (
              <ul>
                {activity.map(item => (
                  <ActivityItem key={item.id} icon={item.icon} text={item.text} time={item.time} />
                ))}
              </ul>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">No recent activity to display.</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 flex items-center"><Zap className="w-6 h-6 mr-2 text-primary"/>Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <QuickActionButton icon={Bot} label="Create Agent" to="/agents/new" />
              <QuickActionButton icon={MessageSquare} label="Start Chat" to="/chat" />
              <QuickActionButton icon={FileText} label="Upload File" to="/files" />
              <QuickActionButton icon={Plus} label="New Project" to="/projects/new" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
