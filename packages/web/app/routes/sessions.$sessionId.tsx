import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Activity,
  MessageSquare,
  Clock,
  User,
  ArrowLeft,
  Loader2,
  Bot,
} from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetailPage,
});

// ============================================================
// Types
// ============================================================

interface Message {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface SessionDetail {
  _id: string;
  sessionId: string;
  agentId: string;
  userId?: string;
  status: "active" | "paused" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
  lastActivityAt: number;
  messages: Message[];
}

// ============================================================
// Helpers
// ============================================================

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(startTime: number, endTime?: number): string {
  const end = endTime || Date.now();
  const seconds = Math.floor((end - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function statusBadgeClass(status: SessionDetail["status"]): string {
  switch (status) {
    case "active":
      return "px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400";
    case "paused":
      return "px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400";
    case "completed":
      return "px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400";
    case "error":
      return "px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400";
    default:
      return "px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400";
  }
}

function messageRoleBadge(role: Message["role"]): string {
  switch (role) {
    case "user":
      return "px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400";
    case "assistant":
      return "px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400";
    case "system":
      return "px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400";
    default:
      return "px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400";
  }
}

// ============================================================
// Component
// ============================================================

function SessionDetailPage() {
  const { sessionId } = Route.useParams();

  // Real Convex queries
  const sessionData = useQuery(api.sessions.getWithMessages, { sessionId });
  const isLoading = sessionData === undefined;

  // Handle not found
  if (!isLoading && !sessionData) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <a href="/sessions" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <h1 className="text-3xl font-bold">Session Not Found</h1>
          </div>
          <p className="text-muted-foreground">Session with ID "{sessionId}" could not be found.</p>
        </div>
      </DashboardLayout>
    );
  }

  // Transform session data to component format
  const session: SessionDetail | null = sessionData ? {
    _id: sessionData._id,
    sessionId: sessionData.sessionId || sessionData._id,
    agentId: sessionData.agentId,
    userId: sessionData.userId,
    status: sessionData.status as SessionDetail["status"],
    startedAt: sessionData.startedAt,
    completedAt: sessionData.completedAt ?? undefined,
    lastActivityAt: sessionData.lastActivityAt,
    messages: (sessionData.messagePreview || []).map((msg: any) => ({
      _id: msg._id,
      role: msg.role as Message["role"],
      content: msg.content,
      timestamp: msg.createdAt,
    })),
  } : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        {session && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <a href="/sessions" className="text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </a>
                  <h1 className="text-3xl font-bold">Session Details</h1>
                  <span className={statusBadgeClass(session.status)}>{session.status}</span>
                </div>
                <p className="text-muted-foreground mt-1 ml-8">
                  Session ID: <code className="text-xs bg-card px-1.5 py-0.5 rounded border border-border">{session.sessionId}</code>
                </p>
              </div>
            </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "Agent", value: session.agentId, icon: Bot, color: "text-purple-400" },
            { label: "Status", value: session.status, icon: Activity, color: "text-green-400" },
            { label: "Duration", value: formatDuration(session.startedAt, session.completedAt), icon: Clock, color: "text-blue-400" },
            { label: "Messages", value: String(session.messages.length), icon: MessageSquare, color: "text-orange-400" },
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

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              Message History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">Loading session messages...</p>
              </div>
            ) : session.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
                <h4 className="text-sm font-medium text-foreground mb-1">No messages</h4>
                <p className="text-xs text-muted-foreground">This session has no message history.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {session.messages.map((message) => (
                  <div key={message._id} className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {message.role === "user" ? (
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-400" />
                        </div>
                      ) : message.role === "assistant" ? (
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-purple-400" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-500/20 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm capitalize">{message.role}</span>
                        <span className={messageRoleBadge(message.role)}>{message.role}</span>
                        <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-sm">
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Details */}
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Session ID:</span>
                <p className="font-mono text-xs mt-1">{session.sessionId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Agent ID:</span>
                <p className="font-mono text-xs mt-1">{session.agentId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <p className="font-mono text-xs mt-1">{session.userId || "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="mt-1"><span className={statusBadgeClass(session.status)}>{session.status}</span></p>
              </div>
              <div>
                <span className="text-muted-foreground">Started:</span>
                <p className="text-xs mt-1">{formatTimestamp(session.startedAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <p className="text-xs mt-1">{session.completedAt ? formatTimestamp(session.completedAt) : "N/A"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Activity:</span>
                <p className="text-xs mt-1">{formatTimestamp(session.lastActivityAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="text-xs mt-1">{formatDuration(session.startedAt, session.completedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
