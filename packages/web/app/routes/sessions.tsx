import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Activity, Clock, MessageSquare, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/sessions")({ component: SessionsPage });

type StatusFilter = "all" | "active" | "completed" | "error";

function statusColor(status: string) {
  if (status === "active") return "bg-green-500/20 text-green-400 border-green-700/40";
  if (status === "completed") return "bg-blue-500/20 text-blue-400 border-blue-700/40";
  return "bg-red-500/20 text-red-400 border-red-700/40";
}

function formatDuration(startedAt: number, completedAt?: number | null): string {
  const end = completedAt ?? Date.now();
  const s = Math.floor((end - startedAt) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const allSessions = useQuery(api.sessions.list, {}) ?? [];
  const endSessionMutation = useMutation(api.sessions.endSession);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return allSessions;
    const map: Record<string, string> = { active: "active", completed: "completed", error: "error" };
    return allSessions.filter((s: any) => s.status === (map[statusFilter] ?? statusFilter));
  }, [allSessions, statusFilter]);

  const loading = allSessions === undefined;

  const TABS: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Completed", value: "completed" },
    { label: "Error", value: "error" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 bg-background text-foreground">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-6 w-6" /> Sessions
        </h1>
        <p className="text-muted-foreground mb-6">Manage and monitor all agent sessions.</p>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-8">
            <Loader2 className="animate-spin h-5 w-5" /> Loading sessions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Activity className="mx-auto h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No sessions yet</p>
            <p className="text-sm mt-1">Sessions are created when you chat with an agent.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Session ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Started</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Duration</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session: any) => (
                  <tr key={session._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono">
                      <Link
                        to="/sessions/$sessionId"
                        params={{ sessionId: session._id }}
                        className="text-primary hover:underline"
                      >
                        {session.sessionId?.slice(0, 16) ?? session._id.slice(0, 16)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{session.agentId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(session.status)}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(session.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDuration(session.startedAt, session.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.status === "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => endSessionMutation({ sessionId: session._id })}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> End Session
                        </Button>
                      )}
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
