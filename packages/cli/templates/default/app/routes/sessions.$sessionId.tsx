import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  ArrowLeft,
  Bot,
  User,
  Clock,
  MessageSquare,
  Download,
  StopCircle,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetailPage,
});

// ============================================================
// Helpers
// ============================================================

function formatDuration(startTime: number, endTime?: number): string {
  const end = endTime ? endTime : Date.now();
  const seconds = Math.floor((end - startTime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "completed":
      return "secondary";
    case "error":
      return "destructive";
    case "paused":
      return "outline";
    default:
      return "outline";
  }
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-green-500 text-white";
    case "completed":
      return "bg-gray-500 text-white";
    case "error":
      return "bg-red-500 text-white";
    case "paused":
      return "bg-yellow-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

// ============================================================
// Export Function
// ============================================================

function exportTranscript(session: any, messages: any[], format: "txt" | "json") {
  let content: string;
  let mimeType: string;
  let filename: string;

  if (format === "json") {
    const data = {
      session: {
        sessionId: session.sessionId,
        agentId: session.agentId,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        threadId: session.threadId,
      },
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    };
    content = JSON.stringify(data, null, 2);
    mimeType = "application/json";
    filename = `session-${session.sessionId}.json`;
  } else {
    const lines = [
      `Session: ${session.sessionId}`,
      `Agent: ${session.agentId}`,
      `Status: ${session.status}`,
      `Started: ${formatTimestamp(session.startedAt)}`,
      session.completedAt ? `Ended: ${formatTimestamp(session.completedAt)}` : "",
      `Duration: ${formatDuration(session.startedAt, session.completedAt)}`,
      "",
      "Messages:",
      "---",
      "",
    ];

    messages.forEach((msg) => {
      const role = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : msg.role;
      const time = new Date(msg.createdAt).toLocaleTimeString();
      lines.push(`[${time}] ${role}:`);
      lines.push(msg.content);
      lines.push("");
    });

    content = lines.filter(Boolean).join("\n");
    mimeType = "text/plain";
    filename = `session-${session.sessionId}.txt`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Component
// ============================================================

function SessionDetailPage() {
  const { sessionId } = Route.useParams();

  // Queries
  const session = useQuery(api.sessions.get, { sessionId });
  const messages = useQuery(
    api.messages.getByThread,
    session?.threadId ? { threadId: session.threadId } : "skip"
  );
  const agents = useQuery(api.agents.listActive, {}) ?? [];
  const agent = agents.find((a: any) => a.id === session?.agentId);

  // Mutations
  const endSession = useMutation(api.sessions.updateStatus);
  const [isEnding, setIsEnding] = useState(false);
  const [exportFormat, setExportFormat] = useState<"txt" | "json">("txt");

  // Derived state
  const isLoading = session === undefined;
  const sessionNotFound = session === null;
  const hasMessages = messages && messages.length > 0;

  // Handlers
  const handleEndSession = async () => {
    if (!session) return;
    setIsEnding(true);
    try {
      await endSession({ sessionId: session.sessionId, status: "completed" });
    } catch (error) {
      console.error("Failed to end session:", error);
    } finally {
      setIsEnding(false);
    }
  };

  const handleExport = (format: "txt" | "json") => {
    if (!session || !messages) return;
    setExportFormat(format);
    exportTranscript(session, messages, format);
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Not found state
  if (sessionNotFound) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The session "{sessionId}" does not exist or has been deleted.
          </p>
          <Link to="/sessions">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link to="/sessions" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-3xl font-bold">Session Details</h1>
              <Badge className={statusBadgeColor(session.status)}>{session.status}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 ml-8">
              Session ID: <code className="text-xs bg-card px-1.5 py-0.5 rounded border border-border">{session.sessionId}</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session.status === "active" && (
              <Button variant="destructive" size="sm" onClick={handleEndSession} disabled={isEnding}>
                {isEnding ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <StopCircle className="h-4 w-4 mr-2" />
                )}
                End Session
              </Button>
            )}
            <div className="flex items-center gap-1 border border-border rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExport("txt")}
                title="Export as plain text"
              >
                <FileText className="h-4 w-4 mr-1" />
                TXT
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExport("json")}
                title="Export as JSON"
              >
                <Download className="h-4 w-4 mr-1" />
                JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={statusBadgeColor(session.status)}>{session.status}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Started</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{formatTimestamp(session.startedAt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Duration</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{formatDuration(session.startedAt, session.completedAt)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Messages</span>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{messages?.length ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Session Info Sidebar + Messages */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Session Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Agent</p>
                  {agent ? (
                    <span className="text-sm font-medium">{agent.name}</span>
                  ) : (
                    <span className="text-sm">{session.agentId}</span>
                  )}
                </div>
                {agent && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Model</p>
                      <p className="text-sm">{agent.model}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Provider</p>
                      <p className="text-sm capitalize">{agent.provider}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge className={statusBadgeColor(session.status)}>{session.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Started At</p>
                  <p className="text-sm">{formatTimestamp(session.startedAt)}</p>
                </div>
                {session.completedAt ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ended At</p>
                    <p className="text-sm">{formatTimestamp(session.completedAt)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ended At</p>
                    <p className="text-sm text-muted-foreground italic">Active</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Duration</p>
                  <p className="text-sm">{formatDuration(session.startedAt, session.completedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Messages</p>
                  <p className="text-sm">{messages?.length ?? 0}</p>
                </div>
                {session.channel && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Channel</p>
                    <p className="text-sm capitalize">{session.channel}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Messages Thread */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Message Thread</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasMessages ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                    <h3 className="text-lg font-semibold mb-1">No message history</h3>
                    <p className="text-sm text-muted-foreground">
                      {session.threadId ? "No messages have been sent in this session yet." : "This session has no associated thread."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages!.map((msg: any) => (
                      <div
                        key={msg._id}
                        className={`flex items-end gap-2.5 ${
                          msg.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="max-w-[75%]">
                          <div
                            className={`px-4 py-2.5 rounded-2xl ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : msg.role === "system"
                                ? "bg-yellow-900/30 border border-yellow-700/50 text-yellow-200"
                                : "bg-card border border-border rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          <div
                            className={`flex items-center gap-2 text-xs mt-1 px-1 ${
                              msg.role === "user"
                                ? "justify-end text-muted-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                        {msg.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
