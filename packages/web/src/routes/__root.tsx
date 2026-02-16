import { createRootRoute, Outlet } from "@tanstack/react-router";
import "../styles/globals.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
