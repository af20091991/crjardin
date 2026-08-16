// ---------------------------------------------------------------------------
// Page Direction — tableau de pilotage visuel.
//
// AUCUN CALCUL MÉTIER ICI : toutes les valeurs proviennent du moteur analytique
// unique (`useAnalytics`), leur fiabilité de `pilot-kpi-reliability` et leur
// mise en forme de `pilot-direction-view`. Les graphiques réutilisent le
// composant partagé `PilotFlexChart`.
// ---------------------------------------------------------------------------
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import { DirectorFinancialTable } from "@/components/pilot/DirectorFinancialTable";
import { ChargesSummaryCard } from "@/components/pilot/ChargesSummaryCard";
import { CoverageHistoryCard } from "@/components/pilot/CoverageBanner";
import { usePilotData } from "@/components/pilot/usePilotData";
import { usePilotIntegrity } from "@/components/pilot/usePilotIntegrity";
import { useAnalytics } from "@/lib/pilot-analytics";
import { usePilotPeriod, usePilotYear } from "@/lib/pilot-mode";
import { worstStatus } from "@/lib/pilot-data-state";
import { KPI_CONTRACTS } from "@/lib/pilot-kpi-contract";
import {
  buildKpiReliability,
  KPI_READINESS_LABEL,
  type KpiReadiness,
} from "@/lib/pilot-kpi-reliability";
import { INTEGRITY_LABEL } from "@/lib/pilot-integrity";
import type { KpiKey } from "@/lib/pilot-engine";
import {
  buildDirectionAlerts,
  buildDirectionDatasets,
  buildDirectionDecisions,
  buildDirectionKpis,
  periodLabel,
  type DirectionKpi,
} from "@/lib/pilot-direction-view";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  HelpCircle,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pilot/direction")({
  head: () => ({
    meta: [
      { title: "Direction — tableau de pilotage | Pilot Pro" },
      {
        name: "description",
        content:
          "Tableau de pilotage visuel du dirigeant : CA, charges, résultat, marge, heures et rentabilité réellement enregistrés.",
      },
    ],
  }),
  component: DirectionPage,
});

const READINESS_TONE: Record<KpiReadiness, string> = {
  certifie: "border-emerald-200 bg-emerald-50 text-emerald-700",
  partiel: "border-amber-200 bg-amber-50 text-amber-800",
  a_confirmer: "border-amber-200 bg-amber-50 text-amber-800",
  non_exploitable: "border-red-200 bg-red-50 text-red-700",
  non_disponible: "border-muted bg-muted/40 text-muted-foreground",
};

function DirectionPage() {
  const { snapshot, isLoading } = useAnalytics();
  const { states } = usePilotData();
  const { report } = usePilotIntegrity();
  const { period } = usePilotPeriod();
  const { year } = usePilotYear();

  const dataStatus = worstStatus([states.entries, states.charges, states.clients]);
  const label = periodLabel(period, year);

  const readiness = useMemo(() => {
    const rows = buildKpiReliability({
      contracts: KPI_CONTRACTS,
      snapshot,
      dataStatus,
      dataMessage: "socle de données Pilot Pro",
      qualityStatus: "success",
      qualityMessage: "rapport de qualité",
      integrityStatus: report.status,
      integrityMessage: report.message,
    });
    const map: Partial<Record<KpiKey, { readiness: KpiReadiness; explanation: string }>> = {};
    for (const r of rows) {
      map[r.contract.id as KpiKey] = { readiness: r.readiness, explanation: r.explanation };
    }
    return map;
  }, [snapshot, dataStatus, report.status, report.message]);

  const kpis = useMemo(
    () => buildDirectionKpis({ snapshot, readiness, periodLabel: label }),
    [snapshot, readiness, label],
  );
  const alerts = useMemo(
    () =>
      buildDirectionAlerts({
        snapshot,
        integrityDegraded: report.status !== "certifie",
        integrityMessage: `${INTEGRITY_LABEL[report.status]} — ${report.message}`,
      }),
    [snapshot, report.status, report.message],
  );
  const decisions = useMemo(() => buildDirectionDecisions(snapshot), [snapshot]);
  const datasets = useMemo(
    () =>
      buildDirectionDatasets(
        snapshot,
        period === "exercice_complet"
          ? `Exercice ${year} complet (sélection explicite).`
          : "Réalisé arrêté à la date du jour : aucune donnée future, aucune projection.",
      ),
    [snapshot, period, year],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1) En-tête court : titre, période active, fiabilité globale */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-serif text-xl font-semibold tracking-tight">Direction</h1>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <Badge
          variant="outline"
          className={`gap-1 font-normal ${
            report.status === "certifie" ? READINESS_TONE.certifie : READINESS_TONE.partiel
          }`}
          title={report.message}
        >
          {report.status === "certifie" ? (
            <BadgeCheck className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {INTEGRITY_LABEL[report.status]}
        </Badge>
      </div>

      {/* 2) KPI prioritaires (6 maximum) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <KpiTile key={k.key} kpi={k} />
        ))}
      </div>

      {/* 3) À surveiller — 3 alertes courtes maximum */}
      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            À surveiller
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {alerts.map((a) => (
              <Card
                key={a.id}
                className={`flex items-start gap-2 p-3 text-sm ${
                  a.tone === "danger"
                    ? "border-red-200 bg-red-50/60 text-red-800"
                    : a.tone === "warn"
                      ? "border-amber-200 bg-amber-50/60 text-amber-900"
                      : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                {a.tone === "info" ? (
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="leading-snug">{a.text}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 4) Graphique principal */}
      <PilotFlexChart
        title="Pilotage financier"
        subtitle={label}
        datasets={datasets}
        storageKey="pp.direction.principal"
      />

      {/* 5) Deux graphiques secondaires */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PilotFlexChart
          title="Activité et rentabilité"
          subtitle={label}
          datasets={datasets}
          storageKey="pp.direction.secondaire1"
        />
        <PilotFlexChart
          title="Comparaisons"
          subtitle={label}
          datasets={datasets}
          storageKey="pp.direction.secondaire2"
        />
      </div>

      {/* 6) Décisions à prendre — 3 actions courtes maximum */}
      {decisions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Décisions à prendre
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {decisions.map((d) => (
              <Card key={d.id} className="p-3 text-sm">
                <p className="leading-snug">{d.text}</p>
                {d.to && (
                  <Link
                    to={d.to}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Ouvrir <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Détails de contrôle : hors espace principal, dépliables */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium">
          Détail mensuel, charges et couverture des données
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <DirectorFinancialTable year={year} />
          <ChargesSummaryCard year={year} />
          <CoverageHistoryCard />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function KpiTile({ kpi }: { kpi: DirectionKpi }) {
  const certified = kpi.readiness === "certifie";
  const body = (
    <>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
        <span title={certified ? kpi.audit : `${KPI_READINESS_LABEL[kpi.readiness]} — ${kpi.explanation}`}>
          {certified ? (
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
          )}
        </span>
      </div>
      <div className="mt-1 font-serif text-xl font-semibold tracking-tight tabular-nums">
        {kpi.display}
      </div>
      <div className="text-[11px] text-muted-foreground">
        {kpi.unit} · {kpi.periodLabel}
      </div>
      {kpi.variation && (
        <div
          className={`mt-1 flex items-center gap-0.5 text-xs ${
            kpi.variationTone === "positive"
              ? "text-emerald-600"
              : kpi.variationTone === "negative"
                ? "text-rose-600"
                : "text-muted-foreground"
          }`}
        >
          {kpi.variationTone === "negative" ? (
            <ArrowDownRight className="h-3 w-3" />
          ) : (
            <ArrowUpRight className="h-3 w-3" />
          )}
          {kpi.variation}
        </div>
      )}
      <Badge
        variant="outline"
        className={`mt-2 font-normal ${READINESS_TONE[kpi.readiness]}`}
        title={certified ? kpi.audit : kpi.explanation}
      >
        {KPI_READINESS_LABEL[kpi.readiness]}
      </Badge>
    </>
  );
  return (
    <Card className="h-full p-3">
      {kpi.to ? (
        <Link to={kpi.to} className="block focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}
