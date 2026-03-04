import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Bot, Activity, MessageSquare, FileText, Plus, Heart, Zap, ArrowRight, AlertTriangle, CheckCircle, LucideIcon } from 'lucide-react';

export const Route = createFileRoute('/')({ component: OverviewPage });

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  change: string;
}

function StatCard({ icon: Icon, title, value, change }: StatCardProps) {
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

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  to: string;
}

function QuickActionButton({ icon: Icon, label, to }: QuickActionButtonProps) {
  return (
    <a href={to} className="bg-card hover:bg-primary/10 border border-border p-4 rounded-lg flex flex-col items-center justify-center text-center transition-colors">
      <Icon className="w-8 h-8 text-primary mb-2" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </a>
  );
}

interface ActivityItemProps {
  icon: LucideIcon;
  text: string;
  time: string;
}

function ActivityItem({ icon: Icon, text, time }: ActivityItemProps) {
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

interface SystemHealthIndicatorProps {
  isHealthy: boolean;
}

function SystemHealthIndicator({ isHealthy }: SystemHealthIndicatorProps) {
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
  // Fetch real data from Convex - using individual queries
  const agents = useQuery(api.agents.listActive, {});
  const sessions = useQuery(api.sessions.list, {});

  // Calculate stats from the data
  const stats = useMemo(() => {
    const activeSessions = sessions?.filter((s: any) => s.status === 'active' || s.status === 'paused').length ?? 0;
    return {
      totalAgents: agents?.length ?? 0,
      activeSessions,
      messagesToday: 0, // Will be calculated when we have message history
      totalFiles: 0, // Will be added when files query exists
    };
  }, [agents, sessions]);

  // Use logs.list with pagination for recent activity
  const logsResult = useQuery(api.logs.list, {
    level: undefined,
    source: undefined,
    paginationOpts: { numItems: 5, cursor: null },
  });
  const recentLogs = logsResult?.page ?? [];

  // Derive activity from recent logs
  const activity = useMemo(() => {
    if (!recentLogs || recentLogs.length === 0) return [];

    const iconMap: Record<string, LucideIcon> = {
      agent: Bot,
      system: Zap,
      api: Activity,
      default: MessageSquare,
    };

    const formatTime = (timestamp: number) => {
      const diff = Date.now() - timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return `${days}d ago`;
    };

    return recentLogs.map((log: any, i: number) => ({
      id: i,
      icon: iconMap[log.source] || iconMap.default,
      text: log.message,
      time: formatTime(log.timestamp),
    }));
  }, [recentLogs]);

  const systemHealth = { isHealthy: true };

  // Show loading state
  const isLoading = agents === undefined || sessions === undefined;

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
          {isLoading ? (
            <>
              <div className="bg-card p-6 rounded-lg shadow-md flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
              <div className="bg-card p-6 rounded-lg shadow-md flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
              <div className="bg-card p-6 rounded-lg shadow-md flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
              <div className="bg-card p-6 rounded-lg shadow-md flex items-center justify-center">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            </>
          ) : (
            <>
              <StatCard icon={Bot} title="Total Agents" value={stats.totalAgents} change="Active agents" />
              <StatCard icon={Activity} title="Active Sessions" value={stats.activeSessions} change="Running now" />
              <StatCard icon={MessageSquare} title="Messages Today" value={stats.messagesToday.toLocaleString()} change="Today" />
              <StatCard icon={FileText} title="Total Files" value={stats.totalFiles} change="Stored files" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2 bg-card p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 flex items-center"><Activity className="w-6 h-6 mr-2 text-primary"/>Recent Activity</h2>
            {activity.length > 0 ? (
              <ul>
                {activity.map((item: any) => (
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
