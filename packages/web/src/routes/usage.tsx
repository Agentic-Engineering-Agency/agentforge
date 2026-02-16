import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "~/components/DashboardLayout";
import { useState } from "react";
import { BarChart3, DollarSign, Cpu, Activity, TrendingUp, Calendar, Bot, Zap } from "lucide-react";

export const Route = createFileRoute("/usage")({ component: UsagePage });

interface UsageRecord {
  id: string; agentName: string; provider: string; model: string;
  promptTokens: number; completionTokens: number; totalTokens: number;
  cost: number; timestamp: number;
}

function UsagePage() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const [records] = useState<UsageRecord[]>([
    { id: "u1", agentName: "Customer Support", provider: "openai", model: "gpt-4o", promptTokens: 12500, completionTokens: 8200, totalTokens: 20700, cost: 0.62, timestamp: Date.now() - 3600000 },
    { id: "u2", agentName: "Code Review", provider: "anthropic", model: "claude-3.5-sonnet", promptTokens: 45000, completionTokens: 15000, totalTokens: 60000, cost: 1.35, timestamp: Date.now() - 7200000 },
    { id: "u3", agentName: "Data Analyst", provider: "openrouter", model: "mixtral-8x7b", promptTokens: 8000, completionTokens: 4500, totalTokens: 12500, cost: 0.08, timestamp: Date.now() - 14400000 },
    { id: "u4", agentName: "Customer Support", provider: "openai", model: "gpt-4o-mini", promptTokens: 6000, completionTokens: 3200, totalTokens: 9200, cost: 0.09, timestamp: Date.now() - 28800000 },
    { id: "u5", agentName: "Research Agent", provider: "google", model: "gemini-pro", promptTokens: 22000, completionTokens: 11000, totalTokens: 33000, cost: 0.17, timestamp: Date.now() - 43200000 },
    { id: "u6", agentName: "Code Review", provider: "anthropic", model: "claude-3.5-sonnet", promptTokens: 38000, completionTokens: 12000, totalTokens: 50000, cost: 1.13, timestamp: Date.now() - 86400000 },
    { id: "u7", agentName: "Writer Agent", provider: "openai", model: "gpt-4o", promptTokens: 15000, completionTokens: 20000, totalTokens: 35000, cost: 1.05, timestamp: Date.now() - 172800000 },
    { id: "u8", agentName: "Data Analyst", provider: "xai", model: "grok-2", promptTokens: 10000, completionTokens: 5000, totalTokens: 15000, cost: 0.30, timestamp: Date.now() - 259200000 },
  ]);

  const totalTokens = records.reduce((s, r) => s + r.totalTokens, 0);
  const totalCost = records.reduce((s, r) => s + r.cost, 0);
  const uniqueAgents = new Set(records.map((r) => r.agentName)).size;
  const totalSessions = records.length;

  // Cost by provider
  const costByProvider: Record<string, number> = {};
  records.forEach((r) => { costByProvider[r.provider] = (costByProvider[r.provider] || 0) + r.cost; });
  const maxProviderCost = Math.max(...Object.values(costByProvider), 1);
  const providerColors: Record<string, string> = { openai: "bg-green-500", anthropic: "bg-orange-500", openrouter: "bg-blue-500", google: "bg-yellow-500", xai: "bg-purple-500" };

  // Top agents by usage
  const agentUsage: Record<string, { tokens: number; cost: number }> = {};
  records.forEach((r) => {
    if (!agentUsage[r.agentName]) agentUsage[r.agentName] = { tokens: 0, cost: 0 };
    agentUsage[r.agentName].tokens += r.totalTokens;
    agentUsage[r.agentName].cost += r.cost;
  });
  const topAgents = Object.entries(agentUsage).sort((a, b) => b[1].tokens - a[1].tokens);
  const maxAgentTokens = topAgents.length > 0 ? topAgents[0][1].tokens : 1;

  // Tokens over time (last 7 days)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString("en-US", { weekday: "short" }), date: d.toDateString() };
  });
  const tokensByDay = days.map((day) => {
    const dayTokens = records.filter((r) => new Date(r.timestamp).toDateString() === day.date).reduce((s, r) => s + r.totalTokens, 0);
    return { ...day, tokens: dayTokens };
  });
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
            { label: "Total Tokens", value: formatTokens(totalTokens), icon: Zap, color: "text-blue-400", sub: `${records.length} requests` },
            { label: "Total Cost", value: `$${totalCost.toFixed(2)}`, icon: DollarSign, color: "text-green-400", sub: `Avg $${(totalCost / Math.max(records.length, 1)).toFixed(3)}/req` },
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
            {topAgents.map(([name, data], i) => (
              <div key={name} className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-6 text-right">#{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">{formatTokens(data.tokens)} tokens · ${data.cost.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-accent rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(data.tokens / maxAgentTokens) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Usage Records */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />Recent Usage Records</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground text-left"><th className="px-5 py-3 font-medium">Agent</th><th className="px-5 py-3 font-medium">Provider</th><th className="px-5 py-3 font-medium">Model</th><th className="px-5 py-3 font-medium text-right">Prompt</th><th className="px-5 py-3 font-medium text-right">Completion</th><th className="px-5 py-3 font-medium text-right">Total</th><th className="px-5 py-3 font-medium text-right">Cost</th><th className="px-5 py-3 font-medium">Time</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b hover:bg-accent/50">
                  <td className="px-5 py-3 font-medium">{r.agentName}</td>
                  <td className="px-5 py-3"><span className="capitalize px-2 py-0.5 bg-accent rounded text-xs">{r.provider}</span></td>
                  <td className="px-5 py-3 text-muted-foreground">{r.model}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{r.promptTokens.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{r.completionTokens.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-medium">{r.totalTokens.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right font-medium text-green-400">${r.cost.toFixed(3)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
