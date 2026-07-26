import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  LayoutDashboard,
  Euro,
  Users,
  Target,
  Calculator,
  CalendarRange,
  HeartPulse,
  FileBarChart,
  Settings2,
  Clock,
  BarChart3,
  Link2,
  Receipt,
} from "lucide-react";
import { currentYear } from "@/lib/date-utils";
import { PilotModeProvider, usePilotMode } from "@/lib/pilot-mode";
import { Activity, LineChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot")({
  head: () => ({ meta: [{ title: "Pilot Pro — Pilotage financier" }] }),
  component: PilotLayout,
});

const TABS = [
  { to: "/pilot", label: "Aujourd'hui", icon: LayoutDashboard, exact: true },
  { to: "/pilot/direction", label: "Direction", icon: BarChart3, exact: false },
  { to: "/pilot/ca", label: `CA ${currentYear()}`, icon: Euro, exact: false },
  { to: "/pilot/taux", label: "Taux horaire", icon: Clock, exact: false },
  { to: "/pilot/clients", label: "Clients", icon: Users, exact: false },
  { to: "/pilot/prestations", label: "Prestations", icon: BarChart3, exact: false },
  { to: "/pilot/objectifs", label: "Objectifs", icon: Target, exact: false },
  { to: "/pilot/finance", label: "Finance", icon: Calculator, exact: false },
  { to: "/pilot/charges", label: "Charges", icon: Receipt, exact: false },
  { to: "/pilot/saison", label: "Saisonnalité", icon: CalendarRange, exact: false },
  { to: "/pilot/sante", label: "Santé", icon: HeartPulse, exact: false },
  { to: "/pilot/benchmark", label: "Benchmark & SMART", icon: BarChart3, exact: false },
  { to: "/pilot/rapports", label: "Rapports", icon: FileBarChart, exact: false },
  { to: "/pilot/rapprochement", label: "Rapprochement CA", icon: Link2, exact: false },
  { to: "/pilot/parametres", label: "Paramètres", icon: Settings2, exact: false },
] as const;

function PilotLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);
  return (
    <PilotModeProvider>
      <AppShell title="Pilot Pro">
        <div className="mx-auto max-w-6xl">
          <ModeSwitch />
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
    </PilotModeProvider>
  );
}

/** Bascule de lecture Réel / Projection, partagée par tous les onglets. */
function ModeSwitch() {
  const { mode, setMode } = usePilotMode();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setMode("reel")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "reel"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-3.5 w-3.5" /> Mode réel
        </button>
        <button
          type="button"
          onClick={() => setMode("projection")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "projection"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LineChart className="h-3.5 w-3.5" /> Mode projection
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "reel"
          ? "Données réellement enregistrées uniquement."
          : "Projection jusqu'au 31/12 à partir du CA à date, de la saisonnalité et des charges constatées."}
      </p>
    </div>
  );
}
