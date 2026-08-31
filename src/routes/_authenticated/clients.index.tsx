import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Merge, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ClientForm } from "@/components/ClientForm";
import { ClientImportDialog } from "@/components/ClientImportDialog";
import { ClientMergeDialog } from "@/components/clients/ClientMergeDialog";
import { ClientDirectoryView, type ClientDirectoryRow } from "@/components/clients/ClientDirectoryView";
import { listClients, type Client } from "@/lib/clients";
import { getClientActivityStatus, type ClientActivityStatus } from "@/lib/client-activity";
import { listFavoriteClientIds, toggleFavoriteClient } from "@/lib/client-favorites";
import { findSuspectClients } from "@/lib/client-cleanup";
import { listEntries, formatEuro } from "@/lib/pilot";
import { hourlyRate, saleRateEligible } from "@/lib/pilot-sale-time";
import { usePilotYear } from "@/lib/pilot-mode";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/clients/")({ head: () => ({ meta: [{ title: "Clients — De la graine au jardin" }] }), component: ClientsPage });
type StatusFilter = "all" | "actif" | "a_relancer" | "dormant" | "perdu" | "cr_a_qualifier";
type SortKey = "name" | "ca" | "recent";
const statusMeta: Record<ClientActivityStatus, { label: string; className: string }> = { actif: { label: "Actif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" }, a_relancer: { label: "À relancer", className: "border-amber-200 bg-amber-50 text-amber-800" }, dormant: { label: "Dormant", className: "border-slate-200 bg-slate-100 text-slate-600" }, perdu: { label: "Client perdu", className: "border-rose-200 bg-rose-50 text-rose-700" } };
interface Row { client: Client; ca: number; hours: number; lastDate: string | null; hourlyRate: number | null; activity: ClientActivityStatus; }

function ClientsPage() {
  const qc = useQueryClient();
  const { canEdit } = useRole();
  const { year } = usePilotYear();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [showLost, setShowLost] = useState(false);
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const favoritesQ = useQuery({ queryKey: ["favorite-clients"], queryFn: listFavoriteClientIds });
  const entriesQ = useQuery({ queryKey: ["pilot-entries"], queryFn: () => listEntries(), enabled: canEdit });
  const favorites = useMemo(() => new Set(favoritesQ.data ?? []), [favoritesQ.data]);
  const favoriteMutation = useMutation({ mutationFn: ({ id, value }: { id: string; value: boolean }) => toggleFavoriteClient(id, value), onSuccess: () => qc.invalidateQueries({ queryKey: ["favorite-clients"] }), onError: (e: Error) => toast.error(e.message) });
  const rows = useMemo<Row[]>(() => {
    const ca = new Map<string, number>(); const hours = new Map<string, number>(); const rated = new Map<string, number>(); const last = new Map<string, string>();
    for (const entry of entriesQ.data ?? []) {
      if (!entry.client_id || new Date(entry.entry_date).getFullYear() !== year) continue;
      ca.set(entry.client_id, (ca.get(entry.client_id) ?? 0) + (Number(entry.amount_ht) || 0));
      const previous = last.get(entry.client_id); if (!previous || entry.entry_date > previous) last.set(entry.client_id, entry.entry_date);
      if (saleRateEligible(entry)) { hours.set(entry.client_id, (hours.get(entry.client_id) ?? 0) + (Number(entry.hours) || 0)); rated.set(entry.client_id, (rated.get(entry.client_id) ?? 0) + (Number(entry.amount_ht) || 0)); }
    }
    return (clientsQ.data ?? []).map((client) => { const h = hours.get(client.id) ?? 0; const date = last.get(client.id) ?? null; return { client, ca: ca.get(client.id) ?? 0, hours: h, lastDate: date, hourlyRate: hourlyRate(rated.get(client.id) ?? 0, h), activity: client.lifecycle_status === "perdu" ? "perdu" : getClientActivityStatus(date) }; });
  }, [clientsQ.data, entriesQ.data, year]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((row) => { const c = row.client; if (status === "cr_a_qualifier") { if ((c.report_policy ?? "a_confirmer") !== "a_confirmer") return false; } else if (status !== "all" && row.activity !== status) return false; if (!showLost && status !== "perdu" && c.lifecycle_status === "perdu") return false; return !q || [c.name, c.address, c.email, c.phone, c.contract_type].filter(Boolean).some((v) => v!.toLowerCase().includes(q)); });
    return [...result].sort((a, b) => sort === "ca" ? b.ca - a.ca : sort === "recent" ? (b.lastDate ?? "").localeCompare(a.lastDate ?? "") : a.client.name.localeCompare(b.client.name, "fr"));
  }, [rows, search, status, sort, showLost]);
  const directoryRows: ClientDirectoryRow[] = filtered.map((row) => ({ id: row.client.id, name: row.client.name, civility: row.client.civility, address: row.client.address, email: row.client.email, phone: row.client.phone, statusLabel: statusMeta[row.activity].label, statusClassName: statusMeta[row.activity].className, activityLabel: row.lastDate ? "Dernière activité" : "Aucune vente enregistrée", lastActivityLabel: row.lastDate ? new Date(row.lastDate).toLocaleDateString("fr-FR") : undefined, contractType: row.client.contract_type, caLabel: canEdit ? `CA ${year} ${formatEuro(row.ca)}` : undefined, hourlyLabel: canEdit && row.hourlyRate != null ? `${row.hourlyRate.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €/h` : undefined, isFavorite: favorites.has(row.client.id) }));
  const suspects = useMemo(() => findSuspectClients(clientsQ.data ?? []), [clientsQ.data]);
  const lostCount = rows.filter((r) => r.client.lifecycle_status === "perdu").length;
  return <AppShell title="Clients"><div className="mx-auto w-full max-w-[1400px] space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Référentiel clients</p><h1 className="text-2xl font-medium tracking-tight">Vos clients</h1></div>{canEdit && <div className="flex gap-2"><ClientImportDialog trigger={<Button variant="outline"><Upload className="mr-1.5 h-4 w-4" />Importer</Button>} /><ClientForm trigger={<Button><Plus className="mr-1.5 h-4 w-4" />Nouveau client</Button>} /></div>}</div>
    <div className="flex flex-wrap items-center gap-2"><div className="flex overflow-x-auto rounded-lg border bg-background p-1 text-sm"><button onClick={() => setStatus("all")} className={`whitespace-nowrap rounded-md px-3 py-1.5 ${status === "all" ? "bg-muted font-medium" : "text-muted-foreground"}`}>Tous <span className="ml-1 text-xs text-muted-foreground">{rows.length}</span></button><button onClick={() => setStatus("actif")} className={`whitespace-nowrap rounded-md px-3 py-1.5 ${status === "actif" ? "bg-muted font-medium" : "text-muted-foreground"}`}>Actifs</button><button onClick={() => setStatus("a_relancer")} className={`whitespace-nowrap rounded-md px-3 py-1.5 ${status === "a_relancer" ? "bg-muted font-medium" : "text-muted-foreground"}`}>À relancer</button><button onClick={() => setStatus("dormant")} className={`whitespace-nowrap rounded-md px-3 py-1.5 ${status === "dormant" ? "bg-muted font-medium" : "text-muted-foreground"}`}>Dormants</button></div><Select value={sort} onValueChange={(v) => setSort(v as SortKey)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Trier : nom</SelectItem><SelectItem value="ca">Trier : CA</SelectItem><SelectItem value="recent">Trier : activité</SelectItem></SelectContent></Select><label className="ml-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground"><Switch checked={showLost || status === "perdu"} disabled={status === "perdu"} onCheckedChange={setShowLost} />Perdus ({lostCount})</label></div>
    <ClientDirectoryView rows={directoryRows} search={search} onSearchChange={setSearch} onToggleFavorite={(id) => favoriteMutation.mutate({ id, value: !favorites.has(id) })} canEdit={canEdit} />
    {canEdit && <Tabs defaultValue="cleaning" className="pt-1"><TabsList className="h-9"><TabsTrigger value="cleaning">À vérifier <span className="ml-1 text-xs">{suspects.length}</span></TabsTrigger></TabsList><TabsContent value="cleaning"><div className="rounded-xl border border-dashed bg-muted/10 p-4"><div className="mb-3 flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-600" /><span className="font-medium">Nettoyage du référentiel</span><span className="text-muted-foreground">Aucune correction automatique.</span></div><div className="grid gap-2 md:grid-cols-2">{suspects.slice(0, 8).map(({ client, reason, suggestion }) => <div key={client.id} className="flex items-center gap-3 rounded-lg border bg-background p-3"><div className="min-w-0 flex-1"><Link to="/clients/$clientId" params={{ clientId: client.id }} className="truncate text-sm font-medium hover:text-primary">{client.name}</Link><p className="text-xs text-muted-foreground">{reason.label}{suggestion ? ` · suggestion : ${suggestion.name}` : ""}</p></div>{clientsQ.data && <ClientMergeDialog source={client} clients={clientsQ.data} defaultTargetId={suggestion?.id ?? null} trigger={<Button size="sm" variant="outline"><Merge className="mr-1 h-3.5 w-3.5" />Rattacher</Button>} />}</div>)}</div></div></TabsContent></Tabs>}
  </div></AppShell>;
}
