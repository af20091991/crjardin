import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listClients } from "@/lib/clients";
import { listAllInterventions } from "@/lib/interventions";
import { listPendingRecommendations } from "@/lib/garden";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ClipboardList, FileText, Sparkles, Plus, ArrowRight, Lightbulb, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Jardin Pro" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: interventions } = useQuery({ queryKey: ["interventions"], queryFn: listAllInterventions });
  const { data: pendingRecos } = useQuery({ queryKey: ["recommendations-pending"], queryFn: listPendingRecommendations });

  const clientName = (id: string) => clients?.find((c) => c.id === id)?.name ?? "Client";
  const recent = (interventions ?? []).slice(0, 5);

  const stats = [
    { label: "Clients actifs", value: clients?.length ?? 0, icon: Users, to: "/clients" as const },
    { label: "Interventions", value: interventions?.length ?? 0, icon: ClipboardList, to: "/clients" as const },
    { label: "Terminées", value: interventions?.filter((i) => i.status === "termine").length ?? 0, icon: FileText, to: "/clients" as const },
    { label: "Préco. en attente", value: pendingRecos?.length ?? 0, icon: Lightbulb, to: "/clients" as const },
  ];

  return (
    <AppShell title="Tableau de bord">
      <div className="mx-auto max-w-4xl space-y-5">
        <Card className="overflow-hidden border-none bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Bonjour 👋</h2>
              <p className="mt-1 text-sm text-primary-foreground/80">
                Suivez vos chantiers et produisez des comptes-rendus premium.
              </p>
            </div>
            <Link to="/interventions/new">
              <Button variant="secondary" className="w-full sm:w-auto">
                <Plus className="mr-1.5 h-4 w-4" /> Nouveau compte-rendu
              </Button>
            </Link>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} to={s.to}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="py-5">
                  <s.icon className="h-5 w-5 text-primary" />
                  <div className="mt-3 font-serif text-3xl font-semibold">
                    {isLoading ? <Skeleton className="h-8 w-10" /> : s.value}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">Interventions récentes</h3>
          </div>
          {(recent.length === 0) ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <ClipboardList className="h-7 w-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Aucune intervention. Créez votre premier compte-rendu.</p>
                <Link to="/interventions/new"><Button size="sm" className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Nouveau compte-rendu</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recent.map((iv) => (
                <Link key={iv.id} to="/interventions/$interventionId" params={{ interventionId: iv.id }}>
                  <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-primary/40">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{clientName(iv.client_id)}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(iv.intervention_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        {iv.intervention_type ? ` · ${iv.intervention_type}` : ""}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">Clients récents</h3>
            <Link to="/clients" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : (clients?.length ?? 0) === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Users className="h-7 w-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">Aucun client. Commencez par en créer un.</p>
                <Link to="/clients"><Button size="sm" className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Ajouter un client</Button></Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {clients!.slice(0, 5).map((c) => (
                <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }}>
                  <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-primary/40">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-serif font-semibold text-primary">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.address ?? c.contract_type ?? "—"}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}