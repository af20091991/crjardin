import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/pilot/LoadingState";
import { EmptyState } from "@/components/pilot/EmptyState";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import { SstCreateMissionDialog } from "@/components/pilot/SstCreateMissionDialog";
import { SstReconciliationBoard } from "@/components/pilot/SstReconciliationBoard";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
import { useUnseenSstChanges } from "@/components/pilot/SstChangesPanel";
import { formatEuro, formatHourlyRate, formatHours, formatPercent } from "@/lib/format-utils";
import { usePilotScope } from "@/lib/pilot-mode";
import { listClients } from "@/lib/clients";
import { listCaEntries } from "@/lib/pilot-ca";
import { listChargeRows, listSalesByYear } from "@/lib/pilot-charges";
import { listMissions, listSubcontractors } from "@/lib/subcontractors";
import { sstChargeLines, sstByProvider, isAccompanied, isSstCharge } from "@/lib/sst-charges";
import {
  sstRows,
  sstTotals,
  sstInsights,
  bySubcontractor,
  byPrestation,
  byClient,
  byMonth,
  type SstInsight,
} from "@/lib/sst-analytics";
import {
  RECONCILIATION_YEAR,
  findInvoicedMissionsWithoutClient,
  sstMissionCost,
  sstReconciliation,
} from "@/lib/sst-accounting-gap";
import { sstDuplicateReport, sstDuplicateTotal } from "@/lib/sst-duplicates";
import {
  hourlyByPrestation,
  hoursBySubcontractor,
  monthlyBySubcontractor,
  monthlyModeMix,
  priceGaps,
  upcomingMissions,
  yearlySummary,
} from "@/lib/sst-dashboard-metrics";

/** Objectif de marge par défaut (même valeur que le Journal). */
const MARGIN_TARGET = 25;

const eur = (n: number) => formatEuro(n);
const pct = (n: number | null) => (n == null ? "—" : formatPercent(n));
const monthLabel = (key: string) => `${key.slice(5, 7)}/${key.slice(2, 4)}`;
const dateFr = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR");

type Tone = "default" | "positive" | "negative" | "warning";

const TONE_CLASS: Record<Tone, string> = {
  default: "",
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-red-700 dark:text-red-400",
  warning: "text-amber-700 dark:text-amber-400",
};

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tabular-nums ${TONE_CLASS[tone]}`}>{value}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

type ProviderSortKey =
  | "name"
  | "missions"
  | "cost"
  | "orphan"
  | "total"
  | "revenue"
  | "margin"
  | "marginPct";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: { key: ProviderSortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Sous-traitant", align: "left" },
  { key: "missions", label: "Missions", align: "right" },
  { key: "cost", label: "Coût fiches", align: "right" },
  { key: "orphan", label: "Sans fiche", align: "right" },
  { key: "total", label: "Coût total", align: "right" },
  { key: "revenue", label: "CA client", align: "right" },
  { key: "margin", label: "Marge", align: "right" },
  { key: "marginPct", label: "Taux", align: "right" },
];

function SortHeader({
  label,
  align,
  active,
  dir,
  onClick,
}: {
  label: string;
  align: "left" | "right";
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-3 font-medium first:pl-5 last:pr-5 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${align === "right" ? "w-full justify-end" : ""}`}
      >
        {label}
        <Icon
          className={`h-3.5 w-3.5 ${active ? "text-primary" : "opacity-40"}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

const INSIGHT_ICON: Record<SstInsight["tone"], string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  negative: "bg-red-500",
};

export function SstDashboard() {
  const { year, mode, period } = usePilotScope();
  const [createOpen, setCreateOpen] = useState(false);
  const [providerSort, setProviderSort] = useState<{ key: ProviderSortKey; dir: SortDir }>({
    key: "total",
    dir: "desc",
  });

  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstsQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  // Rapprochement 2026 : toujours lu sur l'exercice de référence, quel que soit le filtre.
  const caQ = useQuery({
    queryKey: ["pilot-ca", RECONCILIATION_YEAR],
    queryFn: () => listCaEntries(RECONCILIATION_YEAR),
  });
  // CA total par année : sert uniquement à la part de la sous-traitance dans le CA.
  const salesQ = useQuery({
    queryKey: ["pilot-sales-by-year", mode, period],
    queryFn: () => listSalesByYear({ mode, period }),
  });
  const changes = useUnseenSstChanges(true);

  const missions = useMemo(() => missionsQ.data ?? [], [missionsQ.data]);
  const ssts = useMemo(() => sstsQ.data ?? [], [sstsQ.data]);
  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const caEntries = useMemo(() => caQ.data ?? [], [caQ.data]);

  // Chaque charge SST du Chiffre d'affaires est comptée. Une charge rattachée à une mission du
  // même mois fixe le coût de cette mission ; une charge sans mission reste comptée à part.
  const chargeLines = useMemo(
    () => sstChargeLines({ chargeRows: chargeRowsQ.data ?? [], missions, clients, year }),
    [chargeRowsQ.data, missions, clients, year],
  );
  const costOverride = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of chargeLines) if (l.missionId) map.set(l.missionId, l.amount);
    return map;
  }, [chargeLines]);

  const rows = useMemo(
    () => sstRows({ missions, ssts, clients, mode, year, includeArchived: false, costOverride }),
    [missions, ssts, clients, mode, year, costOverride],
  );
  const scopedRows = useMemo(() => {
    if (period === "exercice_complet") return rows;
    const today = new Date().toISOString().slice(0, 10);
    return rows.filter((r) => r.mission.mission_date <= today);
  }, [rows, period]);
  const totals = useMemo(() => sstTotals(scopedRows), [scopedRows]);

  // Charges SST sans fiche mission (non rattachées), sur la même période que les missions.
  const orphanLines = useMemo(() => {
    const now = new Date();
    return chargeLines.filter(
      (l) =>
        !l.duplicateOfMission &&
        (period === "exercice_complet" ||
          year !== now.getFullYear() ||
          l.month <= now.getMonth() + 1),
    );
  }, [chargeLines, period, year]);
  const orphanTotal = useMemo(() => orphanLines.reduce((s, l) => s + l.amount, 0), [orphanLines]);
  const orphanStats = useMemo(() => sstByProvider(orphanLines), [orphanLines]);

  const totalCost = totals.cost + orphanTotal;

  // Vue par sous-traitant : coût sur fiches + charges sans fiche, CA et marge des fiches.
  const providerTable = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        missions: number;
        cost: number;
        orphan: number;
        revenue: number;
        margin: number;
      }
    >();
    for (const p of bySubcontractor(scopedRows)) {
      map.set(p.key, {
        name: p.key,
        missions: p.missions,
        cost: p.cost,
        orphan: 0,
        revenue: p.revenue,
        margin: p.margin,
      });
    }
    for (const o of orphanStats) {
      const cur = map.get(o.provider) ?? {
        name: o.provider,
        missions: 0,
        cost: 0,
        orphan: 0,
        revenue: 0,
        margin: 0,
      };
      cur.orphan += o.amount;
      map.set(o.provider, cur);
    }
    return [...map.values()]
      .map((r) => ({
        ...r,
        total: r.cost + r.orphan,
        marginPct: r.revenue > 0 ? (r.margin / r.revenue) * 100 : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [scopedRows, orphanStats]);

  const sortedProviders = useMemo(() => {
    const { key, dir } = providerSort;
    const sign = dir === "asc" ? 1 : -1;
    return [...providerTable].sort((a, b) => {
      if (key === "name") return sign * a.name.localeCompare(b.name, "fr");
      if (key === "marginPct") {
        // Les taux absents restent en bas, quel que soit le sens.
        if (a.marginPct == null && b.marginPct == null) return 0;
        if (a.marginPct == null) return 1;
        if (b.marginPct == null) return -1;
        return sign * (a.marginPct - b.marginPct);
      }
      return sign * (a[key] - b[key]);
    });
  }, [providerTable, providerSort]);

  const toggleProviderSort = (key: ProviderSortKey) =>
    setProviderSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );

  const monthly = useMemo(() => {
    const map = new Map<
      string,
      { key: string; revenue: number; cost: number; margin: number; orphan: number }
    >();
    for (const m of byMonth(scopedRows)) {
      map.set(m.key, {
        key: m.key,
        revenue: m.revenue,
        cost: m.cost,
        margin: m.margin,
        orphan: 0,
      });
    }
    for (const l of orphanLines) {
      const key = `${l.year}-${String(l.month).padStart(2, "0")}`;
      const cur = map.get(key) ?? { key, revenue: 0, cost: 0, margin: 0, orphan: 0 };
      cur.orphan += l.amount;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [scopedRows, orphanLines]);

  const clientsTop = useMemo(
    () =>
      byClient(scopedRows)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    [scopedRows],
  );
  const autonomy = useMemo(() => {
    let autonome = 0;
    let chantier = 0;
    let nonClassee = 0;
    let autonomeMargin = 0;
    for (const r of scopedRows) {
      if (r.mission.sst_mode === "autonome") {
        autonome += 1;
        autonomeMargin += r.margin;
      } else if (isAccompanied(r.mission)) chantier += 1;
      else nonClassee += 1;
    }
    return { autonome, chantier, nonClassee, autonomeMargin };
  }, [scopedRows]);

  const insights = useMemo(
    () => sstInsights(scopedRows, totals, MARGIN_TARGET).slice(0, 6),
    [scopedRows, totals],
  );

  // À traiter : rapprochement et qualité des données (exercice de référence).
  const reconciliation = useMemo(
    () => sstReconciliation({ charges: caEntries, missions, year: RECONCILIATION_YEAR }),
    [caEntries, missions],
  );
  const toQualify = useMemo(
    () =>
      caEntries.filter(
        (r) => isSstCharge(r) && r.year === RECONCILIATION_YEAR && (!r.sst_mode || !r.client_id),
      ).length,
    [caEntries],
  );
  const pendingClients = useMemo(() => findInvoicedMissionsWithoutClient(missions), [missions]);
  const pendingClientsTotal = pendingClients.reduce((s, m) => s + m.invoiced_amount, 0);
  const missingTotal = reconciliation.missingMissions.reduce((s, m) => s + sstMissionCost(m), 0);
  const duplicates = useMemo(() => sstDuplicateReport(chargeLines), [chargeLines]);
  const duplicatesTotal = sstDuplicateTotal(duplicates);
  const todoCount =
    reconciliation.missingMissions.length +
    toQualify +
    pendingClients.length +
    duplicates.length +
    orphanLines.length;

  // Graphiques : aucun recalcul, uniquement une mise en forme des agrégats ci-dessus.
  const monthlyDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "ca-cout-marge",
        label: "CA, coût et marge",
        unit: "euro",
        categoryLabel: "Mois",
        series: [
          { key: "revenue", label: "CA client", color: PP_COLORS.sales },
          { key: "cost", label: "Coût sur fiches", color: PP_COLORS.charges },
          { key: "orphan", label: "Charges sans fiche", color: PP_COLORS.warning },
          { key: "margin", label: "Marge", color: PP_COLORS.primary },
        ],
        rows: monthly.map((m) => ({
          name: monthLabel(m.key),
          revenue: m.revenue,
          cost: m.cost,
          orphan: m.orphan,
          margin: m.margin,
        })),
        note: "CA client, coût SST et marge nette HT par mois. Les charges sans fiche sont comptées à part et n'entrent pas dans la marge.",
      },
      {
        id: "taux-marge",
        label: "Taux de marge",
        unit: "pourcent",
        categoryLabel: "Mois",
        series: [{ key: "pct", label: "Taux de marge", color: PP_COLORS.primary }],
        rows: monthly
          .filter((m) => m.revenue > 0)
          .map((m) => ({ name: monthLabel(m.key), pct: (m.margin / m.revenue) * 100 })),
        note: "Marge nette rapportée au CA client, mois par mois (mois sans CA exclus).",
      },
    ],
    [monthly],
  );

  const clientDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "clients",
        label: "CA et marge par client",
        unit: "euro",
        categoryLabel: "Client",
        series: [
          { key: "revenue", label: "CA client", color: PP_COLORS.sales },
          { key: "margin", label: "Marge", color: PP_COLORS.primary },
        ],
        rows: clientsTop.map((c) => ({ name: c.key, revenue: c.revenue, margin: c.margin })),
        note: "Les 10 clients au CA SST le plus élevé de la période. Missions sans client exclues.",
      },
    ],
    [clientsTop],
  );

  const allChargeLines = useMemo(
    () => sstChargeLines({ chargeRows: chargeRowsQ.data ?? [], missions, clients, year: "all" }),
    [chargeRowsQ.data, missions, clients],
  );
  const allCostOverride = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of allChargeLines) if (l.missionId) map.set(l.missionId, l.amount);
    return map;
  }, [allChargeLines]);
  const allRows = useMemo(
    () =>
      sstRows({
        missions,
        ssts,
        clients,
        mode,
        year: "all",
        includeArchived: false,
        costOverride: allCostOverride,
      }),
    [missions, ssts, clients, mode, allCostOverride],
  );
  const allOrphans = useMemo(
    () => allChargeLines.filter((l) => !l.duplicateOfMission),
    [allChargeLines],
  );
  const yearly = useMemo(
    () => yearlySummary(allRows, allOrphans, salesQ.data ?? null, 2026),
    [allRows, allOrphans, salesQ.data],
  );
  const salesThisYear = salesQ.data?.get(year) ?? 0;
  const shareOfSales = salesThisYear > 0 ? (totals.revenue / salesThisYear) * 100 : null;

  const gaps = useMemo(() => priceGaps(scopedRows), [scopedRows]);
  const rates = useMemo(() => hourlyByPrestation(scopedRows), [scopedRows]);
  const hoursBySub = useMemo(() => hoursBySubcontractor(scopedRows).slice(0, 8), [scopedRows]);
  const modeMix = useMemo(() => monthlyModeMix(scopedRows), [scopedRows]);
  const missionsByMonth = useMemo(() => monthlyBySubcontractor(scopedRows, 5), [scopedRows]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(
    () =>
      upcomingMissions(
        missions.filter((m) => new Date(m.mission_date).getFullYear() === year),
        today,
        6,
      ),
    [missions, year, today],
  );
  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const sstNames = useMemo(() => new Map(ssts.map((s) => [s.id, s.name])), [ssts]);

  const annualDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "annuel",
        label: "Évolution annuelle",
        unit: "euro",
        categoryLabel: "Année",
        series: [
          { key: "revenue", label: "CA SST", color: PP_COLORS.sales },
          { key: "cost", label: "Coût total", color: PP_COLORS.charges },
          { key: "margin", label: "Marge", color: PP_COLORS.primary },
        ],
        rows: yearly.map((y) => ({
          name: String(y.year),
          revenue: y.revenue,
          cost: y.cost,
          margin: y.margin,
        })),
        note: "Années à partir de 2026. Coût total = fiches + charges sans fiche. Avec le mode « Réel », les missions futures n'apparaissent qu'une fois réalisées.",
      },
    ],
    [yearly],
  );

  const missionsMonthDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "missions-mois",
        label: "Missions par mois",
        unit: "nombre",
        categoryLabel: "Mois",
        series: missionsByMonth.subs.map((name, i) => ({
          key: `s${i}`,
          label: name,
          color: name === "Autres" ? PP_COLORS.neutral : PP_SERIES[i % PP_SERIES.length],
        })),
        rows: missionsByMonth.months.map((m) => {
          const row: Record<string, string | number> = { name: monthLabel(m.key) };
          missionsByMonth.subs.forEach((name, i) => {
            row[`s${i}`] = m.counts[name] ?? 0;
          });
          return row;
        }),
        note: "Nombre de missions par mois. Les 5 sous-traitants les plus actifs, les autres regroupés.",
      },
    ],
    [missionsByMonth],
  );

  const loading = missionsQ.isLoading || sstsQ.isLoading || clientsQ.isLoading;
  if (loading) return <LoadingState label="Chargement des données SST…" />;

  const hasData = scopedRows.length > 0 || orphanLines.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-xl font-semibold">Tableau de bord SST</h2>
            <Badge variant="secondary">
              {period === "exercice_complet" ? "Exercice complet" : "À date"}
            </Badge>
            <Badge variant="outline">Exercice {year}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Finances, activité et gestion de la sous-traitance.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle mission
        </Button>
      </div>

      {!hasData && (
        <EmptyState
          title="Aucune mission SST sur cette période."
          description="Créez une mission ou importez vos données pour alimenter le tableau de bord."
        />
      )}

      {/* Chiffres clés */}
      <section aria-label="Chiffres clés" className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          label="CA SST"
          value={eur(totals.revenue)}
          sub={`${totals.missions} mission(s)${
            totals.missionsWithoutPrice > 0
              ? ` · ${totals.missionsWithoutPrice} sans prix client`
              : ""
          }`}
        />
        <Kpi
          label="Coût SST total"
          value={eur(totalCost)}
          sub={`${eur(totals.cost)} sur fiches · ${eur(orphanTotal)} sans fiche`}
          tone="negative"
        />
        <Kpi
          label="Marge brute"
          value={eur(totals.margin)}
          sub={`${pct(totals.marginPct)} du CA · fiches uniquement`}
          tone={totals.margin >= 0 ? "positive" : "negative"}
        />
        <Kpi
          label="Taux de marge"
          value={pct(totals.marginPct)}
          sub={`Objectif ${MARGIN_TARGET} %`}
          tone={
            totals.marginPct == null
              ? "default"
              : totals.marginPct >= MARGIN_TARGET
                ? "positive"
                : "warning"
          }
        />
        <Kpi
          label="Marge moyenne / mission"
          value={eur(totals.avgMarginPerMission ?? 0)}
          sub={`${totals.missions} mission(s) avec fiche`}
        />
        <Kpi
          label="Coût horaire moyen SST"
          value={totals.avgHourlyCost == null ? "—" : formatHourlyRate(totals.avgHourlyCost)}
          sub={`${formatHours(totals.hours)} réalisées par les SST`}
        />
        <Kpi
          label="Autonomie / chantier"
          value={`${autonomy.autonome} / ${autonomy.chantier}`}
          sub={`${autonomy.nonClassee} non classée(s) · marge autonome ${eur(autonomy.autonomeMargin)}`}
        />
        <Kpi
          label="Temps économisé"
          value={formatHours(totals.hoursSaved)}
          sub="Heures non réalisées par vous grâce à la sous-traitance"
        />
        <Kpi
          label="Part SST dans le CA"
          value={pct(shareOfSales)}
          sub={
            salesThisYear > 0
              ? `${eur(totals.revenue)} sur ${eur(salesThisYear)} de CA total`
              : "CA total de l'exercice non renseigné"
          }
        />
        <Kpi
          label="Écart convenu / facturé"
          value={eur(gaps.total)}
          sub={`${gaps.count} mission(s) avec écart de prix`}
          tone={gaps.total > 0 ? "warning" : "default"}
        />
      </section>

      {/* Graphiques */}
      <section aria-label="Graphiques" className="grid gap-5 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <PilotFlexChart
            title="CA, coût et marge par mois"
            subtitle="Choisissez l'indicateur et le type de graphique"
            datasets={monthlyDatasets.filter((d) => d.id === "ca-cout-marge")}
            storageKey="sst-dashboard:mois"
            defaultType="barres_groupees"
          />
        </div>
        <PilotFlexChart
          title="Évolution annuelle"
          subtitle="À partir de 2026, années à venir incluses"
          datasets={annualDatasets}
          storageKey="sst-dashboard:annuel"
          defaultType="barres_groupees"
        />
        <PilotFlexChart
          title="Évolution du taux de marge"
          subtitle="Marge nette rapportée au CA, par mois"
          datasets={monthlyDatasets.filter((d) => d.id === "taux-marge")}
          storageKey="sst-dashboard:taux"
          defaultType="courbe"
        />
        <PilotFlexChart
          title="Clients les plus sous-traités"
          subtitle="CA et marge par client"
          datasets={clientDatasets}
          storageKey="sst-dashboard:clients"
          defaultType="barres_h"
        />
        <PilotFlexChart
          title="Missions par mois et par sous-traitant"
          subtitle="Charge de travail sous-traitée"
          datasets={missionsMonthDatasets}
          storageKey="sst-dashboard:missions-mois"
          defaultType="barres_empilees"
        />
      </section>

      {/* Détail chiffré */}
      <section
        aria-label="Détail"
        className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance par sous-traitant</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {providerTable.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Aucun sous-traitant sur la période.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      {SORT_COLUMNS.map((c) => (
                        <SortHeader
                          key={c.key}
                          label={c.label}
                          align={c.align}
                          active={providerSort.key === c.key}
                          dir={providerSort.dir}
                          onClick={() => toggleProviderSort(c.key)}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProviders.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="px-5 py-3 font-medium">{p.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{p.missions}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{eur(p.cost)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{eur(p.orphan)}</td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          {eur(p.total)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{eur(p.revenue)}</td>
                        <td
                          className={`px-3 py-3 text-right tabular-nums ${p.margin < 0 ? "text-red-700 dark:text-red-400" : ""}`}
                        >
                          {eur(p.margin)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{pct(p.marginPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Points d'attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien à signaler sur la période.</p>
            ) : (
              insights.map((i) => (
                <div key={i.title} className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${INSIGHT_ICON[i.tone]}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">{i.detail}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Activité : répartition et heures en tableaux */}
      <section aria-label="Activité" className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Autonome / chantier par mois</CardTitle>
            <p className="text-xs text-muted-foreground">Nombre de missions, 12 derniers mois.</p>
          </CardHeader>
          <CardContent className="p-0">
            {modeMix.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Aucune mission sur la période.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-5 py-3 text-left">Mois</th>
                      <th className="px-3 py-3 text-right">Autonome</th>
                      <th className="px-3 py-3 text-right">Chantier</th>
                      <th className="px-5 py-3 text-right">Non classée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modeMix
                      .slice(-12)
                      .reverse()
                      .map((m) => (
                        <tr key={m.key} className="border-b last:border-0">
                          <td className="px-5 py-3 font-medium tabular-nums">
                            {monthLabel(m.key)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{m.autonome}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{m.chantier}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{m.nonClassee}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Heures économisées vs réalisées</CardTitle>
            <p className="text-xs text-muted-foreground">Par sous-traitant, 8 premiers.</p>
          </CardHeader>
          <CardContent className="p-0">
            {hoursBySub.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Aucune heure saisie sur la période.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-5 py-3 text-left">Sous-traitant</th>
                      <th className="px-3 py-3 text-right">Missions</th>
                      <th className="px-3 py-3 text-right">Économisées</th>
                      <th className="px-5 py-3 text-right">Réalisées</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursBySub.map((h) => (
                      <tr key={h.name} className="border-b last:border-0">
                        <td className="px-5 py-3 font-medium">{h.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{h.missions}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatHours(h.saved)}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatHours(h.realized)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Prix, écarts, planning et calendrier */}
      <section aria-label="Prix et planning" className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prix et coût par heure, par prestation</CardTitle>
            <p className="text-xs text-muted-foreground">
              Missions non accompagnées ayant des heures saisies.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {rates.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Données insuffisantes : aucune heure saisie sur la période.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-5 py-3 text-left">Prestation</th>
                      <th className="px-3 py-3 text-right">Missions</th>
                      <th className="px-3 py-3 text-right">Heures</th>
                      <th className="px-3 py-3 text-right">Vente / h</th>
                      <th className="px-3 py-3 text-right">Coût / h</th>
                      <th className="px-5 py-3 text-right">Marge / h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.slice(0, 8).map((r) => (
                      <tr key={r.name} className="border-b last:border-0">
                        <td className="px-5 py-3 font-medium">{r.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.missions}</td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatHours(r.hours)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatHourlyRate(r.saleHourly)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatHourlyRate(r.costHourly)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right tabular-nums ${r.marginHourly < 0 ? "text-red-700 dark:text-red-400" : ""}`}
                        >
                          {formatHourlyRate(r.marginHourly)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Écarts convenu / facturé</CardTitle>
            <p className="text-xs text-muted-foreground">
              Total {eur(gaps.total)} sur {gaps.count} mission(s). Les plus forts écarts d'abord.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {gaps.count === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Aucun écart entre prix convenu et montant facturé.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="px-5 py-3 text-left">Date</th>
                      <th className="px-3 py-3 text-left">Sous-traitant</th>
                      <th className="px-3 py-3 text-left">Prestation</th>
                      <th className="px-3 py-3 text-right">Convenu</th>
                      <th className="px-3 py-3 text-right">Facturé</th>
                      <th className="px-5 py-3 text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.items.slice(0, 8).map((g) => (
                      <tr key={g.id} className="border-b last:border-0">
                        <td className="px-5 py-3 tabular-nums">{dateFr(g.date)}</td>
                        <td className="px-3 py-3">{g.sst}</td>
                        <td className="max-w-[12rem] truncate px-3 py-3">{g.label}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{eur(g.agreed)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{eur(g.invoiced)}</td>
                        <td
                          className={`px-5 py-3 text-right font-medium tabular-nums ${g.gap > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}
                        >
                          {g.gap > 0 ? "+" : ""}
                          {eur(g.gap)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines missions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">Aucune mission planifiée à venir.</p>
            ) : (
              upcoming.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-medium tabular-nums">{dateFr(m.mission_date)}</span>
                    {" · "}
                    {sstNames.get(m.subcontractor_id) ?? "Sous-traitant"}
                    {" · "}
                    {m.prestation || m.service_requested}
                  </span>
                  <span className="text-muted-foreground">
                    {m.client_id
                      ? (clientNames.get(m.client_id) ?? "Client inconnu")
                      : "Sans client"}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              Calendrier SST
              <Link to="/pilot/calendrier" className="text-xs font-normal text-primary underline">
                Ouvrir le calendrier
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {changes.length === 0 ? (
              <p className="text-muted-foreground">Aucune modification non vue.</p>
            ) : (
              <>
                <p>
                  <span className="font-semibold tabular-nums">{changes.length}</span>{" "}
                  modification(s) non vue(s)
                </p>
                {changes.slice(0, 3).map((c) => (
                  <p key={c.id} className="truncate text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")} · {c.summary}
                  </p>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* À traiter */}
      {todoCount === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/60 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Aucune donnée SST à traiter.
        </div>
      ) : (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />À traiter ({todoCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-5">
            <TodoItem
              label="Missions non comptabilisées"
              count={reconciliation.missingMissions.length}
              amount={missingTotal}
              hint={year === RECONCILIATION_YEAR ? "Rapprochement ci-dessous" : undefined}
            />
            <TodoItem
              label="Charges à qualifier"
              count={toQualify}
              hint="Autonomie et client : fenêtre dans Chiffre d'affaires"
            />
            <TodoItem
              label="Missions sans client"
              count={pendingClients.length}
              amount={pendingClientsTotal}
              hint="Rattachez le client dans la fiche mission"
            />
            <TodoItem
              label="Doublons possibles"
              count={duplicates.length}
              amount={duplicatesTotal}
              hint="Même libellé et montant sur plusieurs années"
            />
            <TodoItem
              label="Charges sans fiche"
              count={orphanLines.length}
              amount={orphanTotal}
              hint="Comptées dans le coût, hors marge"
              action={
                orphanLines.length > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Créer une fiche
                  </Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      )}
      {year === RECONCILIATION_YEAR && reconciliation.missingMissions.length > 0 && (
        <SstReconciliationBoard />
      )}

      <SstCreateMissionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subcontractors={ssts}
        onCreated={() => {
          missionsQ.refetch();
        }}
      />
      <p className="text-xs text-muted-foreground">
        Règle économique : CA client − coût SST = marge. Les charges sans fiche sont comptées dans
        le coût total mais n'entrent pas dans la marge. Les données futures de l'exercice complet
        sont incluses et signalées comme prévisionnelles.
      </p>
    </div>
  );
}

function TodoItem({
  label,
  count,
  amount,
  hint,
  action,
}: {
  label: string;
  count: number;
  amount?: number;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${count > 0 ? "" : "text-muted-foreground"}`}
      >
        {count}
        {amount != null && count > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">{eur(amount)}</span>
        )}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}
