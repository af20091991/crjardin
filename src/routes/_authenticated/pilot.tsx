import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/pilot")({
  head: () => ({ meta: [{ title: "Pilot Pro — Pilotage financier" }] }),
  component: PilotLayout,
});

function PilotLayout() {
  return (
    <AppShell title="Pilot Pro">
      <div className="mx-auto max-w-6xl">
        <Outlet />
      </div>
    </AppShell>
  );
}
