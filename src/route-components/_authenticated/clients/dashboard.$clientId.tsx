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
import { ClientPhotosPanel, PhotoThumb } from "@/components/clients/ClientPhotosPanel";
import { Card } from "@/components/ui/card";
import { getClient } from "@/lib/clients";
import { listInterventionsByClient } from "@/lib/interventions";
import { listFreePhotos } from "@/lib/free-photos";

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

  const { data: freePhotos } = useQuery({
    queryKey: ["client-free-photos", clientId],
    queryFn: () => listFreePhotos(clientId),
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (interventions ?? [])
    .filter((iv) => iv.intervention_date >= today && iv.status !== "annulee")
    .sort((a, b) => a.intervention_date.localeCompare(b.intervention_date))
    .slice(0, 3);
  const latestPhotos = [...(freePhotos ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

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

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-3 p-4">
            <h2 className="font-serif text-lg font-semibold">Prochaines interventions</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune intervention planifiée.</p>
            ) : (
              <ul className="divide-y">
                {upcoming.map((iv) => (
                  <li key={iv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {iv.title ?? iv.intervention_type ?? "Intervention"}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {new Date(`${iv.intervention_date}T12:00:00`).toLocaleDateString("fr-FR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <h2 className="font-serif text-lg font-semibold">Dernières photos</h2>
            {latestPhotos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune photo ajoutée pour le moment.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2">
                {latestPhotos.map((photo) => (
                  <li key={photo.id} className="aspect-square overflow-hidden rounded-md border">
                    <PhotoThumb path={photo.storage_path} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

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
