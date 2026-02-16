import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardLayout } from "~/components/DashboardLayout";
import { Bot, Plus, Play, Pause, Settings, Trash2 } from "lucide-react";

export const Route = createFileRoute("/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  const agents = [
    {
      id: "1",
      name: "Customer Support Agent",
      description: "Handles customer inquiries and support tickets",
      model: "gpt-4",
      provider: "OpenAI",
      isActive: true,
      lastRun: "2 minutes ago",
    },
    {
      id: "2",
      name: "Data Analyst Agent",
      description: "Analyzes data and generates reports",
      model: "claude-3-opus",
      provider: "Anthropic",
      isActive: true,
      lastRun: "15 minutes ago",
    },
    {
      id: "3",
      name: "Code Review Agent",
      description: "Reviews code and suggests improvements",
      model: "gpt-4-turbo",
      provider: "OpenAI",
      isActive: false,
      lastRun: "2 hours ago",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
            <p className="text-muted-foreground mt-2">
              Manage your AI agents and their configurations
            </p>
          </div>
          <Link
            to="/agents/new"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Agent
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-card rounded-lg border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{agent.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {agent.description}
                    </p>
                    <div className="flex items-center space-x-4 mt-3">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-muted-foreground">
                          Model:
                        </span>
                        <span className="text-xs font-medium">
                          {agent.model}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs text-muted-foreground">
                          Provider:
                        </span>
                        <span className="text-xs font-medium">
                          {agent.provider}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs text-muted-foreground">
                        Last run: {agent.lastRun}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    agent.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                  }`}
                >
                  {agent.isActive ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="flex items-center space-x-2 mt-6">
                <button className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  {agent.isActive ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </button>
                <button className="px-3 py-2 text-sm font-medium border rounded-md hover:bg-accent">
                  <Settings className="h-4 w-4" />
                </button>
                <button className="px-3 py-2 text-sm font-medium border rounded-md hover:bg-destructive hover:text-destructive-foreground">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
