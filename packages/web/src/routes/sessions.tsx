import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "~/components/DashboardLayout";

export const Route = createFileRoute("/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold">Sessions</h1>
        <p className="text-muted-foreground mt-2">View and manage active agent sessions</p>
        <div className="mt-6 bg-card rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">Sessions management coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
