// ---------------------------------------------------------------------------
// Référentiel client : liste exploitable (recherche instantanée, filtres, tri),
// favoris personnels et centre de nettoyage des faux clients.
// RÈGLES : aucune fusion automatique, aucune donnée supprimée. Les indicateurs
// affichés proviennent uniquement des données enregistrées (CA, interventions,
// heures d'intervention issues de Vente → Temps).
// ---------------------------------------------------------------------------
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepForLifecycle, splitFavorites } from "@/lib/client-list-view";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { ClientMergeDialog } from "@/components/clients/ClientMergeDialog";
import {
  LIFECYCLE_META,
  REPORT_POLICY_META,
  listClients,
  updateClient,
  type Client,
  type ClientLifecycle,
  type ReportPolicy,
} from "@/lib/clients";
import { getClientActivityStatus, type ClientActivityStatus } from "@/lib/client-activity";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listFavoriteClientIds, toggleFavoriteClient } from "@/lib/client-favorites";
import { findSuspectClients } from "@/lib/client-cleanup";
import { useRole } from "@/hooks/use-role";
import { listAllRecommendations, staleClientIds } from "@/lib/garden";
import { listEntries, formatEuro } from "@/lib/pilot";
import { hourlyRate, saleRateEligible } from "@/lib/pilot-sale-time";
import { useThresholds } from "@/lib/pilot-thresholds";
import { usePilotYear } from "@/lib/pilot-mode";
import { signalFromHourlyRate } from "@/lib/pilot-profit-signal";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BarChart3,
  Pencil,
  Check,
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
/**
 * Filtre de lecture : « perdu » est une décision du dirigeant (lifecycle),
 * « actif / à relancer / dormant » sont DÉDUITS de la dernière activité réelle
 * via `getClientActivityStatus()` — aucun seuil recopié ici.
 */
type StatusFilter = "all" | "actif" | "a_relancer" | "dormant" | "perdu" | "cr_a_qualifier";

const ACTIVITY_BADGE: Record<ClientActivityStatus, { label: string; badge: string }> = {
  actif: { label: "Actif", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  a_relancer: { label: "À relancer", badge: "border-amber-200 bg-amber-50 text-amber-800" },
  dormant: { label: "Dormant", badge: "border-slate-200 bg-slate-100 text-slate-600" },
  perdu: { label: "Client perdu", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

interface Row {
  client: Client;
  ca: number;
  interventions: number;
  hours: number;
  lastDate: string | null;
  hourlyRate: number | null;
  activity: ClientActivityStatus;
}

function ClientsPage() {
  const qc = useQueryClient();
  const { canEdit } = useRole();
  const thresholds = useThresholds();
  // Exercice courant partagé : tous les agrégats ci-dessous y sont bornés.
  const { year: pilotYear } = usePilotYear();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  // Les clients perdus sont exclus par défaut (règle d'affichage, pas de calcul).
  const [showLost, setShowLost] = useState(false);

  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: recos } = useQuery({
    queryKey: ["recommendations-all"],
    queryFn: listAllRecommendations,
  });
  const entriesQ = useQuery({
    queryKey: ["pilot-entries"],
    queryFn: () => listEntries(),
    enabled: canEdit,
  });
  const favoritesQ = useQuery({ queryKey: ["favorite-clients"], queryFn: listFavoriteClientIds });

  const favorites = useMemo(() => new Set(favoritesQ.data ?? []), [favoritesQ.data]);
  const stale = useMemo(() => staleClientIds(recos ?? []), [recos]);

  const favMut = useMutation({
    mutationFn: (p: { clientId: string; favorite: boolean }) =>
      toggleFavoriteClient(p.clientId, p.favorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite-clients"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Modification rapide des badges : seules les décisions du dirigeant sont
  // modifiables (cycle de vie, politique de compte-rendu). Les statuts déduits
  // de l'activité réelle ne sont jamais forçables à la main.
  const statusMut = useMutation({
    mutationFn: (p: {
      client: Client;
      patch: { lifecycle_status?: ClientLifecycle; report_policy?: ReportPolicy };
    }) => updateClient(p.client.id, { name: p.client.name, ...p.patch }),
    onSuccess: () => {
      toast.success("Fiche client mise à jour");
      void qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Agrégats économiques par client — source unique Chiffre d'affaires → Ventes.
  const rows = useMemo<Row[]>(() => {
    const caByClient = new Map<string, number>();
    // Taux horaire BRUT : CA de toutes les ventes de l'exercice ÷ temps de
    // travail interne (Vente → Temps > 0). Une vente SST à 0 h compte dans le
    // CA sans ajouter d'heure. Périmètre verrouillé sur l'exercice courant.
    const hoursByClient = new Map<string, number>();
    /** CA des seules lignes RETENUES = numérateur du taux horaire. */
    const caRatedByClient = new Map<string, number>();
    const salesByClient = new Map<string, number>();
    const lastSale = new Map<string, string>();
    for (const e of entriesQ.data ?? []) {
      if (!e.client_id) continue;
      if (new Date(e.entry_date).getFullYear() !== pilotYear) continue;
      caByClient.set(e.client_id, (caByClient.get(e.client_id) ?? 0) + (Number(e.amount_ht) || 0));
      salesByClient.set(e.client_id, (salesByClient.get(e.client_id) ?? 0) + 1);
      const prevDate = lastSale.get(e.client_id);
      if (!prevDate || e.entry_date > prevDate) lastSale.set(e.client_id, e.entry_date);
      if (saleRateEligible(e)) {
        hoursByClient.set(
          e.client_id,
          (hoursByClient.get(e.client_id) ?? 0) + (Number(e.hours) || 0),
        );
        caRatedByClient.set(
          e.client_id,
          (caRatedByClient.get(e.client_id) ?? 0) + (Number(e.amount_ht) || 0),
        );
      }
    }
    return (clients ?? []).map((client) => {
      const ca = caByClient.get(client.id) ?? 0;
      const h = hoursByClient.get(client.id) ?? 0;
      const last = lastSale.get(client.id) ?? null;
      return {
        client,
        activity:
          (client.lifecycle_status ?? "actif") === "perdu"
            ? ("perdu" as ClientActivityStatus)
            : getClientActivityStatus(last),
        ca,
        // Nombre d'interventions économiques = lignes de vente de l'exercice
        // (jamais le nombre de comptes rendus de chantier).
        interventions: salesByClient.get(client.id) ?? 0,
        hours: h,
        lastDate: lastSale.get(client.id) ?? null,
        // Taux horaire = CA des lignes retenues ÷ Temps de ces mêmes lignes.
        hourlyRate: hourlyRate(caRatedByClient.get(client.id) ?? 0, h),
      };
    });
  }, [clients, entriesQ.data, pilotYear]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const c = r.client;
      if (status === "cr_a_qualifier") {
        if ((c.report_policy ?? "a_confirmer") !== "a_confirmer") return false;
      } else if (status !== "all" && r.activity !== status) return false;
      if (!keepForLifecycle(c.lifecycle_status, status, showLost)) return false;
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
  }, [rows, search, status, sort, showLost]);

  const { favorites: favoriteRows, others: otherRows } = splitFavorites(filtered, (r) =>
    favorites.has(r.client.id),
  );
  const lostCount = rows.filter((r) => (r.client.lifecycle_status ?? "actif") === "perdu").length;

  const suspects = useMemo(() => findSuspectClients(clients ?? []), [clients]);

  const renderRow = (r: Row) => {
    const c = r.client;
    const isFav = favorites.has(c.id);
    return (
      <Card
        key={c.id}
        className="overflow-hidden border-border/80 transition-colors hover:border-primary/30"
      >
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-3.5 [&::-webkit-details-marker]:hidden">
            <button
              type="button"
              aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
              onClick={(e) => {
                e.preventDefault();
                favMut.mutate({ clientId: c.id, favorite: !isFav });
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-amber-500"
            >
              <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">
                  <Link
                    to={canEdit ? "/pilot/fiche/$clientId" : "/clients/$clientId"}
                    params={{ clientId: c.id }}
                    className="hover:underline"
                    title={canEdit ? "Ouvrir la fiche 360° (Pilotage)" : "Ouvrir la fiche client"}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.civility ? <span className="text-muted-foreground">{c.civility} </span> : null}
                    {c.name}
                  </Link>
                </p>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${ACTIVITY_BADGE[r.activity].badge}`}
                >
                  {ACTIVITY_BADGE[r.activity].label}
                </Badge>
                {(c.report_policy ?? "a_confirmer") === "a_confirmer" && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-sky-200 bg-sky-50 text-[10px] text-sky-700"
                  >
                    CR à qualifier
                  </Badge>
                )}
                {c.contract_type && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {c.contract_type}
                  </Badge>
                )}
                {stale.has(c.id) && (
                  <Badge className="shrink-0 gap-1 bg-amber-100 text-[10px] text-amber-800">
                    <AlertTriangle className="h-2.5 w-2.5" /> Préco. +30j
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  {r.interventions} vente{r.interventions > 1 ? "s" : ""} en {pilotYear}
                </span>
                {canEdit && <span>CA {pilotYear} {formatEuro(r.ca)}</span>}
                {canEdit && r.hourlyRate != null && (
                  <span className="flex items-center gap-1">
                    <ProfitSignal
                      compact
                      level={signalFromHourlyRate(
                        r.hourlyRate,
                        thresholds.tauxHoraireCibleMin,
                        thresholds,
                      )}
                    />
                    {r.hourlyRate.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/h
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          </summary>
          <div className="border-t bg-muted/20 px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.address && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Adresse</span>
                  <p className="mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{c.address}</p>
                </div>
              )}
              {c.email && <div className="text-xs"><span className="text-muted-foreground">E-mail</span><p className="mt-0.5 truncate">{c.email}</p></div>}
              {c.phone && <div className="text-xs"><span className="text-muted-foreground">Téléphone</span><p className="mt-0.5">{c.phone}</p></div>}
              {r.lastDate && <div className="text-xs"><span className="text-muted-foreground">Dernière vente</span><p className="mt-0.5">{new Date(r.lastDate).toLocaleDateString("fr-FR")}</p></div>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              {canEdit && (
                <Button variant="ghost" size="sm" asChild title="Ouvrir la fiche 360° (Pilotage)">
                  <Link to="/pilot/fiche/$clientId" params={{ clientId: c.id }}><BarChart3 className="mr-1.5 h-4 w-4" />Pilotage</Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild title="Ouvrir la fiche client">
                <Link to="/clients/$clientId" params={{ clientId: c.id }}><ChevronRight className="mr-1.5 h-4 w-4" />Fiche</Link>
              </Button>
              {canEdit && (
                <Button variant="ghost" size="sm" asChild title="Modifier la fiche CRM du client">
                  <Link to="/clients/$clientId" params={{ clientId: c.id }} search={{ edit: true }}><Pencil className="mr-1.5 h-4 w-4" />Modifier</Link>
                </Button>
              )}
              {canEdit && clients && (
                <ClientMergeDialog
                  source={c}
                  clients={clients}
                  trigger={<Button variant="ghost" size="sm"><Merge className="mr-1.5 h-4 w-4" />Rattacher</Button>}
                />
              )}
              {canEdit && (
                <Popover>
                  <PopoverTrigger asChild><Button variant="ghost" size="sm">Statut</Button></PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium">Cycle de vie</p>
                        <Select value={c.lifecycle_status ?? "actif"} onValueChange={(v) => statusMut.mutate({ client: c, patch: { lifecycle_status: v as ClientLifecycle } })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(LIFECYCLE_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs font-medium">Compte-rendus</p>
                        <Select value={c.report_policy ?? "a_confirmer"} onValueChange={(v) => statusMut.mutate({ client: c, patch: { report_policy: v as ReportPolicy } })}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(REPORT_POLICY_META).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        </details>
      </Card>
    );
  };

  return (
    <AppShell title="Clients">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client…" className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les clients</SelectItem><SelectItem value="actif">Actifs</SelectItem><SelectItem value="a_relancer">À relancer</SelectItem><SelectItem value="dormant">Dormants</SelectItem><SelectItem value="perdu">Clients perdus</SelectItem><SelectItem value="cr_a_qualifier">CR à qualifier</SelectItem></SelectContent></Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Tri : nom</SelectItem><SelectItem value="ca">Tri : CA</SelectItem><SelectItem value="interventions">Tri : interventions</SelectItem><SelectItem value="recent">Tri : activité récente</SelectItem></SelectContent></Select>
          <label className="flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground"><Switch checked={showLost || status === "perdu"} disabled={status === "perdu"} onCheckedChange={setShowLost} aria-label="Afficher les clients perdus" />Afficher les perdus ({lostCount})</label>
          {canEdit && <><ClientForm trigger={<Button className="shrink-0"><Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Nouveau</span></Button>} /><ClientImportDialog trigger={<Button variant="outline" className="shrink-0"><Upload className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Importer</span></Button>} /></>}
        </div>

        <Tabs defaultValue="liste">
          <TabsList className="mb-3"><TabsTrigger value="liste">Référentiel ({filtered.length})</TabsTrigger>{canEdit && <TabsTrigger value="nettoyage">À vérifier ({suspects.length})</TabsTrigger>}</TabsList>
          <TabsContent value="liste">
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState hasClients={(clients?.length ?? 0) > 0} />
            ) : (
              <div className="space-y-5">
                {favoriteRows.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />Clients favoris ({favoriteRows.length})</div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{favoriteRows.map(renderRow)}</div>
                  </section>
                )}
                <section>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{favoriteRows.length > 0 ? "Autres clients" : "Tous les clients"} ({otherRows.length})</div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{otherRows.map(renderRow)}</div>
                </section>
              </div>
            )}
          </TabsContent>

          {canEdit && (
            <TabsContent value="nettoyage">
              <Card className="mb-3 border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>Fiches dont le nom ressemble à une prestation ou à un chantier. Rien n'est corrigé automatiquement : chaque rattachement est validé par vous et journalisé.</p></div>
              </Card>
              {suspects.length === 0 ? (
                <Card className="py-10 text-center text-sm text-muted-foreground">Aucune fiche suspecte détectée.</Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {suspects.map(({ client: c, reason, suggestion }) => (
                    <Card key={c.id} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <Link to="/clients/$clientId" params={{ clientId: c.id }} className="truncate font-medium text-primary hover:underline">{c.name}</Link>
                        <p className="text-xs text-muted-foreground">{reason.label}</p>
                        {suggestion && <p className="text-xs text-muted-foreground">Rattachement suggéré : <span className="font-medium">{suggestion.name}</span></p>}
                      </div>
                      {clients && <ClientMergeDialog source={c} clients={clients} defaultTargetId={suggestion?.id ?? null} trigger={<Button variant="outline" size="sm"><Merge className="mr-1.5 h-4 w-4" />Rattacher</Button>} />}
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
      <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Users className="h-6 w-6" /></div>
      <div><p className="font-medium">{hasClients ? "Aucun résultat" : "Aucun client"}</p><p className="mt-1 text-sm text-muted-foreground">{hasClients ? "Essayez une autre recherche." : "Créez votre premier client pour commencer."}</p></div>
      {!hasClients && <ClientForm trigger={<Button className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Nouveau client</Button>} />}
    </Card>
  );
}
