import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

function PilotLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const title = pathname === "/pilot/calendrier" ? "Calendrier SST" : "Pilot Pro";

  return (
    <AppShell title={title}>
      <div className={pathname === "/pilot/calendrier" ? "w-full" : "mx-auto max-w-6xl"}>
        <Outlet />
      </div>
    </AppShell>
  );
}

export { PilotLayout };
export default PilotLayout;
