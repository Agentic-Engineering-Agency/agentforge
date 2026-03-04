import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Activity,
  Brain,
  Wrench,
  Database,
  AlertCircle,
  Clock,
  DollarSign,
  ArrowLeft,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/runs/$runId")({
  component: AgentRunPage,
});

// ============================================================
// Types
// ============================================================

type EventType = "llm" | "tool" | "memory" | "error";

interface RunEvent {
  id: string;
  type: EventType;
  name: string;
  timestamp: number;
  durationMs?: number;
  details?: Record<string, unknown>;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

interface RunSummary {
  runId: string;
  status: "running" | "completed" | "error";
  startTime: number;
  endTime?: number;
  totalDurationMs: number;
  totalCost: number;
  model: string;
  eventCount: number;
}

// ============================================================
// Helpers
// ============================================================

const EVENT_CONFIG: Record<EventType, { icon: typeof Brain; color: string; bgColor: string; label: string }> = {
  llm: { icon: Brain, color: "text-ae-accent", bgColor: "bg-ae-accent/20", label: "LLM Call" },
  tool: { icon: Wrench, color: "text-green-400", bgColor: "bg-green-500/20", label: "Tool Call" },
  memory: { icon: Database, color: "text-purple-400", bgColor: "bg-purple-500/20", label: "Memory Op" },
  error: { icon: AlertCircle, color: "text-red-400", bgColor: "bg-red-500/20", label: "Error" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function statusBadgeClass(status: RunSummary["status"]): string {
  if (status === "completed") return "px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400";
  if (status === "error") return "px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400";
  return "px-2 py-0.5 rounded text-xs bg-ae-accent/20 text-ae-accent";
}

// ============================================================
// Component
// ============================================================

function AgentRunPage() {
  const { runId } = Route.useParams();

  // Get all runs and filter by runId (workaround since runId is a string URL param)
  const runData = useQuery(api.workflows.listRuns, {});
  const run = runData?.find((r: any) => r._id === runId || r._id.endsWith(runId));

  // Get run steps for this run
  const runSteps = useQuery(api.workflows.getRunSteps,
    run ? { runId: run._id as any } : "skip"
  );

  // For now, show loading state or empty state if run not found
  const isLoading = runData === undefined;

  // Convert run steps to events for the timeline
  const events: RunEvent[] = (runSteps ?? []).map((step: any) => ({
    id: step._id,
    type: step.error ? "error" : "llm",
    name: step.name || step.stepId || "Unknown Step",
    timestamp: step.startedAt || step.createdAt || Date.now(),
    durationMs: step.startedAt && step.completedAt ? step.completedAt - step.startedAt : undefined,
    details: { output: step.output, input: step.input },
    error: step.error,
  }));

  const summary: RunSummary = run ? {
    runId: run._id,
    status: run.status === "failed" ? "error" : run.status === "completed" ? "completed" : "running",
    startTime: run.startedAt,
    endTime: run.completedAt ?? undefined,
    totalDurationMs: run.completedAt ? run.completedAt - run.startedAt : Date.now() - run.startedAt,
    totalCost: 0,
    model: "N/A",
    eventCount: events.length,
  } : {
    runId,
    status: "running",
    startTime: Date.now(),
    totalDurationMs: 0,
    totalCost: 0,
    model: "N/A",
    eventCount: 0,
  };

  const isEmpty = events.length === 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <a href="/chat" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </a>
              <h1 className="text-3xl font-bold">Agent Run</h1>
              <span className={statusBadgeClass(summary.status)}>{summary.status}</span>
            </div>
            <p className="text-muted-foreground mt-1 ml-8">
              Run ID: <code className="text-xs bg-card px-1.5 py-0.5 rounded border border-border">{runId}</code>
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "Duration", value: formatDuration(summary.totalDurationMs), icon: Clock, color: "text-ae-accent" },
            { label: "Cost", value: `$${summary.totalCost.toFixed(4)}`, icon: DollarSign, color: "text-green-400" },
            { label: "Model", value: summary.model, icon: Brain, color: "text-purple-400" },
            { label: "Events", value: String(summary.eventCount), icon: Activity, color: "text-orange-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-xl font-bold truncate">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Event Timeline
            </h3>
          </div>

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1">No events yet</h4>
              <p className="text-xs text-muted-foreground">Waiting for agent run events to stream in...</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event, index) => {
                const config = EVENT_CONFIG[event.type];
                const Icon = config.icon;
                return (
                  <div key={event.id} className="px-5 py-3 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-4">
                      {/* Timeline indicator */}
                      <div className="flex flex-col items-center pt-1">
                        <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        {index < events.length - 1 && (
                          <div className="w-px h-full bg-border mt-1 min-h-[16px]" />
                        )}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{event.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${config.bgColor} ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                            {event.durationMs !== undefined && (
                              <span className="font-mono">{formatDuration(event.durationMs)}</span>
                            )}
                            <span>{formatTimestamp(event.timestamp)}</span>
                          </div>
                        </div>

                        {/* Event details */}
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {event.model && <span>Model: {event.model}</span>}
                          {event.inputTokens !== undefined && <span>In: {event.inputTokens.toLocaleString()} tokens</span>}
                          {event.outputTokens !== undefined && <span>Out: {event.outputTokens.toLocaleString()} tokens</span>}
                          {event.error && <span className="text-red-400">{event.error}</span>}
                          {event.details && Object.entries(event.details).map(([k, v]) => (
                            <span key={k}>{k}: {String(v)}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
