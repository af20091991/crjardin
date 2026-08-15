// Module « Journal SST » — journal détaillé des missions de sous-traitance.
// Source unique de vérité : subcontractor_missions (import Excel + saisies manuelles).
// Marge nette HT calculée exclusivement via computeMissionFinancials (src/lib/sst-analytics.ts).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProfitSignal } from "@/components/pilot/ProfitSignal";
import { signalFromMarginPct } from "@/lib/pilot-profit-signal";
import { PilotCard } from "@/components/pilot/PilotCard";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { formatEuro, formatHours } from "@/lib/format-utils";
import { usePilotMode, usePilotPeriod } from "@/lib/pilot-mode";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  listMissionPnl,
  listMissions,
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
import {
  applySstLabelMap,
  deleteSstLabelMapping,
  listSstLabelMap,
  upsertSstLabelMapping,
} from "@/lib/sst-provider-map";
import { sstDuplicateReport, sstDuplicateTotal } from "@/lib/sst-duplicates";
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
import { Archive, ArrowLeftRight, Copy, Download, Pencil, Printer, Settings2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(1)} %`);

export function SstProfitabilityTab() {
  const qc = useQueryClient();
  const { mode } = usePilotMode();
  const { period } = usePilotPeriod();
  const [year, setYear] = useState<number | "all">(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [sstFilter, setSstFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [marginTarget, setMarginTarget] = useState(25);
  const [editing, setEditing] = useState<SubcontractorMission | null>(null);

  const { data: missions = [] } = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const { data: pnl = [] } = useQuery({ queryKey: ["sst-pnl"], queryFn: listMissionPnl });
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
  const { data: labelMap = [] } = useQuery({ queryKey: ["sst-label-map"], queryFn: listSstLabelMap });
  const { data: salesByYear } = useQuery({
    queryKey: ["pilot-sales-by-year", mode, period],
    queryFn: () => listSalesByYear({ mode, period }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["sst-missions"] });
    qc.invalidateQueries({ queryKey: ["sst-pnl"] });
    qc.invalidateQueries({ queryKey: ["sst-audit"] });
  };

  const years = useMemo(() => {
    const set = new Set(missions.map((m) => new Date(m.mission_date).getFullYear()));
    set.add(new Date().getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [missions]);

  const rows = useMemo(
    () =>
      sstRows({ missions, pnl, ssts, clients, mode, includeArchived: showArchived, year }).filter((r) => {
        if (sstFilter !== "all" && r.mission.subcontractor_id !== sstFilter) return false;
        if (!search.trim()) return true;
        const hay = `${r.sstName} ${r.clientName} ${r.mission.service_requested} ${r.mission.prestation ?? ""}`;
        return hay.toLowerCase().includes(search.toLowerCase());
      }),
    [missions, pnl, ssts, clients, mode, showArchived, year, sstFilter, search],
  );

  const totals = useMemo(() => sstTotals(rows), [rows]);
  const monthly = useMemo(() => byMonth(rows), [rows]);
  const perSst = useMemo(() => bySubcontractor(rows), [rows]);
  const perPresta = useMemo(() => byPrestation(rows), [rows]);
  const insights = useMemo(() => sstInsights(rows, totals, marginTarget), [rows, totals, marginTarget]);

  // Sous-traitance déjà enregistrée en charges (aucune saisie supplémentaire demandée).
  const chargeLines = useMemo(
    () => sstChargeLines({ chargeRows, missions, clients, year }),
    [chargeRows, missions, clients, year],
  );
  const chargeProviders = useMemo(() => sstByProvider(chargeLines), [chargeLines]);
  const mappedLines = useMemo(
    () => applySstLabelMap(chargeLines, labelMap, ssts),
    [chargeLines, labelMap, ssts],
  );
  // Rapport de doublons : toutes années confondues, signalement seul.
  const duplicateGroups = useMemo(
    () => sstDuplicateReport(sstChargeLines({ chargeRows, missions, clients, year: "all" })),
    [chargeRows, missions, clients],
  );
  const duplicateTotal = useMemo(() => sstDuplicateTotal(duplicateGroups), [duplicateGroups]);

  const mapMutation = useMutation({
    mutationFn: async (v: { raw_label: string; subcontractor_id: string | null }) => {
      if (!v.subcontractor_id) return deleteSstLabelMapping(v.raw_label);
      const name = ssts.find((s) => s.id === v.subcontractor_id)?.name ?? null;
      return upsertSstLabelMapping({
        raw_label: v.raw_label,
        subcontractor_id: v.subcontractor_id,
        provider_name: name,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sst-label-map"] });
      toast.success("Correspondance enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const caPeriod = useMemo(() => {
    if (!salesByYear) return null;
    if (year === "all") return [...salesByYear.values()].reduce((s, v) => s + v, 0);
    return salesByYear.get(year) ?? 0;
  }, [salesByYear, year]);
  const chargeTotals = useMemo(() => sstChargeTotals(chargeLines, caPeriod), [chargeLines, caPeriod]);

  const archive = useMutation({
    mutationFn: async (row: SstRow) => {
      const next = row.mission.archived_at ? null : new Date().toISOString();
      await updateMission(row.mission.id, { archived_at: next });
      await logSst({
        entity: "mission",
        entity_id: row.mission.id,
        action: next ? "archive" : "restore",
        label: `${row.sstName} — ${row.mission.service_requested}`,
        before_data: { archived_at: row.mission.archived_at },
        after_data: { archived_at: next },
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("Ligne mise à jour");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const duplicate = useMutation({
    mutationFn: async (row: SstRow) => {
      const m = row.mission;
      const created = await createMission({
        subcontractor_id: m.subcontractor_id,
        client_id: m.client_id,
        worksite_sheet_id: m.worksite_sheet_id,
        intervention_id: m.intervention_id,
        service_id: m.service_id,
        mission_date: m.mission_date,
        service_requested: m.service_requested,
        objective: m.objective,
        context_notes: m.context_notes,
        instructions: m.instructions,
        status: m.status,
        report_notes: null,
        anomalies: null,
        recommendations: null,
        hours_spent: m.hours_spent,
        internal_rating: null,
        agreed_price: m.agreed_price,
        invoiced_amount: m.invoiced_amount,
        client_price: m.client_price,
        prestation: m.prestation,
        category: m.category,
        payment_method: m.payment_method,
        hours_saved: m.hours_saved,
      });
      await logSst({
        entity: "mission",
        entity_id: created.id,
        action: "duplicate",
        label: `${row.sstName} — ${m.service_requested}`,
        after_data: { source: m.id },
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("Ligne dupliquée");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (row: SstRow) => {
      await logSst({
        entity: "mission",
        entity_id: row.mission.id,
        action: "delete",
        label: `${row.sstName} — ${row.mission.service_requested}`,
        before_data: row.mission as unknown as Record<string, unknown>,
      });
      await deleteMission(row.mission.id);
    },
    onSuccess: () => {
      refresh();
      toast.success("Ligne supprimée");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const undo = useMutation({
    mutationFn: (entry: SstAuditEntry) => undoSstChange(entry),
    onSuccess: () => {
      refresh();
      toast.success("Modification annulée");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Annulation impossible"),
  });

  const exportCsv = () => {
    const data = rows.map((r) => ({
      Date: r.mission.mission_date,
      Chantier: r.mission.service_requested,
      "Sous-traitant": r.sstName,
      Client: r.clientName,
      Prestation: r.mission.prestation ?? r.mission.service_requested,
      Catégorie: r.mission.category ?? "",
      Autonomie: r.mission.autonomy ?? "",
      "Chantier parallèle": r.mission.parallel_worksite ?? "",
      Statut: MISSION_STATUS_META[r.mission.status]?.label ?? r.mission.status,
      "Heures SST": r.hours ?? "",
      "Temps économisé": r.mission.hours_saved ?? "",
      "Prix SST (€)": r.cost,
      "Prix HT vente (€)": r.revenue,
      "Marge nette HT (€)": r.margin,
      "Marge (%)": r.marginPct != null ? r.marginPct.toFixed(1) : "",
      "Coût horaire (€/h)": r.hourlyCost != null ? r.hourlyCost.toFixed(2) : "",
      "Difficulté /5": r.mission.internal_rating ?? "",
      Détails: r.mission.report_notes ?? "",
      Règlement: r.mission.payment_method ?? "",
      Facture: r.mission.invoice_ref ?? "",
    }));
    downloadCsv(`journal-sst-${year}.csv`, toCsv(data));
  };

  return (
    <div className="space-y-6">
      {/* Audit V2.3+ : missions non rattachées à un client → marge client aveugle. */}
      {missions.filter((m) => !m.client_id && !m.archived_at).length > 0 && (
        <Card className="border-amber-300/70 bg-amber-50/40">
          <CardContent className="py-3 text-sm">
            <strong>{missions.filter((m) => !m.client_id && !m.archived_at).length}</strong> mission
            {missions.filter((m) => !m.client_id && !m.archived_at).length > 1 ? "s" : ""} de sous-traitance sans
            client rattaché : la marge par client reste incomplète. Le rattachement se fait ligne par ligne dans
            le tableau ci-dessous — aucun rapprochement automatique n'est effectué.
          </CardContent>
        </Card>
      )}
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sstFilter} onValueChange={setSstFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Sous-traitant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sous-traitants</SelectItem>
            {ssts.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-56"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={() => setShowArchived((v) => !v)}>
          <Archive className="mr-2 h-4 w-4" />
          {showArchived ? "Masquer les archives" : "Voir les archives"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <SstSettingsDialog
            lists={lists}
            marginTarget={marginTarget}
            onMarginTarget={setMarginTarget}
            onChanged={() => qc.invalidateQueries({ queryKey: ["sst-lists"] })}
          />
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> Excel / CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* A — Synthèse */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PilotCard
          storageId="sst-ca"
          label="CA sous-traitance"
          value={formatEuro(totals.revenue)}
          sub={`${totals.missions} mission(s)`}
          help="Somme des prix facturés au client pour les missions confiées à un sous-traitant."
        />
        <PilotCard
          storageId="sst-cout"
          label="Coût sous-traitance"
          value={formatEuro(totals.cost)}
          sub={totals.avgHourlyCost != null ? `${totals.avgHourlyCost.toFixed(0)} €/h en moyenne` : "Heures non saisies"}
          tone="negative"
          help="Montant facturé par les sous-traitants (montant facturé, sinon prix convenu)."
        />
        <PilotCard
          storageId="sst-marge"
          label="Marge brute"
          value={formatEuro(totals.margin)}
          sub={`${pct(totals.marginPct)} de marge`}
          tone={totals.margin >= 0 ? "positive" : "negative"}
          progress={totals.marginPct != null ? Math.min(100, (totals.marginPct / marginTarget) * 100) : undefined}
          help={`Marge = CA client − coût sous-traitant. Objectif paramétré : ${marginTarget} %.`}
          views={[
            {
              key: "marge",
              label: "Marge brute",
              value: formatEuro(totals.margin),
              sub: `${pct(totals.marginPct)} de marge`,
              tone: totals.margin >= 0 ? "positive" : "negative",
            },
            {
              key: "moyenne",
              label: "Marge moyenne / mission",
              value: formatEuro(totals.avgMarginPerMission ?? 0),
              sub: `${totals.missions} mission(s)`,
            },
          ]}
        />
        <PilotCard
          storageId="sst-temps"
          label="Temps dégagé"
          value={formatHours(totals.hoursSaved)}
          sub={`${formatHours(totals.hours)} réalisées par les SST`}
          help="Heures que vous n'avez pas eu à réaliser vous-même grâce à la sous-traitance."
        />
      </div>

      {/* B — Tableau détaillé */}
      {/* A bis — Sous-traitance repérée dans les charges existantes (lecture seule) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sous-traitance repérée dans les charges</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lignes déjà enregistrées dans le suivi CA (charges). Lecture seule : aucune ressaisie n'est
            nécessaire. Une ligne couverte par une mission SST du même mois et du même montant est
            exclue des totaux pour éviter tout double comptage.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {chargeLines.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune charge de sous-traitance sur cette période.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <PilotCard
                  storageId="sst-charges-total"
                  label="Coût sous-traitance (charges)"
                  value={formatEuro(chargeTotals.amount)}
                  sub={`${chargeTotals.lines} ligne(s)`}
                  tone="negative"
                  help="Somme des charges dont le libellé mentionne la sous-traitance."
                />
                <PilotCard
                  storageId="sst-charges-part"
                  label="Part du CA"
                  value={chargeTotals.shareOfCaPct != null ? pct(chargeTotals.shareOfCaPct) : "—"}
                  sub={caPeriod != null ? `CA de référence ${formatEuro(caPeriod)}` : "CA non disponible"}
                  help="Poids de la sous-traitance dans le chiffre d'affaires de la période."
                />
                <PilotCard
                  storageId="sst-charges-dup"
                  label="Lignes déjà en mission"
                  value={String(chargeTotals.duplicates)}
                  sub={formatEuro(chargeTotals.duplicatesAmount)}
                  help="Charges neutralisées car déjà suivies via une mission SST (protection anti double comptage)."
                />
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prestataire (déduit)</TableHead>
                      <TableHead>Années</TableHead>
                      <TableHead>Client(s) reconnu(s)</TableHead>
                      <TableHead className="text-right">Lignes</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Impact / CA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chargeProviders.map((p) => (
                      <TableRow key={p.provider}>
                        <TableCell className="font-medium">{p.provider}</TableCell>
                        <TableCell>{[...p.years].sort((a, b) => a - b).join(", ")}</TableCell>
                        <TableCell>
                          {p.clients.length > 0 ? (
                            p.clients.join(", ")
                          ) : (
                            <Badge variant="outline">À rattacher</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{p.lines}</TableCell>
                        <TableCell className="text-right" style={{ color: PP_COLORS.charges }}>
                          {formatEuro(p.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {caPeriod && caPeriod > 0 ? pct((p.amount / caPeriod) * 100) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Période</TableHead>
                      <TableHead>Libellé d'origine</TableHead>
                      <TableHead>Prestataire réel</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedLines.map((l) => (
                      <TableRow key={l.id} className={l.duplicateOfMission ? "opacity-50" : undefined}>
                        <TableCell className="whitespace-nowrap">
                          {String(l.month).padStart(2, "0")}/{l.year}
                        </TableCell>
                        <TableCell>{l.designation}</TableCell>
                        <TableCell>
                          <Select
                            value={l.mappedSubcontractorId ?? "none"}
                            onValueChange={(v) =>
                              mapMutation.mutate({
                                raw_label: l.designation,
                                subcontractor_id: v === "none" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-48">
                              <SelectValue placeholder="À rattacher" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">À rattacher</SelectItem>
                              {ssts.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {!l.confirmed && (
                            <span className="block pt-1 text-[11px] text-muted-foreground">
                              Détection auto : {l.provider}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{l.clientName ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatEuro(l.amount)}</TableCell>
                        <TableCell className="text-right">
                          {l.duplicateOfMission && <Badge variant="outline">Déjà en mission</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Doublons potentiels de sous-traitance (rapport)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Lignes identiques (même libellé, même mois, même montant) présentes sur plusieurs
            exercices — typiquement une recopie d'année lors des imports. Signalement uniquement :
            aucune ligne n'est supprimée ni modifiée.
          </p>
        </CardHeader>
        <CardContent>
          {duplicateGroups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun doublon potentiel détecté.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{duplicateGroups.length}</strong> groupe(s) suspect(s) — montant
                potentiellement compté en double :{" "}
                <strong style={{ color: PP_COLORS.charges }}>{formatEuro(duplicateTotal)}</strong>
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Libellé</TableHead>
                      <TableHead>Mois</TableHead>
                      <TableHead>Exercices concernés</TableHead>
                      <TableHead className="text-right">Montant unitaire</TableHead>
                      <TableHead className="text-right">Écart potentiel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicateGroups.map((g) => (
                      <TableRow key={g.key}>
                        <TableCell>{g.designation}</TableCell>
                        <TableCell>{String(g.month).padStart(2, "0")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{g.years.join(" / ")}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatEuro(g.amount)}</TableCell>
                        <TableCell className="text-right" style={{ color: PP_COLORS.charges }}>
                          {formatEuro(g.suspectedAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Journal des missions sous-traitées</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune mission sur cette période. Créez-la depuis l'onglet <strong>Missions</strong>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Chantier</TableHead>
                  <TableHead>Sous-traitant</TableHead>
                  <TableHead>Autonomie</TableHead>
                  <TableHead>Chantier parallèle</TableHead>
                  <TableHead className="text-right">Temps</TableHead>
                  <TableHead className="text-right">Prix SST</TableHead>
                  <TableHead className="text-right">Prix HT vente</TableHead>
                  <TableHead className="text-right">Marge nette HT</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-center">Rentabilité</TableHead>
                  <TableHead className="text-right">Difficulté</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.mission.id} className={r.mission.archived_at ? "opacity-50" : undefined}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.mission.mission_date).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{r.mission.service_requested}</span>
                        {r.mission.archived_at && <Badge variant="outline">Archivée</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.sstName}</TableCell>
                    <TableCell>{r.mission.autonomy ?? "—"}</TableCell>
                    <TableCell>{r.mission.parallel_worksite ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.hours != null ? r.hours.toFixed(1) : "—"}</TableCell>
                    <TableCell className="text-right">{formatEuro(r.cost)}</TableCell>
                    <TableCell className="text-right">{formatEuro(r.revenue)}</TableCell>
                    <TableCell
                      className="text-right font-medium"
                      style={{ color: r.margin >= 0 ? PP_COLORS.primary : PP_COLORS.charges }}
                    >
                      {formatEuro(r.margin)}
                    </TableCell>
                    <TableCell className="text-right">{pct(r.marginPct)}</TableCell>
                    <TableCell className="text-center">
                      <ProfitSignal level={signalFromMarginPct(r.marginPct)} compact />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.mission.internal_rating != null ? `${r.mission.internal_rating}/5` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.mission.report_notes ?? undefined}>
                      {r.mission.report_notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEditing(r.mission)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Dupliquer" onClick={() => duplicate.mutate(r)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={r.mission.archived_at ? "Restaurer" : "Archiver"}
                          onClick={() => archive.mutate(r)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Supprimer"
                          onClick={() => {
                            if (confirm("Supprimer définitivement cette ligne ?")) remove.mutate(r);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right">{totals.hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatEuro(totals.cost)}</TableCell>
                  <TableCell className="text-right">{formatEuro(totals.revenue)}</TableCell>
                  <TableCell className="text-right">{formatEuro(totals.margin)}</TableCell>
                  <TableCell className="text-right">{pct(totals.marginPct)}</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* C — Graphiques */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coût, CA et marge par mois</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="key" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => formatEuro(v)} />
                <Legend />
                <Bar dataKey="cost" name="Coût SST" fill={PP_COLORS.charges} radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" name="CA client" fill={PP_COLORS.sales} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="margin" name="Marge" stroke={PP_COLORS.primary} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Marge par sous-traitant</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perSst} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="key" width={110} fontSize={11} />
                <Tooltip formatter={(v: number) => formatEuro(v)} />
                <Bar dataKey="margin" name="Marge" radius={[0, 4, 4, 0]}>
                  {perSst.map((g) => (
                    <Cell key={g.key} fill={g.margin >= 0 ? PP_COLORS.primary : PP_COLORS.charges} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition du CA sous-traité par prestation</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={perPresta.filter((g) => g.revenue > 0)}
                  dataKey="revenue"
                  nameKey="key"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e: { name?: string }) => e.name ?? ""}
                >
                  {perPresta.map((g, i) => (
                    <Cell key={g.key} fill={PP_SERIES[i % PP_SERIES.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatEuro(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* D — Analyse */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Analyse automatique</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas encore assez de données pour analyser.</p>
          ) : (
            insights.map((i, idx) => (
              <div
                key={idx}
                className="rounded-lg border p-3"
                style={{
                  borderColor:
                    i.tone === "positive"
                      ? PP_COLORS.primary
                      : i.tone === "negative"
                        ? PP_COLORS.charges
                        : PP_COLORS.mid,
                }}
              >
                <p className="text-sm font-medium">{i.title}</p>
                <p className="text-xs text-muted-foreground">{i.detail}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* E — Historique */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowLeftRight className="h-4 w-4" /> Historique des modifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>
          ) : (
            audit.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="font-medium">{a.action}</span> — {a.label ?? "Mission"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("fr-FR")}
                    {a.undone_at && " · annulée"}
                  </p>
                </div>
                {a.before_data && !a.undone_at && a.action !== "undo" && (
                  <Button variant="ghost" size="sm" onClick={() => undo.mutate(a)}>
                    <Undo2 className="mr-2 h-4 w-4" /> Annuler
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <SstRowDialog
            mission={editing}
            lists={lists}
            onDone={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

// --- Édition financière d'une ligne ---
function SstRowDialog({
  mission,
  lists,
  onDone,
}: {
  mission: SubcontractorMission;
  lists: { kind: string; value: string; is_active: boolean }[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    mission_date: mission.mission_date,
    prestation: mission.prestation ?? "",
    category: mission.category ?? "",
    payment_method: mission.payment_method ?? "",
    invoice_ref: mission.invoice_ref ?? "",
    hours_spent: mission.hours_spent?.toString() ?? "",
    hours_saved: mission.hours_saved?.toString() ?? "",
    invoiced_amount: mission.invoiced_amount?.toString() ?? "",
    agreed_price: mission.agreed_price?.toString() ?? "",
    client_price: mission.client_price?.toString() ?? "",
    autonomy: mission.autonomy ?? "",
    parallel_worksite: mission.parallel_worksite ?? "",
    internal_rating: mission.internal_rating?.toString() ?? "",
    report_notes: mission.report_notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const opts = (kind: SstListKind) =>
    valuesOf(lists as never, kind);

  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save() {
    setSaving(true);
    try {
      const patch = {
        mission_date: form.mission_date,
        prestation: form.prestation || null,
        category: form.category || null,
        payment_method: form.payment_method || null,
        invoice_ref: form.invoice_ref || null,
        hours_spent: num(form.hours_spent),
        hours_saved: num(form.hours_saved),
        invoiced_amount: num(form.invoiced_amount),
        agreed_price: num(form.agreed_price),
        client_price: num(form.client_price),
        autonomy: form.autonomy || null,
        parallel_worksite: form.parallel_worksite || null,
        internal_rating: num(form.internal_rating),
        report_notes: form.report_notes || null,
      };
      await updateMission(mission.id, patch);
      await logSst({
        entity: "mission",
        entity_id: mission.id,
        action: "update",
        label: mission.service_requested,
        before_data: {
          mission_date: mission.mission_date,
          prestation: mission.prestation,
          category: mission.category,
          payment_method: mission.payment_method,
          invoice_ref: mission.invoice_ref,
          hours_spent: mission.hours_spent,
          hours_saved: mission.hours_saved,
          invoiced_amount: mission.invoiced_amount,
          agreed_price: mission.agreed_price,
          client_price: mission.client_price,
          autonomy: mission.autonomy,
          parallel_worksite: mission.parallel_worksite,
          internal_rating: mission.internal_rating,
          report_notes: mission.report_notes,
        },
        after_data: patch,
      });
      toast.success("Ligne enregistrée");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type = "text") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        step="0.01"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  const selectField = (label: string, key: "prestation" | "category" | "payment_method", kind: SstListKind) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={form[key] || "none"} onValueChange={(v) => setForm((f) => ({ ...f, [key]: v === "none" ? "" : v }))}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {opts(kind).map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Journal SST — {mission.service_requested}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field("Date", "mission_date", "date")}
        {selectField("Prestation", "prestation", "prestation")}
        {selectField("Catégorie", "category", "category")}
        {field("Heures SST", "hours_spent", "number")}
        {field("Temps économisé (h)", "hours_saved", "number")}
        {field("Prix convenu (€)", "agreed_price", "number")}
        {field("Facturé par le SST (€)", "invoiced_amount", "number")}
        {field("Prix client (€)", "client_price", "number")}
        {field("Autonomie", "autonomy")}
        {field("Chantier parallèle", "parallel_worksite")}
        {field("Difficulté (/5)", "internal_rating", "number")}
        {selectField("Règlement", "payment_method", "payment_method")}
        {field("N° de facture", "invoice_ref")}
      </div>
      <div className="space-y-1.5">
        <Label>Détails</Label>
        <Input
          value={form.report_notes}
          onChange={(e) => setForm((f) => ({ ...f, report_notes: e.target.value }))}
        />
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          Enregistrer
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// --- Paramètres : listes dynamiques + objectif de marge ---
function SstSettingsDialog({
  lists,
  marginTarget,
  onMarginTarget,
  onChanged,
}: {
  lists: { id: string; kind: string; value: string; is_active: boolean }[];
  marginTarget: number;
  onMarginTarget: (n: number) => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  const add = async (kind: SstListKind) => {
    const value = (draft[kind] ?? "").trim();
    if (!value) return;
    try {
      await addSstListItem(kind, value, lists.filter((l) => l.kind === kind).length);
      setDraft((d) => ({ ...d, [kind]: "" }));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-2 h-4 w-4" /> Paramètres
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Paramètres Journal SST</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Objectif de marge (%)</Label>
            <Input
              type="number"
              value={marginTarget}
              onChange={(e) => onMarginTarget(Number(e.target.value) || 0)}
            />
          </div>
          {(Object.keys(SST_LIST_LABELS) as SstListKind[]).map((kind) => (
            <div key={kind} className="space-y-2">
              <Label>{SST_LIST_LABELS[kind]}</Label>
              <div className="flex flex-wrap gap-1.5">
                {lists
                  .filter((l) => l.kind === kind)
                  .map((l) => (
                    <Badge key={l.id} variant="secondary" className="gap-1">
                      {l.value}
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteSstListItem(l.id);
                          onChanged();
                        }}
                        aria-label={`Supprimer ${l.value}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={draft[kind] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [kind]: e.target.value }))}
                  placeholder="Ajouter une valeur"
                />
                <Button variant="outline" onClick={() => add(kind)}>
                  Ajouter
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}