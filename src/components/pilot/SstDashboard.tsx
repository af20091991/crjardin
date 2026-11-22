import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/pilot/LoadingState";
import { EmptyState } from "@/components/pilot/EmptyState";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import { SstCreateMissionDialog } from "@/components/pilot/SstCreateMissionDialog";
import { SstReconciliationBoard } from "@/components/pilot/SstReconciliationBoard";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import { PP_COLORS } from "@/lib/pilot-colors";
import { formatEuro, formatHourlyRate, formatHours, formatPercent } from "@/lib/format-utils";
import { usePilotScope } from "@/lib/pilot-mode";
import { listClients } from "@/lib/clients";
import { listCaEntries } from "@/lib/pilot-ca";
import { listChargeRows } from "@/lib/pilot-charges";
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

/** Objectif de marge par défaut (même valeur que le Journal). */
const MARGIN_TARGET = 25;

const eur = (n: number) => formatEuro(n);
const pct = (n: number | null) => (n == null ? "—" : formatPercent(n));
const monthLabel = (key: string) => `${key.slice(5, 7)}/${key.slice(2, 4)}`;

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

const INSIGHT_ICON: Record<SstInsight["tone"], string> = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  negative: "bg-red-500",
};

export function SstDashboard() {
  const { year, mode, period } = usePilotScope();
  const [createOpen, setCreateOpen] = useState(false);

  const missionsQ = useQuery({ queryKey: ["sst-missions"], queryFn: listMissions });
  const sstsQ = useQuery({ queryKey: ["sst-list"], queryFn: listSubcontractors });
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  // Rapprochement 2026 : toujours lu sur l'exercice de référence, quel que soit le filtre.
  const caQ = useQuery({
    queryKey: ["pilot-ca", RECONCILIATION_YEAR],
    queryFn: () => listCaEntries(RECONCILIATION_YEAR),
  });

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
  const prestations = useMemo(() => byPrestation(scopedRows).slice(0, 10), [scopedRows]);

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

  const providerDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "cout-sous-traitant",
        label: "Coût par sous-traitant",
        unit: "euro",
        categoryLabel: "Sous-traitant",
        series: [
          { key: "fiches", label: "Sur fiches", color: PP_COLORS.charges },
          { key: "orphan", label: "Charges sans fiche", color: PP_COLORS.warning },
        ],
        rows: providerTable.slice(0, 12).map((p) => ({
          name: p.name,
          fiches: p.cost,
          orphan: p.orphan,
        })),
        note: "Coût SST total par sous-traitant : missions avec fiche et charges sans fiche.",
      },
    ],
    [providerTable],
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

  const prestationDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "prestations",
        label: "Coût et marge par prestation",
        unit: "euro",
        categoryLabel: "Prestation",
        series: [
          { key: "cost", label: "Coût SST", color: PP_COLORS.charges },
          { key: "margin", label: "Marge", color: PP_COLORS.primary },
        ],
        rows: prestations.map((p) => ({ name: p.key, cost: p.cost, margin: p.margin })),
        note: "Les 10 prestations les plus coûteuses. Coût des fiches uniquement.",
      },
    ],
    [prestations],
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
      <section aria-label="Chiffres clés" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          title="Coût par sous-traitant"
          subtitle="Sur fiches et charges sans fiche"
          datasets={providerDatasets}
          storageKey="sst-dashboard:sous-traitants"
          defaultType="barres_h"
        />
        <PilotFlexChart
          title="Clients les plus sous-traités"
          subtitle="CA et marge par client"
          datasets={clientDatasets}
          storageKey="sst-dashboard:clients"
          defaultType="barres_h"
        />
        <PilotFlexChart
          title="Coût et marge par prestation"
          subtitle="Où la sous-traitance coûte le plus"
          datasets={prestationDatasets}
          storageKey="sst-dashboard:prestations"
          defaultType="barres"
        />
        <PilotFlexChart
          title="Évolution du taux de marge"
          subtitle="Marge nette rapportée au CA, par mois"
          datasets={monthlyDatasets.filter((d) => d.id === "taux-marge")}
          storageKey="sst-dashboard:taux"
          defaultType="courbe"
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
                      <th className="px-5 py-3 text-left">Sous-traitant</th>
                      <th className="px-3 py-3 text-right">Missions</th>
                      <th className="px-3 py-3 text-right">Coût fiches</th>
                      <th className="px-3 py-3 text-right">Sans fiche</th>
                      <th className="px-3 py-3 text-right">Coût total</th>
                      <th className="px-3 py-3 text-right">CA client</th>
                      <th className="px-3 py-3 text-right">Marge</th>
                      <th className="px-5 py-3 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerTable.map((p) => (
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
