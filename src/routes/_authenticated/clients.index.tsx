// ---------------------------------------------------------------------------
// Référentiel client : liste exploitable (recherche instantanée, filtres, tri),
// favoris personnels et centre de nettoyage des faux clients.
// RÈGLES : aucune fusion automatique, aucune donnée supprimée. Les indicateurs
// affichés proviennent uniquement des données enregistrées (CA, interventions,
// heures d'intervention issues de Vente → Temps).
// ---------------------------------------------------------------------------
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { ClientMergeDialog } from "@/components/clients/ClientMergeDialog";
import { LIFECYCLE_META, listClients, type Client } from "@/lib/clients";
import { listFavoriteClientIds, toggleFavoriteClient } from "@/lib/client-favorites";
import { findSuspectClients } from "@/lib/client-cleanup";
import { useRole } from "@/hooks/use-role";
import { listAllRecommendations, staleClientIds } from "@/lib/garden";
import { listAllInterventions } from "@/lib/interventions";
import { listEntries, formatEuro } from "@/lib/pilot";
import { saleRateEligible } from "@/lib/pilot-sale-time";
import { useThresholds } from "@/lib/pilot-thresholds";
import { signalFromHourlyRate } from "@/lib/pilot-profit-signal";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Search,
  MapPin,
  Users,
  ChevronRight,
  AlertTriangle,
  Upload,
  Star,
  Merge,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({
    meta: [
      { title: "Référentiel clients — De la graine au jardin" },
      {
        name: "description",
        content:
          "Recherche, favoris, rentabilité et nettoyage du référentiel client de l'entreprise de paysage.",
      },
      { property: "og:title", content: "Référentiel clients — De la graine au jardin" },
      {
        property: "og:description",
        content: "Fiches clients, favoris et correction manuelle des doublons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientsPage,
});

type SortKey = "name" | "ca" | "interventions" | "recent";
type StatusFilter = "all" | "actif" | "perdu";

interface Row {
  client: Client;
  ca: number;
  interventions: number;
  hours: number;
  lastDate: string | null;
  hourlyRate: number | null;
}

function ClientsPage() {
  const qc = useQueryClient();
  const { canEdit } = useRole();
  const thresholds = useThresholds();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: recos } = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const interventionsQ = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });
  const entriesQ = useQuery({ queryKey: ["pilot-entries"], queryFn: listEntries, enabled: canEdit });
  const favoritesQ = useQuery({ queryKey: ["favorite-clients"], queryFn: listFavoriteClientIds });

  const favorites = useMemo(() => new Set(favoritesQ.data ?? []), [favoritesQ.data]);
  const stale = useMemo(() => staleClientIds(recos ?? []), [recos]);

  const favMut = useMutation({
    mutationFn: (p: { clientId: string; favorite: boolean }) =>
      toggleFavoriteClient(p.clientId, p.favorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite-clients"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Agrégats par client — uniquement des données déjà enregistrées.
  const rows = useMemo<Row[]>(() => {
    const caByClient = new Map<string, number>();
    // Taux horaire (règle absolue) : CA des lignes de vente porteuses de
    // temps ÷ temps de ces mêmes lignes (Vente → Temps, source unique).
    const ratedByClient = new Map<string, { ca: number; hours: number }>();
    for (const e of entriesQ.data ?? []) {
      if (!e.client_id) continue;
      caByClient.set(e.client_id, (caByClient.get(e.client_id) ?? 0) + (Number(e.amount_ht) || 0));
      if (saleRateEligible(e)) {
        const cur = ratedByClient.get(e.client_id) ?? { ca: 0, hours: 0 };
        cur.ca += Number(e.amount_ht) || 0;
        cur.hours += Number(e.hours) || 0;
        ratedByClient.set(e.client_id, cur);
      }
    }
    const ivCount = new Map<string, number>();
    const last = new Map<string, string>();
    for (const iv of interventionsQ.data ?? []) {
      const id = iv.client_id;
      if (!id) continue;
      ivCount.set(id, (ivCount.get(id) ?? 0) + 1);
      const prev = last.get(id);
      if (!prev || iv.intervention_date > prev) last.set(id, iv.intervention_date);
    }
    return (clients ?? []).map((client) => {
      const ca = caByClient.get(client.id) ?? 0;
      const rated = ratedByClient.get(client.id);
      const h = rated?.hours ?? 0;
      return {
        client,
        ca,
        interventions: ivCount.get(client.id) ?? 0,
        hours: h,
        lastDate: last.get(client.id) ?? null,
        hourlyRate: h > 0 && (rated?.ca ?? 0) > 0 ? (rated as { ca: number }).ca / h : null,
      };
    });
  }, [clients, entriesQ.data, interventionsQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const c = r.client;
      if (status !== "all" && (c.lifecycle_status ?? "actif") !== status) return false;
      if (!q) return true;
      return [c.name, c.address, c.email, c.phone, c.contract_type]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "ca":
          return b.ca - a.ca;
        case "interventions":
          return b.interventions - a.interventions;
        case "recent":
          return (b.lastDate ?? "").localeCompare(a.lastDate ?? "");
        default:
          return a.client.name.localeCompare(b.client.name, "fr");
      }
    });
    return sorted;
  }, [rows, search, status, sort]);

  const favoriteRows = filtered.filter((r) => favorites.has(r.client.id));
  const otherRows = filtered.filter((r) => !favorites.has(r.client.id));

  const suspects = useMemo(() => findSuspectClients(clients ?? []), [clients]);

  const renderRow = (r: Row) => {
    const c = r.client;
    const isFav = favorites.has(c.id);
    const lifecycle = LIFECYCLE_META[c.lifecycle_status ?? "actif"];
    return (
      <Card
        key={c.id}
        className="flex items-center gap-3 p-3 transition-colors hover:border-primary/40 hover:bg-accent/10"
      >
        <button
          type="button"
          aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          onClick={() => favMut.mutate({ clientId: c.id, favorite: !isFav })}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-amber-500"
        >
          <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
        </button>
        <Link
          to="/clients/$clientId"
          params={{ clientId: c.id }}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">
                {c.civility ? <span className="text-muted-foreground">{c.civility} </span> : null}
                {c.name}
              </p>
              {(c.lifecycle_status ?? "actif") === "perdu" && (
                <Badge variant="outline" className={`shrink-0 text-[10px] ${lifecycle.badge}`}>
                  {lifecycle.label}
                </Badge>
              )}
              {c.contract_type && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">{c.contract_type}</Badge>
              )}
              {stale.has(c.id) && (
                <Badge className="shrink-0 gap-1 bg-amber-100 text-[10px] text-amber-800">
                  <AlertTriangle className="h-2.5 w-2.5" /> Préco. +30j
                </Badge>
              )}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{r.interventions} intervention{r.interventions > 1 ? "s" : ""}</span>
              {canEdit && <span>CA {formatEuro(r.ca)}</span>}
              {canEdit && r.hourlyRate != null && (
                <span className="flex items-center gap-1">
                  <ProfitSignal
                    compact
                    level={signalFromHourlyRate(r.hourlyRate, thresholds.tauxHoraireCibleMin, thresholds)}
                  />
                  {r.hourlyRate.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/h
                </span>
              )}
              {c.address && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.address}</span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        {canEdit && clients && (
          <ClientMergeDialog
            source={c}
            clients={clients}
            trigger={
              <Button variant="ghost" size="icon" title="Fusionner / rattacher à un client existant">
                <Merge className="h-4 w-4" />
              </Button>
            }
          />
        )}
      </Card>
    );
  };

  return (
    <AppShell title="Clients">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un client…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les clients</SelectItem>
              <SelectItem value="actif">Clients suivis</SelectItem>
              <SelectItem value="perdu">Clients perdus</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Tri : nom</SelectItem>
              <SelectItem value="ca">Tri : CA</SelectItem>
              <SelectItem value="interventions">Tri : interventions</SelectItem>
              <SelectItem value="recent">Tri : activité récente</SelectItem>
            </SelectContent>
          </Select>
          {canEdit && (
            <>
              <ClientForm
                trigger={
                  <Button className="shrink-0">
                    <Plus className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Nouveau</span>
                  </Button>
                }
              />
              <ClientImportDialog
                trigger={
                  <Button variant="outline" className="shrink-0">
                    <Upload className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Importer</span>
                  </Button>
                }
              />
            </>
          )}
        </div>

        <Tabs defaultValue="liste">
          <TabsList className="mb-3">
            <TabsTrigger value="liste">Référentiel ({filtered.length})</TabsTrigger>
            {canEdit && (
              <TabsTrigger value="nettoyage">À vérifier ({suspects.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="liste">
            {isLoading ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients?.length ?? 0) > 0} />
            ) : (
              <div className="space-y-4">
                {favoriteRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                      Clients favoris ({favoriteRows.length})
                    </div>
                    <div className="space-y-2">{favoriteRows.map(renderRow)}</div>
                  </div>
                )}
                <div className="space-y-2">
                  {favoriteRows.length > 0 && (
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Tous les clients ({otherRows.length})
                    </div>
                  )}
                  {otherRows.map(renderRow)}
                </div>
              </div>
            )}
          </TabsContent>

          {canEdit && (
            <TabsContent value="nettoyage">
              <Card className="mb-3 border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Fiches dont le nom ressemble à une prestation ou à un chantier. Rien n'est corrigé
                    automatiquement : chaque rattachement est validé par vous et journalisé.
                  </p>
                </div>
              </Card>
              {suspects.length === 0 ? (
                <Card className="py-10 text-center text-sm text-muted-foreground">
                  Aucune fiche suspecte détectée.
                </Card>
              ) : (
                <div className="space-y-2">
                  {suspects.map(({ client: c, reason, suggestion }) => (
                    <Card key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/clients/$clientId"
                          params={{ clientId: c.id }}
                          className="truncate font-medium text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{reason.label}</p>
                        {suggestion && (
                          <p className="text-xs text-muted-foreground">
                            Rattachement suggéré : <span className="font-medium">{suggestion.name}</span>
                          </p>
                        )}
                      </div>
                      {clients && (
                        <ClientMergeDialog
                          source={c}
                          clients={clients}
                          defaultTargetId={suggestion?.id ?? null}
                          trigger={
                            <Button variant="outline" size="sm">
                              <Merge className="mr-1.5 h-4 w-4" />Rattacher
                            </Button>
                          }
                        />
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppShell>
  );
}

function EmptyState({ hasClients }: { hasClients: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Users className="h-6 w-6" />
      </div>
      <div>
        <p className="font-medium">{hasClients ? "Aucun résultat" : "Aucun client"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasClients ? "Essayez une autre recherche." : "Créez votre premier client pour commencer."}
        </p>
      </div>
      {!hasClients && (
        <ClientForm trigger={<Button className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Nouveau client</Button>} />
      )}
    </Card>
  );
}
