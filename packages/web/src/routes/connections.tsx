import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "~/components/DashboardLayout";

export const Route = createFileRoute("/connections")({
  component: ConnectionsPage,
});

function ConnectionsPage() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold capitalize">connections</h1>
        <p className="text-muted-foreground mt-2">Connections management</p>
        <div className="mt-6 bg-card rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">Connections page coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
