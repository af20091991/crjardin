// ---------------------------------------------------------------------------
// Référentiel client : répertoire compact, groupes personnalisables et
// panneau de détail. Aucune donnée métier ni aucun calcul n'est modifié ici.
// ---------------------------------------------------------------------------
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { keepForLifecycle } from "@/lib/client-list-view";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { ClientMergeDialog } from "@/components/clients/ClientMergeDialog";
import { listClients, type Client } from "@/lib/clients";
import { getClientActivityStatus, type ClientActivityStatus } from "@/lib/client-activity";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, Users, ChevronRight, Upload, Star, Merge, Sparkles, BarChart3, Pencil, FolderPlus, Trash2, GripVertical, Settings2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Référentiel clients — De la graine au jardin" }, { name: "description", content: "Répertoire, groupes et gestion des fiches clients." }] }),
  component: ClientsPage,
});

type SortKey = "name" | "ca" | "interventions" | "recent";
type StatusFilter = "all" | "actif" | "a_relancer" | "dormant" | "perdu" | "cr_a_qualifier";
type Group = { id: string; name: string };
type GroupState = { groups: Group[]; assignments: Record<string, string> };
const STORAGE_KEY = "pp-client-directory-groups-v1";
const DEFAULT_GROUPS: Group[] = [{ id: "tous", name: "Tous les clients" }, { id: "particuliers", name: "Particuliers" }, { id: "professionnels", name: "Professionnels" }];
const ACTIVITY_BADGE: Record<ClientActivityStatus, { label: string; badge: string }> = {
  actif: { label: "Actif", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  a_relancer: { label: "À relancer", badge: "border-amber-200 bg-amber-50 text-amber-800" },
  dormant: { label: "Dormant", badge: "border-slate-200 bg-slate-100 text-slate-600" },
  perdu: { label: "Client perdu", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};
interface Row { client: Client; ca: number; interventions: number; hours: number; lastDate: string | null; hourlyRate: number | null; activity: ClientActivityStatus; }
function loadGroups(): GroupState {
  if (typeof window === "undefined") return { groups: DEFAULT_GROUPS, assignments: {} };
  try { const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? ""); if (parsed?.groups?.length) return parsed; } catch { /* configuration invalide */ }
  return { groups: DEFAULT_GROUPS, assignments: {} };
}
function saveGroups(value: GroupState) { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* stockage indisponible */ } }

function ClientsPage() {
  const qc = useQueryClient(); const { canEdit } = useRole(); const thresholds = useThresholds(); const { year: pilotYear } = usePilotYear();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState<StatusFilter>("all"); const [sort, setSort] = useState<SortKey>("name"); const [showLost, setShowLost] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [groupState, setGroupState] = useState<GroupState>(loadGroups); const [groupFilter, setGroupFilter] = useState("tous"); const [editingGroups, setEditingGroups] = useState(false);
  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: recos } = useQuery({ queryKey: ["recommendations-all"], queryFn: listAllRecommendations });
  const entriesQ = useQuery({ queryKey: ["pilot-entries"], queryFn: () => listEntries(), enabled: canEdit });
  const favoritesQ = useQuery({ queryKey: ["favorite-clients"], queryFn: listFavoriteClientIds });
  const favorites = useMemo(() => new Set(favoritesQ.data ?? []), [favoritesQ.data]); const stale = useMemo(() => staleClientIds(recos ?? []), [recos]);
  const favMut = useMutation({ mutationFn: (p: { clientId: string; favorite: boolean }) => toggleFavoriteClient(p.clientId, p.favorite), onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite-clients"] }), onError: (e: Error) => toast.error(e.message) });

  const rows = useMemo<Row[]>(() => {
    const caByClient = new Map<string, number>(), hoursByClient = new Map<string, number>(), caRatedByClient = new Map<string, number>(), salesByClient = new Map<string, number>(), lastSale = new Map<string, string>();
    for (const e of entriesQ.data ?? []) {
      if (!e.client_id || new Date(e.entry_date).getFullYear() !== pilotYear) continue;
      caByClient.set(e.client_id, (caByClient.get(e.client_id) ?? 0) + (Number(e.amount_ht) || 0)); salesByClient.set(e.client_id, (salesByClient.get(e.client_id) ?? 0) + 1);
      if (!lastSale.has(e.client_id) || e.entry_date > lastSale.get(e.client_id)!) lastSale.set(e.client_id, e.entry_date);
      if (saleRateEligible(e)) { hoursByClient.set(e.client_id, (hoursByClient.get(e.client_id) ?? 0) + (Number(e.hours) || 0)); caRatedByClient.set(e.client_id, (caRatedByClient.get(e.client_id) ?? 0) + (Number(e.amount_ht) || 0)); }
    }
    return (clients ?? []).map((client) => { const ca = caByClient.get(client.id) ?? 0; const hours = hoursByClient.get(client.id) ?? 0; const lastDate = lastSale.get(client.id) ?? null; return { client, ca, interventions: salesByClient.get(client.id) ?? 0, hours, lastDate, hourlyRate: hourlyRate(caRatedByClient.get(client.id) ?? 0, hours), activity: client.lifecycle_status === "perdu" ? "perdu" : getClientActivityStatus(lastDate) }; });
  }, [clients, entriesQ.data, pilotYear]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => { const c = r.client; if (status === "cr_a_qualifier") { if ((c.report_policy ?? "a_confirmer") !== "a_confirmer") return false; } else if (status !== "all" && r.activity !== status) return false; if (!keepForLifecycle(c.lifecycle_status, status, showLost)) return false; if (groupFilter !== "tous" && groupState.assignments[c.id] !== groupFilter) return false; if (!q) return true; return [c.name, c.address, c.email, c.phone, c.contract_type].filter(Boolean).some((v) => v!.toLowerCase().includes(q)); });
    return [...list].sort((a, b) => sort === "ca" ? b.ca - a.ca : sort === "interventions" ? b.interventions - a.interventions : sort === "recent" ? (b.lastDate ?? "").localeCompare(a.lastDate ?? "") : a.client.name.localeCompare(b.client.name, "fr"));
  }, [rows, search, status, sort, showLost, groupFilter, groupState.assignments]);

  const selected = rows.find((r) => r.client.id === selectedId) ?? null; const lostCount = rows.filter((r) => r.activity === "perdu").length; const suspects = useMemo(() => findSuspectClients(clients ?? []), [clients]);
  const persistGroupState = (next: GroupState) => { setGroupState(next); saveGroups(next); };
  const addGroup = () => { const name = window.prompt("Nom du groupe client"); if (!name?.trim()) return; const group = { id: `g-${Date.now()}`, name: name.trim() }; persistGroupState({ ...groupState, groups: [...groupState.groups, group] }); setGroupFilter(group.id); };
  const renameGroup = (group: Group) => { if (group.id === "tous") return; const name = window.prompt("Nouveau nom du groupe", group.name); if (!name?.trim()) return; persistGroupState({ ...groupState, groups: groupState.groups.map((g) => g.id === group.id ? { ...g, name: name.trim() } : g) }); };
  const deleteGroup = (group: Group) => { if (group.id === "tous" || !window.confirm(`Supprimer le groupe « ${group.name} » ? Les clients resteront dans le référentiel.`)) return; const assignments = { ...groupState.assignments }; Object.keys(assignments).forEach((id) => { if (assignments[id] === group.id) delete assignments[id]; }); persistGroupState({ groups: groupState.groups.filter((g) => g.id !== group.id), assignments }); setGroupFilter("tous"); };
  const assignSelected = (groupId: string) => { if (!selected) return; const assignments = { ...groupState.assignments }; if (groupId === "tous") delete assignments[selected.client.id]; else assignments[selected.client.id] = groupId; persistGroupState({ ...groupState, assignments }); };

  const renderRow = (r: Row) => { const c = r.client; const isFav = favorites.has(c.id); return <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} className="grid w-full grid-cols-[minmax(220px,1.8fr)_minmax(130px,1fr)_100px_125px_34px] items-center gap-4 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-accent/20"><div className="min-w-0 flex items-center gap-3"><span onClick={(e) => { e.stopPropagation(); favMut.mutate({ clientId: c.id, favorite: !isFav }); }} className="shrink-0 rounded p-1 text-muted-foreground hover:text-amber-500"><Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} /></span><div className="min-w-0"><p className="truncate font-medium">{c.civility ? <span className="text-muted-foreground">{c.civility} </span> : null}{c.name}</p><div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{c.address || "Adresse non renseignée"}</span>{c.contract_type && <span>· {c.contract_type}</span>}</div></div></div><div><Badge variant="outline" className={`text-[10px] ${ACTIVITY_BADGE[r.activity].badge}`}>{ACTIVITY_BADGE[r.activity].label}</Badge></div><div className="text-sm text-muted-foreground">{r.interventions} vente{r.interventions > 1 ? "s" : ""}</div><div className="text-right text-sm font-medium">{canEdit ? formatEuro(r.ca) : "—"}</div><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>; };

  return <AppShell title="Clients"><div className="w-full px-1 lg:px-2">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Fiches clients</h1><p className="mt-1 text-sm text-muted-foreground">Un répertoire sobre pour retrouver rapidement chaque client.</p></div>{canEdit && <div className="flex gap-2"><ClientForm trigger={<Button><Plus className="mr-1.5 h-4 w-4" />Nouveau</Button>} /><ClientImportDialog trigger={<Button variant="outline"><Upload className="mr-1.5 h-4 w-4" />Importer</Button>} /></div>}</div>
    <div className="mb-4 flex flex-wrap items-center gap-2"><div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client, une commune, un contact…" className="pl-9" /></div><Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous les statuts</SelectItem><SelectItem value="actif">Actifs</SelectItem><SelectItem value="a_relancer">À relancer</SelectItem><SelectItem value="dormant">Dormants</SelectItem><SelectItem value="perdu">Clients perdus</SelectItem><SelectItem value="cr_a_qualifier">CR à qualifier</SelectItem></SelectContent></Select><Select value={sort} onValueChange={(v) => setSort(v as SortKey)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Tri : nom</SelectItem><SelectItem value="ca">Tri : CA</SelectItem><SelectItem value="interventions">Tri : ventes</SelectItem><SelectItem value="recent">Tri : activité récente</SelectItem></SelectContent></Select><label className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground"><Switch checked={showLost || status === "perdu"} disabled={status === "perdu"} onCheckedChange={setShowLost} />Perdus ({lostCount})</label></div>
    <Tabs defaultValue="liste"><TabsList className="mb-3"><TabsTrigger value="liste">Répertoire ({filtered.length})</TabsTrigger>{canEdit && <TabsTrigger value="nettoyage">À vérifier ({suspects.length})</TabsTrigger>}</TabsList>
      <TabsContent value="liste"><div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-2"><div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{groupState.groups.map((group) => <button key={group.id} type="button" onClick={() => setGroupFilter(group.id)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors ${groupFilter === group.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent"}`}>{group.name}</button>)}</div>{canEdit && <Button variant="ghost" size="sm" onClick={() => setEditingGroups((v) => !v)}><Settings2 className="mr-1.5 h-3.5 w-3.5" />Groupes</Button>}</div>
        {editingGroups && canEdit && <Card className="mb-3 p-3"><div className="mb-2 flex items-center justify-between"><div><p className="text-sm font-medium">Organisation des groupes</p><p className="text-xs text-muted-foreground">Les groupes sont personnalisables et enregistrés sur cet appareil.</p></div><Button size="sm" onClick={addGroup}><FolderPlus className="mr-1.5 h-4 w-4" />Nouveau groupe</Button></div><div className="flex flex-wrap gap-2">{groupState.groups.filter((g) => g.id !== "tous").map((group) => <div key={group.id} className="flex items-center gap-1 rounded-md border px-2 py-1"><GripVertical className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">{group.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => renameGroup(group)}><Pencil className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteGroup(group)}><Trash2 className="h-3 w-3" /></Button></div>)}</div></Card>}
        {isLoading ? <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : filtered.length === 0 ? <EmptyState hasClients={(clients?.length ?? 0) > 0} /> : <Card className="overflow-hidden"><div className="grid grid-cols-[minmax(220px,1.8fr)_minmax(130px,1fr)_100px_125px_34px] gap-4 border-b bg-muted/25 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"><span>Client</span><span>Statut</span><span>Activité</span><span className="text-right">CA {pilotYear}</span><span /></div>{filtered.map(renderRow)}</Card>}
      </TabsContent>
      {canEdit && <TabsContent value="nettoyage"><Card className="mb-3 border-dashed p-4 text-sm text-muted-foreground"><div className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>Fiches dont le nom ressemble à une prestation ou à un chantier. Rien n'est corrigé automatiquement : chaque rattachement est validé par vous.</p></div></Card>{suspects.length === 0 ? <Card className="py-10 text-center text-sm text-muted-foreground">Aucune fiche suspecte détectée.</Card> : <div className="space-y-2">{suspects.map(({ client: c, reason, suggestion }) => <Card key={c.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><Link to="/clients/$clientId" params={{ clientId: c.id }} className="font-medium hover:underline">{c.name}</Link><p className="text-xs text-muted-foreground">{reason.label}</p>{suggestion && <p className="text-xs text-muted-foreground">Rattachement suggéré : <span className="font-medium">{suggestion.name}</span></p>}</div>{clients && <ClientMergeDialog source={c} clients={clients} defaultTargetId={suggestion?.id ?? null} trigger={<Button variant="outline" size="sm"><Merge className="mr-1.5 h-4 w-4" />Rattacher</Button>} />}</Card>)}</div>}</TabsContent>}
    </Tabs>
  </div>
  <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">{selected && <><SheetHeader className="border-b pb-4"><SheetTitle>{selected.client.civility ? `${selected.client.civility} ` : ""}{selected.client.name}</SheetTitle><div className="flex flex-wrap gap-2 pt-1"><Badge variant="outline" className={ACTIVITY_BADGE[selected.activity].badge}>{ACTIVITY_BADGE[selected.activity].label}</Badge>{selected.client.contract_type && <Badge variant="secondary">{selected.client.contract_type}</Badge>}</div></SheetHeader><div className="space-y-6 py-5"><section><p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Contact</p><div className="space-y-1.5 text-sm"><p>{selected.client.address || "Adresse non renseignée"}</p><p>{selected.client.phone || "Téléphone non renseigné"}</p><p>{selected.client.email || "E-mail non renseigné"}</p></div></section><section><p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Activité {pilotYear}</p><div className="grid grid-cols-3 gap-2"><Card className="p-3"><p className="text-xs text-muted-foreground">CA</p><p className="mt-1 text-lg font-medium">{canEdit ? formatEuro(selected.ca) : "—"}</p></Card><Card className="p-3"><p className="text-xs text-muted-foreground">Ventes</p><p className="mt-1 text-lg font-medium">{selected.interventions}</p></Card><Card className="p-3"><p className="text-xs text-muted-foreground">Temps</p><p className="mt-1 text-lg font-medium">{selected.hours ? `${selected.hours.toLocaleString("fr-FR")} h` : "—"}</p></Card></div>{canEdit && selected.hourlyRate != null && <div className="mt-2 flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="text-muted-foreground">Taux horaire</span><span className="flex items-center gap-1.5 font-medium"><ProfitSignal compact level={signalFromHourlyRate(selected.hourlyRate, thresholds.tauxHoraireCibleMin, thresholds)} />{selected.hourlyRate.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/h</span></div>}</section><section><p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Groupe personnel</p><Select value={groupState.assignments[selected.client.id] ?? "tous"} onValueChange={assignSelected}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{groupState.groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>)}</SelectContent></Select><p className="mt-1.5 text-xs text-muted-foreground">Ce classement est uniquement organisationnel : il ne modifie aucune donnée métier.</p></section><div className="grid gap-2"><Button asChild><Link to={canEdit ? "/pilot/fiche/$clientId" : "/clients/$clientId"} params={{ clientId: selected.client.id }}><BarChart3 className="mr-1.5 h-4 w-4" />Ouvrir la fiche complète</Link></Button><Button variant="outline" asChild><Link to="/clients/$clientId" params={{ clientId: selected.client.id }} search={{ edit: true }}><Pencil className="mr-1.5 h-4 w-4" />Modifier la fiche</Link></Button>{canEdit && clients && <ClientMergeDialog source={selected.client} clients={clients} trigger={<Button variant="outline"><Merge className="mr-1.5 h-4 w-4" />Rattacher à un autre client</Button>} />}</div></div></>}</SheetContent></Sheet>
  </AppShell>;
}
function EmptyState({ hasClients }: { hasClients: boolean }) { return <Card className="flex flex-col items-center gap-3 py-14 text-center"><div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Users className="h-6 w-6" /></div><div><p className="font-medium">{hasClients ? "Aucun résultat" : "Aucun client"}</p><p className="mt-1 text-sm text-muted-foreground">{hasClients ? "Essayez une autre recherche." : "Créez votre premier client pour commencer."}</p></div>{!hasClients && <ClientForm trigger={<Button className="mt-1"><Plus className="mr-1.5 h-4 w-4" />Nouveau client</Button>} />}</Card>; }
