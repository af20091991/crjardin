import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { listClients } from "@/lib/clients";
import { listAllInterventions } from "@/lib/interventions";
import { listAllRecommendations, recommendationPrice, formatEuro } from "@/lib/garden";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RemindersWidget } from "@/components/RemindersWidget";
import {
  Users, ClipboardList, FileText, Plus, ArrowRight, Lightbulb, Clock,
  Search, TrendingUp, AlertTriangle, Euro,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Tableau de bord — Jardin Pro" }] }),
  component: Dashboard,
});

const DAY = 1000 * 60 * 60 * 24;

function Dashboard() {
  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: interventions } = useQuery({ queryKey: ["interventions"], queryFn: listAllInterventions });
  const { data: recos } = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });

  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const clientName = (id: string) => clients?.find((c) => c.id === id)?.name ?? "Client";

  const pending = (recos ?? []).filter((r) => r.status === "en_attente");
  const accepted = (recos ?? []).filter((r) => r.status === "acceptee" || r.status === "realisee");
  const potentialRevenue = pending.reduce((s, r) => s + (recommendationPrice(r) ?? 0), 0);
  const acceptedRevenue = accepted.reduce((s, r) => s + (recommendationPrice(r) ?? 0), 0);
  const decided = (recos ?? []).filter((r) => r.status !== "en_attente");
  const conversion = decided.length > 0 ? Math.round((accepted.length / decided.length) * 100) : 0;

  const now = Date.now();
  const oldDrafts = (interventions ?? []).filter(
    (iv) => iv.status === "brouillon" && now - new Date(iv.created_at).getTime() > 7 * DAY,
  );
  const stalePending = pending.filter((r) => now - new Date(r.created_at).getTime() > 30 * DAY);

  const stats = [
    { label: "Clients actifs", value: clients?.length ?? 0, icon: Users, to: "/clients" as const },
    { label: "Interventions", value: interventions?.length ?? 0, icon: ClipboardList, to: "/clients" as const },
    { label: "Terminées", value: interventions?.filter((i) => i.status === "termine").length ?? 0, icon: FileText, to: "/clients" as const },
    { label: "Préco. en attente", value: pending.length, icon: Lightbulb, to: "/clients" as const },
  ];

  const filteredClients = useMemo(() => {
    if (!q) return (clients ?? []).slice(0, 5);
    return (clients ?? []).filter((c) =>
      [c.name, c.address, c.contract_type].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [clients, q]);

  const filteredInterventions = useMemo(() => {
    const list = interventions ?? [];
    if (!q) return list.slice(0, 5);
    return list.filter((iv) =>
      [iv.title, iv.reference, iv.intervention_type, clientName(iv.client_id)]
        .some((f) => f?.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, clients, q]);

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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, une intervention, une référence…"
            className="pl-9"
          />
        </div>

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

        {/* KPI commerciaux */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-5">
              <Euro className="h-5 w-5 text-primary" />
              <div className="mt-3 font-serif text-2xl font-semibold">{formatEuro(potentialRevenue)}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">CA potentiel (préco. en attente)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <div className="mt-3 font-serif text-2xl font-semibold">{formatEuro(acceptedRevenue)}</div>
              <p className="mt-0.5 text-xs text-muted-foreground">CA accepté</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <div className="mt-3 font-serif text-2xl font-semibold">{conversion}%</div>
              <p className="mt-0.5 text-xs text-muted-foreground">Taux de conversion préco.</p>
            </CardContent>
          </Card>
        </div>

        {/* Centre d'alertes */}
        {(oldDrafts.length > 0 || stalePending.length > 0) && (
          <Card className="border-amber-300 bg-amber-50/60">
            <CardContent className="space-y-2 py-4">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <h3 className="font-serif text-base font-semibold">Alertes</h3>
              </div>
              {oldDrafts.length > 0 && (
                <p className="text-sm text-amber-900">
                  {oldDrafts.length} compte-rendu{oldDrafts.length > 1 ? "s" : ""} en brouillon depuis plus de 7 jours.
                </p>
              )}
              {stalePending.length > 0 && (
                <p className="text-sm text-amber-900">
                  {stalePending.length} préconisation{stalePending.length > 1 ? "s" : ""} en attente depuis plus de 30 jours.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">
              {q ? "Interventions trouvées" : "Interventions récentes"}
            </h3>
          </div>
          {filteredInterventions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <ClipboardList className="h-7 w-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">
                  {q ? "Aucun résultat." : "Aucune intervention. Créez votre premier compte-rendu."}
                </p>
                {!q && <Link to="/interventions/new"><Button size="sm" className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Nouveau compte-rendu</Button></Link>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredInterventions.map((iv) => (
                <Link key={iv.id} to="/interventions/$interventionId" params={{ interventionId: iv.id }}>
                  <Card className="flex items-center gap-3 p-3.5 transition-colors hover:border-primary/40">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{iv.title ?? clientName(iv.client_id)}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        {iv.reference && <span className="font-mono">{iv.reference}</span>}
                        <Clock className="h-3 w-3" />
                        {new Date(iv.intervention_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                    <Badge variant={iv.status === "termine" ? "default" : "secondary"} className="shrink-0">
                      {iv.status === "termine" ? "Terminé" : "Brouillon"}
                    </Badge>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <RemindersWidget />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">{q ? "Clients trouvés" : "Clients récents"}</h3>
            <Link to="/clients" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : filteredClients.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Users className="h-7 w-7 text-muted-foreground/60" />
                <p className="text-sm text-muted-foreground">{q ? "Aucun résultat." : "Aucun client. Commencez par en créer un."}</p>
                {!q && <Link to="/clients"><Button size="sm" className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Ajouter un client</Button></Link>}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredClients.map((c) => (
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
