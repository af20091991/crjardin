import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, Download, Pencil, Printer, Settings2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { PilotCard } from "@/components/pilot/PilotCard";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { formatEuro, formatHours } from "@/lib/format-utils";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  createMission,
  deleteMission,
  listMissionPnl,
  listMissions,
  listSubcontractors,
  MISSION_STATUS_META,
  type SubcontractorMission,
  updateMission,
} from "@/lib/subcontractors";
import { listClients } from "@/lib/clients";
import { listChargeRows, listSalesByYear } from "@/lib/pilot-charges";
import { sstByProvider, sstChargeLines, sstChargeTotals } from "@/lib/sst-charges";
import {
  byMonth,
  byPrestation,
  bySubcontractor,
  sstInsights,
  sstRows,
  sstTotals,
  type SstRow,
} from "@/lib/sst-analytics";
import {
  addSstListItem,
  deleteSstListItem,
  listSstLists,
  seedSstListsIfEmpty,
  SST_LIST_LABELS,
  valuesOf,
  type SstListKind,
} from "@/lib/sst-lists";
import { listSstAudit, logSst, undoSstChange, type SstAuditEntry } from "@/lib/sst-audit";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)} %`);

type ColumnKey =
  | "date"
  | "chantier"
  | "sst"
  | "autonomy"
  | "parallel"
  | "hours"
  | "cost"
  | "revenue"
  | "margin"
  | "marginPct"
  | "profitability"
  | "rating"
  | "details";

const COLUMN_META: Record<ColumnKey, { label: string; defaultWidth: number }> = {
  date: { label: "Date", defaultWidth: 110 },
  chantier: { label: "Chantier", defaultWidth: 220 },
  sst: { label: "Sous-traitant", defaultWidth: 170 },
  autonomy: { label: "Autonomie", defaultWidth: 130 },
  parallel: { label: "Chantier parallèle", defaultWidth: 160 },
  hours: { label: "Temps", defaultWidth: 90 },
  cost: { label: "Prix SST", defaultWidth: 110 },
  revenue: { label: "Prix HT vente", defaultWidth: 120 },
  margin: { label: "Marge nette HT", defaultWidth: 130 },
  marginPct: { label: "%", defaultWidth: 80 },
  profitability: { label: "Rentabilité", defaultWidth: 120 },
  rating: { label: "Difficulté", defaultWidth: 100 },
  details: { label: "Détails", defaultWidth: 220 },
};

const DEFAULT_VISIBLE: Record<ColumnKey, boolean> = Object.fromEntries(
  Object.keys(COLUMN_META).map((k) => [k, true]),
) as Record<ColumnKey, boolean>;

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export function JournalSstPage() {
  const qc = useQueryClient();
  const { mode } = usePilotMode();
  const { period } = usePilotPeriod();
  const [year, setYear] = useState<number | "all">(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sstFilter, setSstFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [marginTarget, setMarginTarget] = useState(25);
  const [editing, setEditing] = useState<SubcontractorMission | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visible, setVisible] = useState<Record<ColumnKey, boolean>>(() => readStorage("sst-journal:columns", DEFAULT_VISIBLE));
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(() =>
    readStorage("sst-journal:column-widths", Object.fromEntries(Object.entries(COLUMN_META).map(([k, v]) => [k, v.defaultWidth])) as Record<ColumnKey, number>),
  );

  useEffect(() => localStorage.setItem("sst-journal:columns", JSON.stringify(visible)), [visible]);
  useEffect(() => localStorage.setItem("sst-journal:column-widths", JSON.stringify(widths)), [widths]);

  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const pnlQ = useQuery({ queryKey: ["sst-pnl"], queryFn: listMissionPnl });
  const { data: ssts = [] } = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const { data: lists = [] } = useQuery({
    queryKey: ["sst-lists"],
    queryFn: async () => {
      const items = await listSstLists();
      if (await seedSstListsIfEmpty(items)) return listSstLists();
      return items;
    },
  });
  const { data: audit = [] } = useQuery({ queryKey: ["sst-audit"], queryFn: () => listSstAudit(80) });
  const { data: chargeRows = [] } = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const { data: salesByYear } = useQuery({
    queryKey: ["pilot-sales-by-year", mode, period],
    queryFn: () => listSalesByYear({ mode, period }),
  });

  const missions = missionsQ.data ?? [];
  const pnl = pnlQ.data ?? [];
  const years = useMemo(() => {
    const set = new Set(missions.map((m) => new Date(m.mission_date).getFullYear()));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [missions]);

  const rows = useMemo(
    () => sstRows({ missions, pnl, ssts, clients, mode, includeArchived: showArchived, year }).filter((r) => {
      if (sstFilter !== "all" && r.mission.subcontractor_id !== sstFilter) return false;
      if (!search.trim()) return true;
      return `${r.sstName} ${r.clientName} ${r.mission.service_requested} ${r.mission.prestation ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase());
    }),
    [missions, pnl, ssts, clients, mode, showArchived, year, sstFilter, search],
  );

  const totals = useMemo(() => sstTotals(rows), [rows]);
  const monthly = useMemo(() => byMonth(rows), [rows]);
  const perSst = useMemo(() => bySubcontractor(rows), [rows]);
  const perPresta = useMemo(() => byPrestation(rows), [rows]);
  const insights = useMemo(() => sstInsights(rows, totals, marginTarget), [rows, totals, marginTarget]);

  const chargeLines = useMemo(() => sstChargeLines({ chargeRows, missions, clients, year }), [chargeRows, missions, clients, year]);
  const chargeProviders = useMemo(() => sstByProvider(chargeLines), [chargeLines]);
  const caPeriod = useMemo(() => {
    if (!salesByYear) return null;
    if (year === "all") return [...salesByYear.values()].reduce((s, v) => s + v, 0);
    return salesByYear.get(year) ?? 0;
  }, [salesByYear, year]);
  const chargeTotals = useMemo(() => sstChargeTotals(chargeLines, caPeriod), [chargeLines, caPeriod]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sst-missions"] });
    qc.invalidateQueries({ queryKey: ["sst-pnl"] });
    qc.invalidateQueries({ queryKey: ["sst-audit"] });
  };

  const archive = useMutation({
    mutationFn: async (row: SstRow) => {
      const next = row.mission.archived_at ? null : new Date().toISOString();
      await updateMission(row.mission.id, { archived_at: next });
      await logSst({ entity: "mission", entity_id: row.mission.id, action: next ? "archive" : "restore", label: `${row.sstName} — ${row.mission.service_requested}`, before_data: { archived_at: row.mission.archived_at }, after_data: { archived_at: next } });
    },
    onSuccess: () => { refresh(); toast.success("Ligne mise à jour"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const duplicate = useMutation({
    mutationFn: async (row: SstRow) => {
      const m = row.mission;
      const created = await createMission({
        subcontractor_id: m.subcontractor_id, client_id: m.client_id, worksite_sheet_id: m.worksite_sheet_id,
        intervention_id: m.intervention_id, service_id: m.service_id, mission_date: m.mission_date,
        service_requested: m.service_requested, objective: m.objective, context_notes: m.context_notes,
        instructions: m.instructions, status: m.status, report_notes: null, anomalies: null, recommendations: null,
        hours_spent: m.hours_spent, internal_rating: null, agreed_price: m.agreed_price,
        invoiced_amount: m.invoiced_amount, client_price: m.client_price, prestation: m.prestation,
        category: m.category, payment_method: m.payment_method, hours_saved: m.hours_saved,
      });
      await logSst({ entity: "mission", entity_id: created.id, action: "duplicate", label: `${row.sstName} — ${m.service_requested}`, after_data: { source: m.id } });
    },
    onSuccess: () => { refresh(); toast.success("Ligne dupliquée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (row: SstRow) => {
      await logSst({ entity: "mission", entity_id: row.mission.id, action: "delete", label: `${row.sstName} — ${row.mission.service_requested}`, before_data: row.mission as unknown as Record<string, unknown> });
      await deleteMission(row.mission.id);
    },
    onSuccess: () => { refresh(); toast.success("Ligne supprimée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const undo = useMutation({
    mutationFn: (entry: SstAuditEntry) => undoSstChange(entry),
    onSuccess: () => { refresh(); toast.success("Modification annulée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Annulation impossible"),
  });

  const exportCsv = () => downloadCsv(`journal-sst-${year}.csv`, toCsv(rows.map((r) => ({
    Date: r.mission.mission_date, Chantier: r.mission.service_requested, "Sous-traitant": r.sstName, Client: r.clientName,
    Prestation: r.mission.prestation ?? r.mission.service_requested, Catégorie: r.mission.category ?? "", Autonomie: r.mission.autonomy ?? "",
    "Chantier parallèle": r.mission.parallel_worksite ?? "", Statut: MISSION_STATUS_META[r.mission.status]?.label ?? r.mission.status,
    "Heures SST": r.hours ?? "", "Temps économisé": r.mission.hours_saved ?? "", "Prix SST (€)": r.cost,
    "Prix HT vente (€)": r.revenue, "Marge nette HT (€)": r.margin, "Marge (%)": r.marginPct != null ? r.marginPct.toFixed(1) : "",
    "Coût horaire (€/h)": r.hourlyCost != null ? r.hourlyCost.toFixed(2) : "", "Difficulté /5": r.mission.internal_rating ?? "",
    Détails: r.mission.report_notes ?? "", Règlement: r.mission.payment_method ?? "", Facture: r.mission.invoice_ref ?? "",
  }))));

  const datasets = useMemo<FlexDataset[]>(() => [
    { id: "cout-ca-marge", label: "Coût, CA et marge", unit: "euro", categoryLabel: "Mois", series: [
      { key: "cost", label: "Coût SST", color: PP_COLORS.charges }, { key: "revenue", label: "CA client", color: PP_COLORS.sales }, { key: "margin", label: "Marge", color: PP_COLORS.primary },
    ], rows: monthly.map((g) => ({ name: g.key, cost: g.cost, revenue: g.revenue, margin: g.margin })) },
  ], [monthly]);
  const sstDatasets = useMemo<FlexDataset[]>(() => [{ id: "marge-sst", label: "Marge nette HT", unit: "euro", categoryLabel: "Sous-traitant", series: [{ key: "margin", label: "Marge", color: PP_COLORS.primary }], rows: perSst.map((g) => ({ name: g.key, margin: g.margin })) }], [perSst]);
  const prestaDatasets = useMemo<FlexDataset[]>(() => [
    { id: "ca-presta", label: "CA sous-traité", unit: "euro", categoryLabel: "Prestation", series: [{ key: "revenue", label: "CA client", color: PP_COLORS.sales }], rows: perPresta.filter((g) => g.revenue > 0).map((g) => ({ name: g.key, revenue: g.revenue })) },
    { id: "marge-presta", label: "Marge par prestation", unit: "euro", categoryLabel: "Prestation", series: [{ key: "margin", label: "Marge", color: PP_COLORS.primary }], rows: perPresta.map((g) => ({ name: g.key, margin: g.margin })) },
  ], [perPresta]);

  const colKeys = (Object.keys(COLUMN_META) as ColumnKey[]).filter((k) => visible[k]);
  const colSpan = colKeys.length + 1;
  const Cell = ({ k, children, head = false, className = "" }: { k: ColumnKey; children: React.ReactNode; head?: boolean; className?: string }) => {
    if (!visible[k]) return null;
    const style = { width: widths[k], minWidth: widths[k] };
    return head ? <TableHead style={style} className={className}>{children}</TableHead> : <TableCell style={style} className={className}>{children}</TableCell>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(v === "all" ? "all" : Number(v))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes années</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <Select value={sstFilter} onValueChange={setSstFilter}><SelectTrigger className="w-52"><SelectValue placeholder="Sous-traitant" /></SelectTrigger><SelectContent><SelectItem value="all">Tous les sous-traitants</SelectItem>{ssts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Input className="w-56" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}><Archive className="mr-2 h-4 w-4" />{showArchived ? "Masquer les archives" : "Voir les archives"}</Button>
        <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
          <DialogTrigger asChild><Button variant="outline" size="sm"><Settings2 className="mr-2 h-4 w-4" />Colonnes</Button></DialogTrigger>
          <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Colonnes du Journal SST</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(COLUMN_META) as ColumnKey[]).map((k) => <div key={k} className="flex items-center gap-3 rounded-md border p-2"><Input type="checkbox" checked={visible[k]} onChange={(e) => setVisible((v) => ({ ...v, [k]: e.target.checked }))} className="h-4 w-4" /><Label className="min-w-0 flex-1">{COLUMN_META[k].label}</Label><Input type="number" min={70} max={420} step={10} value={widths[k]} onChange={(e) => setWidths((w) => ({ ...w, [k]: Math.max(70, Math.min(420, Number(e.target.value) || COLUMN_META[k].defaultWidth)) }))} className="w-24" /></div>)}
            </div>
            <p className="text-xs text-muted-foreground">Décochez une colonne pour la masquer. La largeur est réglable en pixels et mémorisée sur cet appareil.</p>
            <DialogFooter><Button variant="outline" onClick={() => { setVisible(DEFAULT_VISIBLE); setWidths(Object.fromEntries(Object.entries(COLUMN_META).map(([k, v]) => [k, v.defaultWidth])) as Record<ColumnKey, number>); }}>Réinitialiser</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="ml-auto flex gap-2"><Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Excel / CSV</Button><Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />PDF</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PilotCard storageId="sst-ca" label="CA sous-traitance" value={formatEuro(totals.revenue)} sub={`${totals.missions} mission(s)`} />
        <PilotCard storageId="sst-cout" label="Coût sous-traitance" value={formatEuro(totals.cost)} sub={totals.avgHourlyCost != null ? `${totals.avgHourlyCost.toFixed(0)} €/h en moyenne` : "Heures non saisies"} tone="negative" />
        <PilotCard storageId="sst-marge-moyenne" label="Marge moyenne / mission" value={formatEuro(totals.avgMarginPerMission ?? 0)} sub={`${totals.missions} mission(s)`} tone={(totals.avgMarginPerMission ?? 0) >= 0 ? "positive" : "negative"} />
        <PilotCard storageId="sst-temps" label="Temps dégagé" value={formatHours(totals.hoursSaved)} sub={`${formatHours(totals.hours)} réalisées par les SST`} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Sous-traitance repérée dans les charges</CardTitle><p className="text-xs text-muted-foreground">Lignes déjà enregistrées dans le suivi CA (charges). Lecture seule : aucune ressaisie n'est nécessaire. Une ligne couverte par une mission SST du même mois et du même montant est exclue des totaux pour éviter tout double comptage.</p></CardHeader>
        <CardContent><div className="grid gap-3 sm:grid-cols-3 mb-4">
          <PilotCard storageId="sst-charges-total" label="Coût sous-traitance (charges)" value={formatEuro(chargeTotals.amount)} sub={`${chargeTotals.lines} ligne(s)`} tone="negative" />
          <PilotCard storageId="sst-charges-part" label="Part du CA" value={chargeTotals.shareOfCaPct != null ? pct(chargeTotals.shareOfCaPct) : "—"} sub={caPeriod != null ? `CA de référence ${formatEuro(caPeriod)}` : "CA non disponible"} />
          <PilotCard storageId="sst-charges-dup" label="Lignes déjà en mission" value={String(chargeTotals.duplicates)} sub={formatEuro(chargeTotals.duplicatesAmount)} />
        </div><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Prestataire (déduit)</TableHead><TableHead>Années</TableHead><TableHead>Client(s) reconnu(s)</TableHead><TableHead className="text-right">Lignes</TableHead><TableHead className="text-right">Montant</TableHead><TableHead className="text-right">Impact / CA</TableHead></TableRow></TableHeader><TableBody>{chargeProviders.map((p) => <TableRow key={p.provider}><TableCell className="font-medium">{p.provider}</TableCell><TableCell>{[...p.years].sort((a,b) => a-b).join(", ")}</TableCell><TableCell>{p.clients.length ? p.clients.join(", ") : <Badge variant="outline">À rattacher</Badge>}</TableCell><TableCell className="text-right">{p.lines}</TableCell><TableCell className="text-right">{formatEuro(p.amount)}</TableCell><TableCell className="text-right">{caPeriod && caPeriod > 0 ? pct((p.amount / caPeriod) * 100) : "—"}</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Journal des missions sous-traitées</CardTitle><p className="text-xs text-muted-foreground">Cliquez sur le crayon pour modifier une mission. Les colonnes et leurs largeurs sont réglables via « Colonnes ».</p></CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucune mission sur cette période.</p> : <Table><colgroup>{colKeys.map((k) => <col key={k} style={{ width: widths[k], minWidth: widths[k] }} />)}<col style={{ width: 150, minWidth: 150 }} /></colgroup><TableHeader><TableRow>
            <Cell k="date" head>Date</Cell><Cell k="chantier" head>Chantier</Cell><Cell k="sst" head>Sous-traitant</Cell><Cell k="autonomy" head>Autonomie</Cell><Cell k="parallel" head>Chantier parallèle</Cell><Cell k="hours" head className="text-right">Temps</Cell><Cell k="cost" head className="text-right">Prix SST</Cell><Cell k="revenue" head className="text-right">Prix HT vente</Cell><Cell k="margin" head className="text-right">Marge nette HT</Cell><Cell k="marginPct" head className="text-right">%</Cell><Cell k="profitability" head className="text-center">Rentabilité</Cell><Cell k="rating" head className="text-right">Difficulté</Cell><Cell k="details" head>Détails</Cell><TableHead style={{ width: 150, minWidth: 150 }} />
          </TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.mission.id} className={r.mission.archived_at ? "opacity-50" : undefined}>
            <Cell k="date">{new Date(r.mission.mission_date).toLocaleDateString("fr-FR")}</Cell><Cell k="chantier"><div className="flex items-center gap-2"><span>{r.mission.service_requested}</span>{r.mission.archived_at && <Badge variant="outline">Archivée</Badge>}</div></Cell><Cell k="sst" className="font-medium">{r.sstName}</Cell><Cell k="autonomy">{r.mission.autonomy ?? "—"}</Cell><Cell k="parallel">{r.mission.parallel_worksite ?? "—"}</Cell><Cell k="hours" className="text-right">{r.hours != null ? r.hours.toFixed(1) : "—"}</Cell><Cell k="cost" className="text-right">{formatEuro(r.cost)}</Cell><Cell k="revenue" className="text-right">{formatEuro(r.revenue)}</Cell><Cell k="margin" className="text-right font-medium" style={{ color: r.margin >= 0 ? PP_COLORS.primary : PP_COLORS.charges }}>{formatEuro(r.margin)}</Cell><Cell k="marginPct" className="text-right">{pct(r.marginPct)}</Cell><Cell k="profitability" className="text-center"><ProfitSignal level={r.marginPct == null ? "neutral" : r.marginPct >= marginTarget ? "good" : "warning"} compact /></Cell><Cell k="rating" className="text-right">{r.mission.internal_rating != null ? `${r.mission.internal_rating}/5` : "—"}</Cell><Cell k="details" className="max-w-[220px] truncate" title={r.mission.report_notes ?? undefined}>{r.mission.report_notes ?? "—"}</Cell>
            <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Modifier" onClick={() => setEditing(r.mission)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Dupliquer" onClick={() => duplicate.mutate(r)}><Copy className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={r.mission.archived_at ? "Restaurer" : "Archiver"} onClick={() => archive.mutate(r)}><Archive className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Supprimer" onClick={() => { if (confirm("Supprimer définitivement cette ligne ?")) remove.mutate(r); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
          </TableRow>)}<TableRow className="border-t-2 font-semibold"><TableCell colSpan={colSpan}>Total</TableCell>{visible.hours && <TableCell className="text-right">{totals.hours.toFixed(1)}</TableCell>}{visible.cost && <TableCell className="text-right">{formatEuro(totals.cost)}</TableCell>}{visible.revenue && <TableCell className="text-right">{formatEuro(totals.revenue)}</TableCell>}{visible.margin && <TableCell className="text-right">{formatEuro(totals.margin)}</TableCell>}{visible.marginPct && <TableCell className="text-right">{pct(totals.marginPct)}</TableCell>}<TableCell colSpan={Math.max(1, colSpan - 1)} /></TableRow></TableBody></Table>}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2"><PilotFlexChart title="Coût, CA et marge par mois" subtitle="Missions sous-traitées de la période sélectionnée" datasets={datasets} storageKey="sst-journal:mois" isLoading={missionsQ.isLoading || pnlQ.isLoading} error={missionsQ.error || pnlQ.error ? "Chargement impossible" : null} onRetry={refresh} /><PilotFlexChart title="Marge par sous-traitant" subtitle="Classement par prestataire" datasets={sstDatasets} storageKey="sst-journal:sous-traitant" isLoading={missionsQ.isLoading || pnlQ.isLoading} error={missionsQ.error || pnlQ.error ? "Chargement impossible" : null} onRetry={refresh} /><div className="lg:col-span-2"><PilotFlexChart title="Répartition du CA sous-traité par prestation" subtitle="Nature des missions confiées" datasets={prestaDatasets} storageKey="sst-journal:prestation" isLoading={missionsQ.isLoading || pnlQ.isLoading} error={missionsQ.error || pnlQ.error ? "Chargement impossible" : null} onRetry={refresh} /></div></div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Analyse automatique</CardTitle></CardHeader><CardContent className="space-y-2">{insights.length === 0 ? <p className="text-sm text-muted-foreground">Pas encore assez de données pour analyser.</p> : insights.map((i, idx) => <div key={idx} className="rounded-lg border p-3"><p className="text-sm font-medium">{i.title}</p><p className="text-xs text-muted-foreground">{i.detail}</p></div>)}</CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Historique des modifications</CardTitle></CardHeader><CardContent className="space-y-2">{audit.length === 0 ? <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p> : audit.map((a) => <div key={a.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"><div className="min-w-0"><p className="truncate"><span className="font-medium">{a.action}</span> — {a.label ?? "Mission"}</p><p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("fr-FR")}{a.undone_at && " · annulée"}</p></div>{a.before_data && !a.undone_at && a.action !== "undo" && <Button variant="ghost" size="sm" onClick={() => undo.mutate(a)}><Undo2 className="mr-2 h-4 w-4" />Annuler</Button>}</div>)}</CardContent></Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>{editing && <SstEditDialog mission={editing} lists={lists} onDone={() => { setEditing(null); refresh(); }} />}</Dialog>
    </div>
  );
}

function SstEditDialog({ mission, lists, onDone }: { mission: SubcontractorMission; lists: { kind: string; value: string; is_active: boolean }[]; onDone: () => void }) {
  const [form, setForm] = useState({ mission_date: mission.mission_date, prestation: mission.prestation ?? "", category: mission.category ?? "", payment_method: mission.payment_method ?? "", invoice_ref: mission.invoice_ref ?? "", hours_spent: mission.hours_spent?.toString() ?? "", hours_saved: mission.hours_saved?.toString() ?? "", invoiced_amount: mission.invoiced_amount?.toString() ?? "", agreed_price: mission.agreed_price?.toString() ?? "", client_price: mission.client_price?.toString() ?? "", autonomy: mission.autonomy ?? "", parallel_worksite: mission.parallel_worksite ?? "", internal_rating: mission.internal_rating?.toString() ?? "", report_notes: mission.report_notes ?? "" });
  const [saving, setSaving] = useState(false);
  const opts = (kind: SstListKind) => valuesOf(lists as never, kind);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  async function save() {
    setSaving(true);
    try {
      const patch = { mission_date: form.mission_date, prestation: form.prestation || null, category: form.category || null, payment_method: form.payment_method || null, invoice_ref: form.invoice_ref || null, hours_spent: num(form.hours_spent), hours_saved: num(form.hours_saved), invoiced_amount: num(form.invoiced_amount), agreed_price: num(form.agreed_price), client_price: num(form.client_price), autonomy: form.autonomy || null, parallel_worksite: form.parallel_worksite || null, internal_rating: num(form.internal_rating), report_notes: form.report_notes || null };
      await updateMission(mission.id, patch);
      await logSst({ entity: "mission", entity_id: mission.id, action: "update", label: mission.service_requested, before_data: mission as unknown as Record<string, unknown>, after_data: patch });
      toast.success("Ligne enregistrée"); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setSaving(false); }
  }
  const field = (label: string, key: keyof typeof form, type = "text") => <div className="space-y-1.5"><Label>{label}</Label><Input type={type} step="0.01" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} /></div>;
  const selectField = (label: string, key: "prestation" | "category" | "payment_method", kind: SstListKind) => <div className="space-y-1.5"><Label>{label}</Label><Select value={form[key] || "none"} onValueChange={(v) => setForm((f) => ({ ...f, [key]: v === "none" ? "" : v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{opts(kind).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>;
  return <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Modifier la mission SST — {mission.service_requested}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{field("Date", "mission_date", "date")}{selectField("Prestation", "prestation", "prestation")}{selectField("Catégorie", "category", "category")}{field("Heures SST", "hours_spent", "number")}{field("Temps économisé (h)", "hours_saved", "number")}{field("Prix convenu (€)", "agreed_price", "number")}{field("Facturé par le SST (€)", "invoiced_amount", "number")}{field("Prix client (€)", "client_price", "number")}{field("Autonomie", "autonomy")}{field("Chantier parallèle", "parallel_worksite")}{field("Difficulté (/5)", "internal_rating", "number")}{selectField("Règlement", "payment_method", "payment_method")}{field("N° de facture", "invoice_ref")}</div><div className="space-y-1.5"><Label>Détails</Label><Input value={form.report_notes} onChange={(e) => setForm((f) => ({ ...f, report_notes: e.target.value }))} /></div><DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter></DialogContent>;
}
