import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pencil, Settings2, Archive, Copy, Trash2, Download, Printer, ArrowLeftRight, Undo2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { PilotCard } from "@/components/pilot/PilotCard";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { signalFromMarginPct } from "@/lib/pilot-profit-signal";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { formatEuro, formatHours } from "@/lib/format-utils";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  listMissions,
  listMissionPnl,
  listSubcontractors,
  updateMission,
  createMission,
  deleteMission,
  MISSION_STATUS_META,
  type SubcontractorMission,
} from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { listChargeRows, listSalesByYear } from "@/lib/pilot-charges";
import { sstByProvider, sstChargeLines, sstChargeTotals } from "@/lib/sst-charges";
import { byMonth, byPrestation, bySubcontractor, sstInsights, sstRows, sstTotals, type SstRow } from "@/lib/sst-analytics";
import { listSstLists, seedSstListsIfEmpty, valuesOf, type SstListKind } from "@/lib/sst-lists";
import { listSstAudit, logSst, undoSstChange, type SstAuditEntry } from "@/lib/sst-audit";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)} %`);

type ColumnKey =
  | "date" | "chantier" | "sst" | "autonomie" | "parallel" | "hours" | "cost"
  | "revenue" | "margin" | "marginPct" | "profit" | "difficulty" | "details" | "actions";

type ColumnDef = { key: ColumnKey; label: string; defaultWidth: number; align?: "left" | "right" | "center" };

const COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", defaultWidth: 105 },
  { key: "chantier", label: "Chantier", defaultWidth: 220 },
  { key: "sst", label: "Sous-traitant", defaultWidth: 170 },
  { key: "autonomie", label: "Autonomie", defaultWidth: 130 },
  { key: "parallel", label: "Chantier parallèle", defaultWidth: 150 },
  { key: "hours", label: "Temps", defaultWidth: 85, align: "right" },
  { key: "cost", label: "Prix SST", defaultWidth: 110, align: "right" },
  { key: "revenue", label: "Prix HT vente", defaultWidth: 120, align: "right" },
  { key: "margin", label: "Marge nette HT", defaultWidth: 125, align: "right" },
  { key: "marginPct", label: "%", defaultWidth: 75, align: "right" },
  { key: "profit", label: "Rentabilité", defaultWidth: 105, align: "center" },
  { key: "difficulty", label: "Difficulté", defaultWidth: 95, align: "right" },
  { key: "details", label: "Détails", defaultWidth: 230 },
  { key: "actions", label: "Actions", defaultWidth: 145, align: "center" },
];

const defaultVisibility: Record<ColumnKey, boolean> = Object.fromEntries(COLUMNS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>;

function useColumnConfig() {
  const [visibility, setVisibility] = useState<Record<ColumnKey, boolean>>(() => {
    try {
      return { ...defaultVisibility, ...(JSON.parse(localStorage.getItem("pp:sst-journal-columns") || "{}") as Partial<Record<ColumnKey, boolean>>) };
    } catch { return defaultVisibility; }
  });
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(() => {
    try {
      return COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: (JSON.parse(localStorage.getItem("pp:sst-journal-widths") || "{}")[c.key] ?? c.defaultWidth) }), {} as Record<ColumnKey, number>);
    } catch { return Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColumnKey, number>; }
  });
  const persistVisibility = (next: Record<ColumnKey, boolean>) => { setVisibility(next); localStorage.setItem("pp:sst-journal-columns", JSON.stringify(next)); };
  const persistWidths = (next: Record<ColumnKey, number>) => { setWidths(next); localStorage.setItem("pp:sst-journal-widths", JSON.stringify(next)); };
  return { visibility, widths, setVisibility: persistVisibility, setWidths: persistWidths };
}

export function SstJournal() {
  const qc = useQueryClient();
  const { mode } = usePilotMode();
  const { period } = usePilotPeriod();
  const [year, setYear] = useState<number | "all">(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sstFilter, setSstFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [marginTarget, setMarginTarget] = useState(25);
  const [editing, setEditing] = useState<SubcontractorMission | null>(null);
  const columns = useColumnConfig();

  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const pnlQ = useQuery({ queryKey: ["sst-pnl"], queryFn: listMissionPnl });
  const { data: ssts = [] } = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: lists = [] } = useQuery({ queryKey: ["sst-lists"], queryFn: async () => { const x = await listSstLists(); return (await seedSstListsIfEmpty(x)) ? listSstLists() : x; } });
  const { data: audit = [] } = useQuery({ queryKey: ["sst-audit"], queryFn: () => listSstAudit(80) });
  const { data: chargeRows = [] } = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const { data: salesByYear } = useQuery({ queryKey: ["pilot-sales-by-year", mode, period], queryFn: () => listSalesByYear({ mode, period }) });

  const missions = missionsQ.data ?? [];
  const pnl = pnlQ.data ?? [];
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sst-missions"] });
    qc.invalidateQueries({ queryKey: ["sst-pnl"] });
    qc.invalidateQueries({ queryKey: ["sst-audit"] });
  };
  const years = useMemo(() => { const s = new Set(missions.map((m) => new Date(m.mission_date).getFullYear())); s.add(new Date().getFullYear()); return [...s].sort((a,b) => b-a); }, [missions]);
  const rows = useMemo(() => sstRows({ missions, pnl, ssts, clients, mode, includeArchived: showArchived, year }).filter((r) => {
    if (sstFilter !== "all" && r.mission.subcontractor_id !== sstFilter) return false;
    if (!search.trim()) return true;
    return `${r.sstName} ${r.clientName} ${r.mission.service_requested} ${r.mission.prestation ?? ""}`.toLowerCase().includes(search.toLowerCase());
  }), [missions, pnl, ssts, clients, mode, showArchived, year, sstFilter, search]);
  const totals = useMemo(() => sstTotals(rows), [rows]);
  const monthly = useMemo(() => byMonth(rows), [rows]);
  const perSst = useMemo(() => bySubcontractor(rows), [rows]);
  const perPresta = useMemo(() => byPrestation(rows), [rows]);
  const insights = useMemo(() => sstInsights(rows, totals, marginTarget), [rows, totals, marginTarget]);
  const chargeLines = useMemo(() => sstChargeLines({ chargeRows, missions, clients, year }), [chargeRows, missions, clients, year]);
  const chargeProviders = useMemo(() => sstByProvider(chargeLines), [chargeLines]);
  const caPeriod = useMemo(() => { if (!salesByYear) return null; return year === "all" ? [...salesByYear.values()].reduce((s,v) => s+v, 0) : salesByYear.get(year) ?? 0; }, [salesByYear, year]);
  const chargeTotals = useMemo(() => sstChargeTotals(chargeLines, caPeriod), [chargeLines, caPeriod]);
  const chartsLoading = missionsQ.isLoading || pnlQ.isLoading;
  const chartsError = missionsQ.error || pnlQ.error ? "Chargement des missions sous-traitées impossible : les graphiques ne peuvent pas être calculés." : null;

  const datasets = useMemo<{ monthly: FlexDataset[]; sst: FlexDataset[]; presta: FlexDataset[] }>(() => ({
    monthly: [{ id:"cout-ca-marge", label:"Coût, CA et marge", unit:"euro", categoryLabel:"Mois", series:[{key:"cost",label:"Coût SST",color:PP_COLORS.charges},{key:"revenue",label:"CA client",color:PP_COLORS.sales},{key:"margin",label:"Marge",color:PP_COLORS.primary}], rows:monthly.map(g=>({name:g.key,cost:g.cost,revenue:g.revenue,margin:g.margin})) }],
    sst: [{ id:"marge-sst", label:"Marge nette HT", unit:"euro", categoryLabel:"Sous-traitant", series:[{key:"margin",label:"Marge",color:PP_COLORS.primary}], rows:perSst.map(g=>({name:g.key,margin:g.margin})) }],
    presta: [{ id:"missions-presta", label:"Nombre de missions", unit:"nombre", categoryLabel:"Prestation", series:[{key:"missions",label:"Missions",color:PP_SERIES[3]}], rows:perPresta.map(g=>({name:g.key,missions:g.missions})) }],
  }), [monthly, perSst, perPresta]);

  const updateArchive = useMutation({ mutationFn: async (r: SstRow) => updateMission(r.mission.id, { archived_at: r.mission.archived_at ? null : new Date().toISOString() }), onSuccess: () => { refresh(); toast.success("Ligne mise à jour"); }, onError: e => toast.error(e instanceof Error ? e.message : "Erreur") });
  const duplicate = useMutation({ mutationFn: async (r: SstRow) => { const m=r.mission; await createMission({ subcontractor_id:m.subcontractor_id,client_id:m.client_id,worksite_sheet_id:m.worksite_sheet_id,intervention_id:m.intervention_id,service_id:m.service_id,mission_date:m.mission_date,service_requested:m.service_requested,objective:m.objective,context_notes:m.context_notes,instructions:m.instructions,status:m.status,report_notes:null,anomalies:null,recommendations:null,hours_spent:m.hours_spent,internal_rating:null,agreed_price:m.agreed_price,invoiced_amount:m.invoiced_amount,client_price:m.client_price,prestation:m.prestation,category:m.category,payment_method:m.payment_method,hours_saved:m.hours_saved}); }, onSuccess:()=>{refresh();toast.success("Ligne dupliquée")}, onError:e=>toast.error(e instanceof Error?e.message:"Erreur") });
  const remove = useMutation({ mutationFn: async (r:SstRow)=>{ await logSst({entity:"mission",entity_id:r.mission.id,action:"delete",label:`${r.sstName} — ${r.mission.service_requested}`,before_data:r.mission as unknown as Record<string,unknown>}); await deleteMission(r.mission.id); }, onSuccess:()=>{refresh();toast.success("Ligne supprimée")}, onError:e=>toast.error(e instanceof Error?e.message:"Erreur") });
  const undo = useMutation({ mutationFn:(entry:SstAuditEntry)=>undoSstChange(entry), onSuccess:()=>{refresh();toast.success("Modification annulée")}, onError:e=>toast.error(e instanceof Error?e.message:"Annulation impossible") });

  const exportCsv = () => downloadCsv(`journal-sst-${year}.csv`, toCsv(rows.map(r => ({ Date:r.mission.mission_date, Chantier:r.mission.service_requested, "Sous-traitant":r.sstName, Client:r.clientName, Prestation:r.mission.prestation ?? r.mission.service_requested, "Heures SST":r.hours ?? "", "Prix SST (€)":r.cost, "Prix HT vente (€)":r.revenue, "Marge nette HT (€)":r.margin, "Marge (%)":r.marginPct ?? "", Statut:MISSION_STATUS_META[r.mission.status]?.label ?? r.mission.status }))));

  const visibleColumns = COLUMNS.filter(c => columns.visibility[c.key]);
  const resizeColumn = (key: ColumnKey, startX: number) => {
    const startWidth = columns.widths[key];
    const move = (e: MouseEvent) => columns.setWidths({ ...columns.widths, [key]: Math.max(70, startWidth + e.clientX - startX) });
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };

  const cell = (r: SstRow, key: ColumnKey) => {
    const m = r.mission;
    switch (key) {
      case "date": return new Date(m.mission_date).toLocaleDateString("fr-FR");
      case "chantier": return <div className="min-w-0 truncate" title={m.service_requested}>{m.service_requested}{m.archived_at && <Badge className="ml-2" variant="outline">Archivée</Badge>}</div>;
      case "sst": return <span className="font-medium truncate block" title={r.sstName}>{r.sstName}</span>;
      case "autonomie": return m.autonomy ?? "—";
      case "parallel": return m.parallel_worksite ?? "—";
      case "hours": return r.hours == null ? "—" : r.hours.toFixed(1);
      case "cost": return formatEuro(r.cost);
      case "revenue": return formatEuro(r.revenue);
      case "margin": return <span style={{color:r.margin >= 0 ? PP_COLORS.primary : PP_COLORS.charges}}>{formatEuro(r.margin)}</span>;
      case "marginPct": return pct(r.marginPct);
      case "profit": return <ProfitSignal level={signalFromMarginPct(r.marginPct)} compact />;
      case "difficulty": return m.internal_rating != null ? `${m.internal_rating}/5` : "—";
      case "details": return <span className="block truncate" title={m.report_notes ?? undefined}>{m.report_notes ?? "—"}</span>;
      case "actions": return <div className="flex items-center justify-center gap-1"><Button variant="ghost" size="icon" title="Modifier" onClick={()=>setEditing(m)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Dupliquer" onClick={()=>duplicate.mutate(r)}><Copy className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={m.archived_at?"Restaurer":"Archiver"} onClick={()=>updateArchive.mutate(r)}><Archive className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Supprimer" onClick={()=>{if(confirm("Supprimer définitivement cette ligne ?")) remove.mutate(r)}}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>;
    }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-2">
      <Select value={String(year)} onValueChange={v=>setYear(v==="all"?"all":Number(v))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes années</SelectItem>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
      <Select value={sstFilter} onValueChange={setSstFilter}><SelectTrigger className="w-52"><SelectValue placeholder="Sous-traitant" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les sous-traitants</SelectItem>{ssts.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
      <Input className="w-56" placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)} />
      <Button variant="outline" size="sm" onClick={()=>setShowArchived(v=>!v)}><Archive className="mr-2 h-4 w-4" />{showArchived?"Masquer les archives":"Voir les archives"}</Button>
      <div className="ml-auto flex gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Settings2 className="mr-2 h-4 w-4" />Colonnes</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{COLUMNS.filter(c=>c.key!=="actions").map(c=><DropdownMenuCheckboxItem key={c.key} checked={columns.visibility[c.key]} onCheckedChange={v=>columns.setVisibility({...columns.visibility,[c.key]:!!v})}>{c.label}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu><Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Excel / CSV</Button><Button variant="outline" size="sm" onClick={()=>window.print()}><Printer className="mr-2 h-4 w-4" />PDF</Button></div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <PilotCard storageId="sst-ca" label="CA sous-traitance" value={formatEuro(totals.revenue)} sub={`${totals.missions} mission(s)`} />
      <PilotCard storageId="sst-cout" label="Coût sous-traitance" value={formatEuro(totals.cost)} sub={totals.avgHourlyCost != null ? `${totals.avgHourlyCost.toFixed(0)} €/h en moyenne` : "Heures non saisies"} tone="negative" />
      <PilotCard storageId="sst-marge" label="Marge moyenne / mission" value={formatEuro(totals.avgMarginPerMission ?? 0)} sub={`${totals.missions} mission(s)`} tone={totals.margin >= 0 ? "positive" : "negative"} />
      <PilotCard storageId="sst-temps" label="Temps dégagé" value={formatHours(totals.hoursSaved)} sub={`${formatHours(totals.hours)} réalisées par les SST`} />
    </div>

    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Sous-traitance repérée dans les charges</CardTitle><p className="text-xs text-muted-foreground">Lignes déjà enregistrées dans le suivi CA (charges). Lecture seule : aucune ressaisie n'est nécessaire. Une ligne couverte par une mission SST du même mois et du même montant est exclue des totaux pour éviter tout double comptage.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3"><PilotCard storageId="sst-charges-total" label="Coût sous-traitance (charges)" value={formatEuro(chargeTotals.amount)} sub={`${chargeTotals.lines} ligne(s)`} tone="negative" /><PilotCard storageId="sst-charges-part" label="Part du CA" value={chargeTotals.shareOfCaPct != null ? pct(chargeTotals.shareOfCaPct) : "—"} sub={caPeriod != null ? `CA de référence ${formatEuro(caPeriod)}` : "CA non disponible"} /><PilotCard storageId="sst-charges-dup" label="Lignes déjà en mission" value={String(chargeTotals.duplicates)} sub={formatEuro(chargeTotals.duplicatesAmount)} /></div>
        <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Prestataire (déduit)</TableHead><TableHead>Années</TableHead><TableHead>Client(s) reconnu(s)</TableHead><TableHead className="text-right">Lignes</TableHead><TableHead className="text-right">Montant</TableHead><TableHead className="text-right">Impact / CA</TableHead></TableRow></TableHeader><TableBody>{chargeProviders.map(p=><TableRow key={p.provider}><TableCell className="font-medium">{p.provider}</TableCell><TableCell>{[...p.years].sort((a,b)=>a-b).join(", ")}</TableCell><TableCell>{p.clients.length?p.clients.join(", "):<Badge variant="outline">À rattacher</Badge>}</TableCell><TableCell className="text-right">{p.lines}</TableCell><TableCell className="text-right">{formatEuro(p.amount)}</TableCell><TableCell className="text-right">{caPeriod&&caPeriod>0?pct(p.amount/caPeriod*100):"—"}</TableCell></TableRow>)}</TableBody></Table></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-2"><div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Journal des missions sous-traitées</CardTitle><p className="hidden text-xs text-muted-foreground lg:block">Colonnes réglables : utilisez la poignée à droite de chaque en-tête.</p></div></CardHeader>
      <CardContent>
        {rows.length===0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucune mission sur cette période.</p> : <div className="overflow-x-auto rounded-md border"><table className="w-max min-w-full border-collapse text-sm"><colgroup>{visibleColumns.map(c=><col key={c.key} style={{width:columns.widths[c.key],minWidth:columns.widths[c.key]}} />)}</colgroup><thead className="bg-muted/50"><tr>{visibleColumns.map(c=><th key={c.key} className={`relative h-10 border-b px-3 text-left font-medium ${c.align==="right"?"text-right":c.align==="center"?"text-center":""}`}><span className="block truncate pr-2">{c.label}</span>{c.key!=="actions"&&<button type="button" aria-label={`Redimensionner ${c.label}`} className="absolute right-0 top-0 h-full w-3 cursor-col-resize text-muted-foreground/40 hover:text-foreground" onMouseDown={e=>{e.preventDefault();resizeColumn(c.key,e.clientX)}}><GripVertical className="h-4 w-4" /></button>}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.mission.id} className={`border-b last:border-0 hover:bg-muted/20 ${r.mission.archived_at?"opacity-50":""}`}>{visibleColumns.map(c=><td key={c.key} className={`max-w-0 overflow-hidden px-3 py-2 ${c.align==="right"?"text-right":c.align==="center"?"text-center":""}`}>{cell(r,c.key)}</td>)}</tr>)}<tr className="border-t-2 font-semibold"><td colSpan={Math.max(1,visibleColumns.findIndex(c=>c.key!=="date"))}>Total</td>{visibleColumns.filter(c=>["hours","cost","revenue","margin"].includes(c.key)).map(c=><td key={c.key} className="px-3 py-2 text-right">{c.key==="hours"?totals.hours.toFixed(1):c.key==="cost"?formatEuro(totals.cost):c.key==="revenue"?formatEuro(totals.revenue):formatEuro(totals.margin)}</td>)}</tr></tbody></table></div>}
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-2"><PilotFlexChart title="Coût, CA et marge par mois" subtitle="Missions sous-traitées de la période sélectionnée" datasets={datasets.monthly} storageKey="sst-journal:mois" isLoading={chartsLoading} error={chartsError} onRetry={refresh} /><PilotFlexChart title="Marge par sous-traitant" subtitle="Classement par prestataire" datasets={datasets.sst} storageKey="sst-journal:sous-traitant" isLoading={chartsLoading} error={chartsError} onRetry={refresh} /><div className="lg:col-span-2"><PilotFlexChart title="Répartition des missions par prestation" subtitle="Nature des missions confiées" datasets={datasets.presta} storageKey="sst-journal:prestation" isLoading={chartsLoading} error={chartsError} onRetry={refresh} /></div></div>

    <Card><CardHeader className="pb-2"><CardTitle className="text-base">Analyse automatique</CardTitle></CardHeader><CardContent className="space-y-2">{insights.length===0?<p className="text-sm text-muted-foreground">Pas encore assez de données pour analyser.</p>:insights.map((i,idx)=><div key={idx} className="rounded-lg border p-3"><p className="text-sm font-medium">{i.title}</p><p className="text-xs text-muted-foreground">{i.detail}</p></div>)}</CardContent></Card>

    <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><ArrowLeftRight className="h-4 w-4" /> Historique des modifications</CardTitle></CardHeader><CardContent className="space-y-2">{audit.length===0?<p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>:audit.map(a=><div key={a.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"><div className="min-w-0"><p className="truncate"><span className="font-medium">{a.action}</span> — {a.label ?? "Mission"}</p><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("fr-FR")}{a.undone_at&&" · annulée"}</p></div>{a.before_data&&!a.undone_at&&a.action!=="undo"&&<Button variant="ghost" size="sm" onClick={()=>undo.mutate(a)}><Undo2 className="mr-2 h-4 w-4" />Annuler</Button>}</div>)}</CardContent></Card>

    <Dialog open={!!editing} onOpenChange={v=>!v&&setEditing(null)}>{editing&&<SstEditDialog mission={editing} lists={lists} onDone={()=>{setEditing(null);refresh();}} />}</Dialog>
  </div>;
}

function SstEditDialog({ mission, lists, onDone }: { mission: SubcontractorMission; lists: {kind:string;value:string;is_active:boolean}[]; onDone:()=>void }) {
  const [form,setForm]=useState({mission_date:mission.mission_date,prestation:mission.prestation??"",category:mission.category??"",payment_method:mission.payment_method??"",invoice_ref:mission.invoice_ref??"",hours_spent:mission.hours_spent?.toString()??"",hours_saved:mission.hours_saved?.toString()??"",invoiced_amount:mission.invoiced_amount?.toString()??"",agreed_price:mission.agreed_price?.toString()??"",client_price:mission.client_price?.toString()??"",autonomy:mission.autonomy??"",parallel_worksite:mission.parallel_worksite??"",internal_rating:mission.internal_rating?.toString()??"",report_notes:mission.report_notes??""});
  const [saving,setSaving]=useState(false);
  const opts=(kind:SstListKind)=>valuesOf(lists as never,kind);
  const num=(v:string)=>v.trim()===""?null:Number(v);
  const save=async()=>{setSaving(true);try{const patch={mission_date:form.mission_date,prestation:form.prestation||null,category:form.category||null,payment_method:form.payment_method||null,invoice_ref:form.invoice_ref||null,hours_spent:num(form.hours_spent),hours_saved:num(form.hours_saved),invoiced_amount:num(form.invoiced_amount),agreed_price:num(form.agreed_price),client_price:num(form.client_price),autonomy:form.autonomy||null,parallel_worksite:form.parallel_worksite||null,internal_rating:num(form.internal_rating),report_notes:form.report_notes||null};await updateMission(mission.id,patch);await logSst({entity:"mission",entity_id:mission.id,action:"update",label:mission.service_requested,before_data:mission as unknown as Record<string,unknown>,after_data:patch});toast.success("Ligne enregistrée");onDone();}catch(e){toast.error(e instanceof Error?e.message:"Erreur")}finally{setSaving(false)}};
  const field=(label:string,key:keyof typeof form,type="text")=><div className="space-y-1.5"><Label>{label}</Label><Input type={type} step="0.01" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></div>;
  const selectField=(label:string,key:"prestation"|"category"|"payment_method",kind:SstListKind)=><div className="space-y-1.5"><Label>{label}</Label><Select value={form[key]||"none"} onValueChange={v=>setForm(f=>({...f,[key]:v==="none"?"":v}))}><SelectTrigger><SelectValue placeholder="—"/></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{opts(kind).map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>;
  return <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Modifier la mission — {mission.service_requested}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{field("Date","mission_date","date")}{selectField("Prestation","prestation","prestation")}{selectField("Catégorie","category","category")}{field("Heures SST","hours_spent","number")}{field("Temps économisé (h)","hours_saved","number")}{field("Prix convenu (€)","agreed_price","number")}{field("Facturé par le SST (€)","invoiced_amount","number")}{field("Prix client (€)","client_price","number")}{field("Autonomie","autonomy")}{field("Chantier parallèle","parallel_worksite")}{field("Difficulté (/5)","internal_rating","number")}{selectField("Règlement","payment_method","payment_method")}{field("N° de facture","invoice_ref")}</div><div className="space-y-1.5"><Label>Détails</Label><Input value={form.report_notes} onChange={e=>setForm(f=>({...f,report_notes:e.target.value}))}/></div><DialogFooter><Button onClick={save} disabled={saving}>{saving?"Enregistrement…":"Enregistrer"}</Button></DialogFooter></DialogContent>;
}
