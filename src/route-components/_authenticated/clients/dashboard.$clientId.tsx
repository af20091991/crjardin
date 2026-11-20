import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Images,
  Leaf,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClientPhotosPanel } from "@/components/clients/ClientPhotosPanel";
import { Card } from "@/components/ui/card";
import { getClient } from "@/lib/clients";
import { listInterventionsByClient } from "@/lib/interventions";

type FicheTab = "interventions" | "calendar" | "health" | "reco" | "opps";

/** Accès rapides vers les écrans de la fiche, pour tout client (Premium ou non). */
const SHORTCUTS: { tab: FicheTab; label: string; icon: LucideIcon }[] = [
  { tab: "interventions", label: "Interventions", icon: ClipboardList },
  { tab: "calendar", label: "Calendrier", icon: CalendarDays },
  { tab: "health", label: "Évaluations", icon: Leaf },
  { tab: "reco", label: "Préconisations", icon: Sparkles },
  { tab: "opps", label: "Opportunités", icon: TrendingUp },
];

export function ClientDashboard() {
  const { clientId } = useParams({ from: "/_authenticated/clients/dashboard/$clientId" });
  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClient(clientId),
  });
  const { data: interventions } = useQuery({
    queryKey: ["interventions", clientId],
    queryFn: () => listInterventionsByClient(clientId),
  });

  return (
    <AppShell title="Dashboard client">
      <div className="space-y-6">
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la fiche
        </Link>

        <header>
          <h1 className="font-serif text-2xl font-semibold">{client?.name ?? "Client"}</h1>
          {client?.address && <p className="text-sm text-muted-foreground">{client.address}</p>}
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SHORTCUTS.map(({ tab, label, icon: Icon }) => (
            <Link
              key={tab}
              to="/clients/$clientId"
              params={{ clientId }}
              search={{ tab }}
              className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-center text-sm font-medium hover:bg-accent/40"
            >
              <Icon className="h-5 w-5 text-primary" />
              {label}
            </Link>
          ))}
        </section>

        <Card className="space-y-4 p-4">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <Images className="h-5 w-5 text-primary" />
            Photos et albums
          </h2>
          <ClientPhotosPanel
            clientId={clientId}
            interventions={(interventions ?? []).map((iv) => ({
              id: iv.id,
              title: iv.title ?? null,
              intervention_type: iv.intervention_type ?? null,
              intervention_date: iv.intervention_date,
            }))}
          />
        </Card>
      </div>
    </AppShell>
  );
}
