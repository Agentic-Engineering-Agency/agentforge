import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { BarChart3, DollarSign, Cpu, Activity, TrendingUp, Calendar, Bot, Zap } from "lucide-react";

export const Route = createFileRoute("/usage")({ component: UsagePage });

interface UsageRecord {
  id: string; agentName: string; provider: string; model: string;
  promptTokens: number; completionTokens: number; totalTokens: number;
  cost: number; timestamp: number;
}

function UsagePage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  // Convert date range to startTime
  const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
  const days = daysMap[dateRange];
  const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

  // Fetch real usage data from Convex (using existing getStats function)
  const usageStats = useQuery(api.usage.getStats, { startTime });

  // Show loading state
  const summary = usageStats ?? {
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    byProvider: {},
    byModel: {},
  };

  const totalTokens = summary.totalTokens;
  const totalCost = summary.totalCost;
  const totalSessions = summary.totalRequests;
  const uniqueAgents = Object.keys(summary.byProvider).length; // Approximate

  // Cost by provider
  const costByProvider: Record<string, number> = {};
  const providerColors: Record<string, string> = {};

  Object.entries(summary.byProvider || {}).forEach(([provider, data]: [string, any]) => {
    costByProvider[provider] = data.cost || 0;
    if (!providerColors[provider]) {
      const colors: Record<string, string> = {
        openai: "bg-green-500",
        anthropic: "bg-orange-500",
        openrouter: "bg-ae-accent",
        google: "bg-yellow-500",
        xai: "bg-purple-500",
      };
      providerColors[provider] = colors[provider] || "bg-primary";
    }
  });

  const maxProviderCost = Math.max(...Object.values(costByProvider), 1);

  // Top agents by model (simplified - using byModel data)
  const topAgents = Object.entries(summary.byModel || {})
    .map(([model, data]: [string, any]) => ({
      agentId: model,
      agentName: model,
      tokens: data.tokens || 0,
      cost: data.cost || 0,
    }))
    .sort((a: any, b: any) => b.tokens - a.tokens)
    .slice(0, 10);
  const maxAgentTokens = topAgents.length > 0 ? (topAgents[0] as any).tokens : 1;

  // Generate tokens over time (last 7 days) - simplified placeholder
  const daysLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.toDateString(),
    };
  });
  const tokensByDay = daysLabels.map((day) => ({
    ...day,
    tokens: Math.floor(totalTokens / 7),
  }));
  const maxDayTokens = Math.max(...tokensByDay.map((d) => d.tokens), 1);

  const formatTokens = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Usage & Metrics</h1><p className="text-muted-foreground mt-1">Monitor token usage, costs, and agent performance</p></div>
          <div className="flex items-center gap-1 bg-card border rounded-lg p-1">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <button key={range} onClick={() => setDateRange(range)} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${dateRange === range ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Tokens", value: formatTokens(totalTokens), icon: Zap, color: "text-ae-accent", sub: `${totalSessions} requests` },
            { label: "Total Cost", value: `$${totalCost.toFixed(2)}`, icon: DollarSign, color: "text-green-400", sub: `Avg $${(totalCost / Math.max(totalSessions, 1)).toFixed(3)}/req` },
            { label: "Active Agents", value: uniqueAgents.toString(), icon: Bot, color: "text-purple-400", sub: "Using LLM providers" },
            { label: "Total Requests", value: totalSessions.toString(), icon: Activity, color: "text-orange-400", sub: "In selected period" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tokens Over Time */}
          <div className="bg-card border rounded-lg p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Tokens Over Time</h3>
            <div className="flex items-end gap-2 h-40">
              {tokensByDay.map((day) => (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{day.tokens > 0 ? formatTokens(day.tokens) : ""}</span>
                  <div className="w-full bg-primary/20 rounded-t-sm relative" style={{ height: `${Math.max((day.tokens / maxDayTokens) * 120, 4)}px` }}>
                    <div className="absolute inset-0 bg-primary rounded-t-sm" style={{ height: "100%" }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cost by Provider */}
          <div className="bg-card border rounded-lg p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4 text-muted-foreground" />Cost by Provider</h3>
            <div className="space-y-3">
              {Object.entries(costByProvider).sort((a, b) => b[1] - a[1]).map(([provider, cost]) => (
                <div key={provider} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{provider}</span>
                    <span className="font-medium">${cost.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-2 bg-accent rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${providerColors[provider] || "bg-primary"}`} style={{ width: `${(cost / maxProviderCost) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Agents */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" />Top Agents by Usage</h3>
          <div className="space-y-3">
            {topAgents.map((agent, i) => (
              <div key={agent.agentId} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-6 text-right">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{agent.agentName}</span>
                    <span className="text-muted-foreground">{formatTokens(agent.tokens)} tokens · ${agent.cost.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(agent.tokens / maxAgentTokens) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usage by Model */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Usage by Model</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground text-left"><th className="px-5 py-3 font-medium">Model</th><th className="px-5 py-3 font-medium text-right">Requests</th><th className="px-5 py-3 font-medium text-right">Total Tokens</th><th className="px-5 py-3 font-medium text-right">Total Cost</th></tr></thead>
            <tbody>
              {Object.entries(summary.byModel || {}).map(([model, data]: [string, any]) => (
                <tr key={model} className="border-b hover:bg-accent/50">
                  <td className="px-5 py-3 font-medium">{model}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{data.requests || 0}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{formatTokens(data.tokens || 0)}</td>
                  <td className="px-5 py-3 text-right font-medium text-green-400">${(data.cost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
