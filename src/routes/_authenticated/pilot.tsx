import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  LayoutDashboard, Euro, Users, Target, Calculator, CalendarRange,
  SlidersHorizontal, HeartPulse, FileBarChart, Settings2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot")({
  head: () => ({ meta: [{ title: "Pilot Pro — Pilotage financier" }] }),
  component: PilotLayout,
});

const TABS = [
  { to: "/pilot", label: "Direction", icon: LayoutDashboard, exact: true },
  { to: "/pilot/ca", label: "Suivi du CA", icon: Euro, exact: false },
  { to: "/pilot/clients", label: "Clients", icon: Users, exact: false },
  { to: "/pilot/objectifs", label: "Objectifs", icon: Target, exact: false },
  { to: "/pilot/finance", label: "Finance", icon: Calculator, exact: false },
  { to: "/pilot/saison", label: "Saisonnalité", icon: CalendarRange, exact: false },
  { to: "/pilot/simulateur", label: "Simulateur", icon: SlidersHorizontal, exact: false },
  { to: "/pilot/sante", label: "Santé", icon: HeartPulse, exact: false },
  { to: "/pilot/rapports", label: "Rapports", icon: FileBarChart, exact: false },
  { to: "/pilot/parametres", label: "Paramètres", icon: Settings2, exact: false },
] as const;

function PilotLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string, exact: boolean) => (exact ? pathname === to : pathname.startsWith(to));
  return (
    <AppShell title="Pilot Pro">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 -mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-1 rounded-xl border border-border bg-card p-1">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active(t.to, t.exact)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            ))}
          </div>
        </div>
        <Outlet />
      </div>
    </AppShell>
  );
}