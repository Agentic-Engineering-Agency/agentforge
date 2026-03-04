import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';
import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { BarChart3, TrendingUp, DollarSign, Zap, Activity } from 'lucide-react';

export const Route = createFileRoute('/usage')({ component: UsagePage });

function StatCard({ icon: Icon, title, value, subtitle }: { icon: any; title: string; value: string; subtitle?: string }) {
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

function UsagePage() {
  const stats = useQuery(api.usage.getStats, {});
  const usageResult = useQuery(api.usage.list, { paginationOpts: { numItems: 20, cursor: null } });
  const usageRecords = usageResult?.page ?? [];

  const totalTokens = stats?.totalTokens ?? 0;
  const totalCost = stats?.totalCost ?? 0;
  const totalRequests = stats?.totalRequests ?? 0;
  const byProvider = stats?.byProvider ?? {};
  const byModel = stats?.byModel ?? {};

  const providerEntries = useMemo(() => Object.entries(byProvider).sort((a: any, b: any) => b[1].tokens - a[1].tokens), [byProvider]);
  const modelEntries = useMemo(() => Object.entries(byModel).sort((a: any, b: any) => b[1].tokens - a[1].tokens), [byModel]);

  // Calculate max for bar chart scaling
  const maxProviderTokens = providerEntries.length > 0 ? Math.max(...providerEntries.map(([, v]: any) => v.tokens)) : 1;
  const maxModelTokens = modelEntries.length > 0 ? Math.max(...modelEntries.map(([, v]: any) => v.tokens)) : 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Usage</h1>
          <p className="text-muted-foreground">Monitor token consumption, costs, and API usage across providers.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={Zap} title="Total Tokens" value={totalTokens.toLocaleString()} />
          <StatCard icon={DollarSign} title="Total Cost" value={`$${totalCost.toFixed(4)}`} />
          <StatCard icon={Activity} title="Total Requests" value={totalRequests.toLocaleString()} />
          <StatCard icon={TrendingUp} title="Avg Tokens/Request" value={totalRequests > 0 ? Math.round(totalTokens / totalRequests).toLocaleString() : '0'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Provider */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Usage by Provider</h2>
            {providerEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No usage data yet. Start chatting with your agents.</div>
            ) : (
              <div className="space-y-3">
                {providerEntries.map(([provider, data]: any) => (
                  <div key={provider}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{provider}</span>
                      <div className="text-xs text-muted-foreground">
                        {data.tokens.toLocaleString()} tokens &middot; ${data.cost.toFixed(4)} &middot; {data.requests} req
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${(data.tokens / maxProviderTokens) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Model */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Usage by Model</h2>
            {modelEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No usage data yet.</div>
            ) : (
              <div className="space-y-3">
                {modelEntries.map(([model, data]: any) => (
                  <div key={model}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium font-mono">{model}</span>
                      <div className="text-xs text-muted-foreground">
                        {data.tokens.toLocaleString()} tokens &middot; ${data.cost.toFixed(4)}
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${(data.tokens / maxModelTokens) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Usage Records */}
        {usageRecords.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Recent API Calls</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Model</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Provider</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tokens</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cost</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {usageRecords.slice(0, 20).map((record: any) => (
                  <tr key={record._id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{record.model}</td>
                    <td className="px-4 py-3">{record.provider}</td>
                    <td className="px-4 py-3">{record.totalTokens.toLocaleString()}</td>
                    <td className="px-4 py-3">${(record.cost || 0).toFixed(4)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleString()}</td>
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
