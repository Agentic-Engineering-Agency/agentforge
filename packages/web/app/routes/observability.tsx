import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState } from "react";
import { Activity, DollarSign, Zap, Target } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

export const Route = createFileRoute("/observability")({
  component: ObservabilityPage,
});

interface TraceRecord {
  id: string;
  timestamp: number;
  agent: string;
  model: string;
  latency: number;
  inputTokens: number;
  outputTokens: number;
  status: "success" | "error" | "timeout";
}

interface CostRecord {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}

interface ScorerRecord {
  id: string;
  agent: string;
  qualityScore: number;
  latencyScore: number;
  efficiencyScore: number;
  lastEvaluated: number;
}

function statusBadgeClass(status: TraceRecord["status"]) {
  if (status === "success") return "px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400";
  if (status === "error") return "px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400";
  return "px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400";
}

function ObservabilityPage() {
  const [traces] = useState<TraceRecord[]>([
    { id: "t1", timestamp: Date.now() - 60000, agent: "Customer Support", model: "claude-opus-4-6", latency: 1240, inputTokens: 1200, outputTokens: 580, status: "success" },
    { id: "t2", timestamp: Date.now() - 180000, agent: "Code Review", model: "gpt-4o", latency: 2100, inputTokens: 3400, outputTokens: 1200, status: "success" },
    { id: "t3", timestamp: Date.now() - 360000, agent: "Research Agent", model: "gemini-pro", latency: 4500, inputTokens: 5000, outputTokens: 2100, status: "timeout" },
    { id: "t4", timestamp: Date.now() - 720000, agent: "Data Analyst", model: "mixtral-8x7b", latency: 980, inputTokens: 800, outputTokens: 350, status: "success" },
    { id: "t5", timestamp: Date.now() - 1440000, agent: "Writer Agent", model: "claude-opus-4-6", latency: 3200, inputTokens: 4200, outputTokens: 3800, status: "success" },
    { id: "t6", timestamp: Date.now() - 2880000, agent: "Customer Support", model: "gpt-4o-mini", latency: 650, inputTokens: 600, outputTokens: 240, status: "error" },
    { id: "t7", timestamp: Date.now() - 5760000, agent: "Code Review", model: "gpt-4o", latency: 1870, inputTokens: 2900, outputTokens: 980, status: "success" },
  ]);

  const [costData] = useState<CostRecord[]>([
    { model: "claude-opus-4-6", calls: 42, inputTokens: 185000, outputTokens: 94000, totalCost: 8.24 },
    { model: "gpt-4o", calls: 38, inputTokens: 142000, outputTokens: 61000, totalCost: 6.15 },
    { model: "gpt-4o-mini", calls: 120, inputTokens: 210000, outputTokens: 88000, totalCost: 1.34 },
    { model: "gemini-pro", calls: 25, inputTokens: 95000, outputTokens: 42000, totalCost: 0.69 },
    { model: "mixtral-8x7b", calls: 60, inputTokens: 78000, outputTokens: 32000, totalCost: 0.42 },
  ]);

  const [scorerResults] = useState<ScorerRecord[]>([
    { id: "s1", agent: "Customer Support", qualityScore: 92, latencyScore: 88, efficiencyScore: 85, lastEvaluated: Date.now() - 3600000 },
    { id: "s2", agent: "Code Review", qualityScore: 87, latencyScore: 72, efficiencyScore: 91, lastEvaluated: Date.now() - 7200000 },
    { id: "s3", agent: "Research Agent", qualityScore: 79, latencyScore: 55, efficiencyScore: 68, lastEvaluated: Date.now() - 14400000 },
    { id: "s4", agent: "Data Analyst", qualityScore: 95, latencyScore: 94, efficiencyScore: 90, lastEvaluated: Date.now() - 28800000 },
    { id: "s5", agent: "Writer Agent", qualityScore: 83, latencyScore: 70, efficiencyScore: 76, lastEvaluated: Date.now() - 86400000 },
  ]);

  const totalSpend = costData.reduce((s, r) => s + r.totalCost, 0);
  const totalCalls = costData.reduce((s, r) => s + r.calls, 0);
  const avgCostPerCall = totalCalls > 0 ? totalSpend / totalCalls : 0;
  const totalTokens = costData.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
    return n.toString();
  };

  const scoreColor = (score: number) => {
    if (score >= 90) return "text-green-400";
    if (score >= 75) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Observability</h1>
          <p className="text-muted-foreground mt-1">Monitor LLM traces, costs, and agent quality scores</p>
        </div>

        <Tabs defaultValue="traces">
          <TabsList>
            <TabsTrigger value="traces">Trace List</TabsTrigger>
            <TabsTrigger value="cost">Cost Analytics</TabsTrigger>
            <TabsTrigger value="scorers">Scorer Results</TabsTrigger>
          </TabsList>

          {/* Tab 1: Trace List */}
          <TabsContent value="traces">
            <div className="bg-card border rounded-lg overflow-hidden mt-4">
              <div className="px-5 py-4 border-b">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Recent LLM Traces
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 font-medium">Model</th>
                    <th className="px-5 py-3 font-medium text-right">Latency (ms)</th>
                    <th className="px-5 py-3 font-medium text-right">Input Tokens</th>
                    <th className="px-5 py-3 font-medium text-right">Output Tokens</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.map((trace) => (
                    <tr key={trace.id} className="border-b hover:bg-accent/50">
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(trace.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-5 py-3 font-medium">{trace.agent}</td>
                      <td className="px-5 py-3 text-muted-foreground">{trace.model}</td>
                      <td className="px-5 py-3 text-right font-mono">{trace.latency.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{trace.inputTokens.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground">{trace.outputTokens.toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className={statusBadgeClass(trace.status)}>{trace.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Tab 2: Cost Analytics */}
          <TabsContent value="cost">
            <div className="space-y-4 mt-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Total Spend", value: `$${totalSpend.toFixed(2)}`, icon: DollarSign, color: "text-green-400" },
                  { label: "Avg Cost/Call", value: `$${avgCostPerCall.toFixed(4)}`, icon: DollarSign, color: "text-blue-400" },
                  { label: "Total Tokens", value: formatTokens(totalTokens), icon: Zap, color: "text-purple-400" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-card border rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <stat.icon className={`h-5 w-5 ${stat.color}`} />
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Cost by Model Table */}
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Cost Analytics by Model
                  </h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="px-5 py-3 font-medium">Model</th>
                      <th className="px-5 py-3 font-medium text-right">Calls</th>
                      <th className="px-5 py-3 font-medium text-right">Input Tokens</th>
                      <th className="px-5 py-3 font-medium text-right">Output Tokens</th>
                      <th className="px-5 py-3 font-medium text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costData.sort((a, b) => b.totalCost - a.totalCost).map((row) => (
                      <tr key={row.model} className="border-b hover:bg-accent/50">
                        <td className="px-5 py-3 font-medium">{row.model}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{row.calls}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{formatTokens(row.inputTokens)}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{formatTokens(row.outputTokens)}</td>
                        <td className="px-5 py-3 text-right font-medium text-green-400">${row.totalCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Scorer Results */}
          <TabsContent value="scorers">
            <div className="bg-card border rounded-lg overflow-hidden mt-4">
              <div className="px-5 py-4 border-b">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  Scorer Results by Agent
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">Agent</th>
                    <th className="px-5 py-3 font-medium text-right">Quality Score</th>
                    <th className="px-5 py-3 font-medium text-right">Latency Score</th>
                    <th className="px-5 py-3 font-medium text-right">Efficiency Score</th>
                    <th className="px-5 py-3 font-medium">Last Evaluated</th>
                  </tr>
                </thead>
                <tbody>
                  {scorerResults.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-accent/50">
                      <td className="px-5 py-3 font-medium">{row.agent}</td>
                      <td className={`px-5 py-3 text-right font-bold ${scoreColor(row.qualityScore)}`}>{row.qualityScore}</td>
                      <td className={`px-5 py-3 text-right font-bold ${scoreColor(row.latencyScore)}`}>{row.latencyScore}</td>
                      <td className={`px-5 py-3 text-right font-bold ${scoreColor(row.efficiencyScore)}`}>{row.efficiencyScore}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(row.lastEvaluated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
