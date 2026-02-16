import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "~/components/DashboardLayout";

export const Route = createFileRoute("/skills")({
  component: SkillsPage,
});

function SkillsPage() {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-bold capitalize">skills</h1>
        <p className="text-muted-foreground mt-2">Skills management</p>
        <div className="mt-6 bg-card rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">Skills page coming soon...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
