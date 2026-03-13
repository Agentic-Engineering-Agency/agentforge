import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardLayout } from "../components/DashboardLayout";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  ArrowLeft,
  Bot,
  Settings,
  MessageSquare,
  Clock,
  Zap,
  HardDrive,
  Container,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import * as Tabs from "@radix-ui/react-tabs";

export const Route = createFileRoute("/agents/$agentId")({
  component: AgentDetailPage,
});

// ============================================================
// Helpers
// ============================================================

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================
// Component
// ============================================================

function AgentDetailPage() {
  const { agentId } = Route.useParams();

  // Queries
  const agent = useQuery(api.agents.get, { id: agentId });
  const sessions = useQuery(
    api.sessions.list,
    agent ? { agentId: agent.id } : "skip"
  );

  // Mutations
  const updateAgent = useMutation(api.agents.update);

  // Form state for Settings tab
  const [settingsForm, setSettingsForm] = useState({
    name: agent?.name || "",
    description: agent?.description || "",
    instructions: agent?.instructions || "",
    model: agent?.model || "",
    provider: agent?.provider || "",
    temperature: agent?.temperature ?? 0.7,
    maxTokens: agent?.maxTokens ?? 4096,
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Update form when agent data loads
  if (agent && settingsForm.name !== agent.name) {
    setSettingsForm({
      name: agent.name,
      description: agent.description || "",
      instructions: agent.instructions || "",
      model: agent.model || "",
      provider: agent.provider || "",
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 4096,
    });
  }

  // Derived state
  const isLoading = agent === undefined;
  const agentNotFound = agent === null;

  // Handlers
  const handleSaveSettings = async () => {
    setSaveStatus("saving");
    try {
      await updateAgent({
        id: agentId,
        name: settingsForm.name,
        description: settingsForm.description,
        instructions: settingsForm.instructions,
        model: settingsForm.model,
        provider: settingsForm.provider,
        temperature: settingsForm.temperature,
        maxTokens: settingsForm.maxTokens,
      });
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to update agent:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
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
  if (agentNotFound) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Agent Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The agent "{agentId}" does not exist or has been deleted.
          </p>
          <Link to="/agents">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agents
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
              <Link to="/agents" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-3xl font-bold">{agent.name}</h1>
              <Badge className={agent.isActive ? "bg-green-500 text-white" : "bg-gray-500 text-white"}>
                {agent.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 ml-8">
              Agent ID: <code className="text-xs bg-card px-1.5 py-0.5 rounded border border-border">{agent.id}</code>
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs.Root defaultValue="overview" className="w-full">
          <Tabs.List className="flex border-b border-border mb-4">
            <Tabs.Trigger
              value="overview"
              className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary"
            >
              Overview
            </Tabs.Trigger>
            <Tabs.Trigger
              value="sessions"
              className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary"
            >
              Sessions ({sessions?.length ?? 0})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="settings"
              className="px-4 py-2 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary"
            >
              Settings
            </Tabs.Trigger>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Content value="overview" className="p-4 bg-card rounded-b-lg border border-t-0 border-border">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Agent Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Name</p>
                    <p className="text-sm font-medium">{agent.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <Badge className={agent.isActive ? "bg-green-500 text-white" : "bg-gray-500 text-white"}>
                      {agent.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Model</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      {agent.model || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Provider</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      {agent.provider || "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Temperature</p>
                    <p className="text-sm">{agent.temperature ?? 0.7}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Max Tokens</p>
                    <p className="text-sm">{agent.maxTokens ?? 4096}</p>
                  </div>
                </div>

                {agent.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{agent.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Instructions</p>
                  <div className="bg-background border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">{agent.instructions || "No instructions set"}</p>
                  </div>
                </div>

                {agent.failoverModels && agent.failoverModels.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Failover Chain</p>
                    <div className="space-y-2">
                      {agent.failoverModels.map((model: any, index: number) => (
                        <div key={index} className="bg-background border border-border rounded-md p-2 text-sm">
                          <span className="font-medium">{index + 1}.</span> {model.provider} / {model.model}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {agent.sandboxEnabled && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Sandbox</p>
                    <p className="text-sm flex items-center gap-2">
                      <Container className="h-4 w-4 text-muted-foreground" />
                      Enabled - {agent.sandboxImage || "node:20"}
                    </p>
                  </div>
                )}

                {agent.workspaceStorage && agent.workspaceStorage.type !== "local" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Workspace Storage</p>
                    <p className="text-sm flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      {agent.workspaceStorage.type.toUpperCase()}
                      {agent.workspaceStorage.bucket && ` - ${agent.workspaceStorage.bucket}`}
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Created: {formatTimestamp(agent.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {formatTimestamp(agent.updatedAt)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Tabs.Content>

          {/* Sessions Tab */}
          <Tabs.Content value="sessions" className="p-4 bg-card rounded-b-lg border border-t-0 border-border">
            {!sessions || sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No sessions yet</h3>
                <p className="text-sm text-muted-foreground">
                  This agent hasn't been used in any sessions yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session: any) => (
                  <Link
                    key={session._id}
                    to="/sessions/$sessionId"
                    params={{ sessionId: session.sessionId }}
                    className="block"
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Bot className="h-5 w-5 text-primary" />
                            <div>
                              <p className="text-sm font-medium">Session: {session.sessionId}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(session.startedAt)}
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={
                              session.status === "active"
                                ? "bg-green-500 text-white"
                                : session.status === "completed"
                                ? "bg-gray-500 text-white"
                                : "bg-red-500 text-white"
                            }
                          >
                            {session.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </Tabs.Content>

          {/* Settings Tab */}
          <Tabs.Content value="settings" className="p-4 bg-card rounded-b-lg border border-t-0 border-border">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Edit Agent Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                    rows={3}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Instructions
                  </label>
                  <textarea
                    value={settingsForm.instructions}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instructions: e.target.value })}
                    rows={8}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={settingsForm.model}
                      onChange={(e) => setSettingsForm({ ...settingsForm, model: e.target.value })}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Provider
                    </label>
                    <input
                      type="text"
                      value={settingsForm.provider}
                      onChange={(e) => setSettingsForm({ ...settingsForm, provider: e.target.value })}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Temperature
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={settingsForm.temperature}
                      onChange={(e) => setSettingsForm({ ...settingsForm, temperature: parseFloat(e.target.value) })}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settingsForm.maxTokens}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maxTokens: parseInt(e.target.value) })}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saveStatus === "saving"}
                    className="min-w-[100px]"
                  >
                    {saveStatus === "saving" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : saveStatus === "success" ? (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    ) : null}
                    {saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Saved!" : "Save Changes"}
                  </Button>
                  {saveStatus === "error" && (
                    <span className="text-sm text-destructive">Failed to save. Please try again.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </DashboardLayout>
  );
}
