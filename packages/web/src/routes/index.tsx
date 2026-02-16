import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "~/components/DashboardLayout";
import { Bot, MessageSquare, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  component: OverviewPage,
});

function OverviewPage() {
  const stats = [
    {
      name: "Active Agents",
      value: "3",
      icon: Bot,
      change: "+2",
      changeType: "positive",
    },
    {
      name: "Active Sessions",
      value: "12",
      icon: MessageSquare,
      change: "+4",
      changeType: "positive",
    },
    {
      name: "Cron Jobs",
      value: "5",
      icon: Clock,
      change: "0",
      changeType: "neutral",
    },
    {
      name: "Total Messages",
      value: "1,234",
      icon: TrendingUp,
      change: "+123",
      changeType: "positive",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your AgentForge deployment and agent activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="bg-card rounded-lg border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.name}
                    </p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  </div>
                </div>
              </div>
              {stat.change !== "0" && (
                <div className="mt-4">
                  <span
                    className={`text-sm font-medium ${
                      stat.changeType === "positive"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    from last week
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                {
                  agent: "Customer Support Agent",
                  action: "Completed conversation",
                  time: "2 minutes ago",
                },
                {
                  agent: "Data Analyst Agent",
                  action: "Generated report",
                  time: "15 minutes ago",
                },
                {
                  agent: "Code Review Agent",
                  action: "Reviewed pull request",
                  time: "1 hour ago",
                },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{activity.agent}</p>
                      <p className="text-sm text-muted-foreground">
                        {activity.action}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
