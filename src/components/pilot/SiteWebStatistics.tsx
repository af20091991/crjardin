import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/pilot/SiteWebMetric";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import { PP_COLORS } from "@/lib/pilot-colors";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";

const PREFERRED_GA4_PROPERTY_ID = "159443253";

type Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Report = { rows?: Row[] };
type AnalyticsProperty = { name: string; displayName?: string; propertyType?: string };

type PeriodId = "7j" | "30j" | "90j" | "annee";

const PERIODS: Array<{ id: PeriodId; label: string; days: number | null }> = [
  { id: "7j", label: "7 jours", days: 7 },
  { id: "30j", label: "30 jours", days: 30 },
  { id: "90j", label: "90 jours", days: 90 },
  { id: "annee", label: "Depuis le 1er janvier", days: null },
];

export function SiteWebStatistics() {
  const [period, setPeriod] = useState<PeriodId>("30j");
  const [report, setReport] = useState<Report | null>(null);
  const [comparisonReport, setComparisonReport] = useState<Report | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [property, setProperty] = useState<AnalyticsProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activePeriod = PERIODS.find((item) => item.id === period) ?? PERIODS[1];
  const startDate = activePeriod.days == null ? yearStart() : daysAgo(activePeriod.days);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      setComparisonReport(null);
      setComparisonError(null);

      const propertiesResult = await listAnalyticsProperties();
      if (!active) return;

      if (propertiesResult.error) {
        setError(propertiesResult.error);
        setLoading(false);
        return;
      }

      const properties = propertiesResult.data?.properties ?? [];
      const selected =
        properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
        properties.find((item) => item.name === PREFERRED_GA4_PROPERTY_ID) ??
        properties[0];

      if (!selected) {
        setError("Aucune propriété Google Analytics 4 accessible avec ce compte Google.");
        setLoading(false);
        return;
      }

      const propertyId = selected.name.replace(/^properties\//, "");
      setProperty(selected);

      const endDate = yesterday();
      const result = await runAnalyticsReport({
        propertyId,
        startDate,
        endDate,
        dimensions: ["date"],
        metrics: ["sessions", "screenPageViews", "activeUsers"],
      });

      if (!active) return;
      setReport((result.data ?? null) as Report | null);
      setError(result.error);

      const comparison = comparisonPeriod(startDate, endDate, period === "annee");
      const comparisonResult = await runAnalyticsReport({
        propertyId,
        startDate: comparison.start,
        endDate: comparison.end,
        dimensions: ["date"],
        metrics: ["sessions", "screenPageViews", "activeUsers"],
      });
      if (!active) return;
      setComparisonReport((comparisonResult.data ?? null) as Report | null);
      setComparisonError(comparisonResult.error);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [startDate, period]);

  const rows = useMemo(() => report?.rows ?? [], [report]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.sessions += Number(row.metricValues?.[0]?.value ?? 0);
          acc.views += Number(row.metricValues?.[1]?.value ?? 0);
          acc.users += Number(row.metricValues?.[2]?.value ?? 0);
          return acc;
        },
        { sessions: 0, views: 0, users: 0 },
      ),
    [rows],
  );

  const propertyId = property?.name?.replace(/^properties\//, "") ?? "—";

  const trafficDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "trafic-quotidien",
        label: "Sessions, pages vues et utilisateurs",
        unit: "nombre",
        categoryLabel: "Date",
        series: [
          { key: "sessions", label: "Sessions", color: PP_COLORS.sales },
          { key: "views", label: "Pages vues", color: PP_COLORS.primary },
          { key: "users", label: "Utilisateurs", color: PP_COLORS.mid },
        ],
        rows: rows.map((row) => ({
          name: formatShortDate(row.dimensionValues?.[0]?.value ?? ""),
          sessions: Number(row.metricValues?.[0]?.value ?? 0),
          views: Number(row.metricValues?.[1]?.value ?? 0),
          users: Number(row.metricValues?.[2]?.value ?? 0),
        })),
        note: `Données réelles Google Analytics 4, propriété ${propertyId}.`,
      },
    ],
    [rows, propertyId],
  );

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Données Google indisponibles : {error}
        </Card>
      )}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted/50 p-2 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-lg font-semibold">Statistiques</h2>
                <Badge variant="outline" className="font-normal">
                  Analytics 4
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Propriété Google Analytics 4 détectée automatiquement : {propertyId}
                {property?.displayName ? ` · ${property.displayName}` : ""}.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Période : {formatDateLabel(startDate)} → {formatDateLabel(yesterday())}
              </p>
            </div>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Sessions"
            value={loading ? "…" : error ? "—" : formatNumber(totals.sessions)}
            description="Nombre de visites sur le site sur la période. Une même personne qui revient plusieurs fois génère plusieurs sessions."
          />
          <Metric
            label="Pages vues"
            value={loading ? "…" : error ? "—" : formatNumber(totals.views)}
            description="Nombre total de pages consultées, toutes sessions confondues. Une seule session peut compter plusieurs pages vues."
          />
          <Metric
            label="Utilisateurs actifs"
            value={loading ? "…" : error ? "—" : formatNumber(totals.users)}
            description="Nombre de personnes différentes ayant visité le site sur la période (chaque personne n'est comptée qu'une fois, même si elle revient plusieurs fois)."
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-serif text-base font-semibold">
            Évolution par rapport à la période précédente
          </h3>
          <p className="text-xs text-muted-foreground">
            {activePeriod.days == null
              ? "Même période de l’année précédente"
              : "Période de durée équivalente"}
          </p>
        </div>
        {error || comparisonError ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Comparaison indisponible : {error ?? comparisonError}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(["Sessions", "Pages vues", "Utilisateurs actifs"] as const).map((label, index) => {
                const current = [totals.sessions, totals.views, totals.users][index];
                const previousTotals = sumReport(comparisonReport);
                const previous = [
                  previousTotals.sessions,
                  previousTotals.views,
                  previousTotals.users,
                ][index];
                return (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-medium">
                      {loading ? "…" : formatChange(current, previous)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {loading ? "Chargement…" : `Période précédente : ${formatNumber(previous)}`}
                    </p>
                  </div>
                );
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Une hausse ou une baisse décrit l’évolution mesurée ; elle ne prouve pas à elle seule
          l’effet d’une action SEO.
        </p>
      </Card>

      <PilotFlexChart
        title="Évolution du trafic"
        subtitle="Choisissez le type de graphique le plus lisible pour vous"
        datasets={trafficDatasets}
        storageKey="site-web:trafic"
        defaultType="courbe"
        isLoading={loading}
        error={error}
      />
    </div>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodId;
  onChange: (value: PeriodId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
      {PERIODS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === item.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function sumReport(report: Report | null) {
  return (report?.rows ?? []).reduce(
    (acc, row) => {
      acc.sessions += Number(row.metricValues?.[0]?.value ?? 0);
      acc.views += Number(row.metricValues?.[1]?.value ?? 0);
      acc.users += Number(row.metricValues?.[2]?.value ?? 0);
      return acc;
    },
    { sessions: 0, views: 0, users: 0 },
  );
}

function formatChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "0 % (stable)" : "Nouvelle activité";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  const formattedChange = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(change);
  const absoluteDifference = current - previous;
  const absoluteSign = absoluteDifference > 0 ? "+" : "";
  return `${sign}${formattedChange} % · ${absoluteSign}${formatNumber(absoluteDifference)}`;
}

function comparisonPeriod(start: string, end: string, yearToDate: boolean) {
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  if (yearToDate) {
    startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
    endDate.setUTCFullYear(endDate.getUTCFullYear() - 1);
  } else {
    const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    const previousEnd = new Date(startDate);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    endDate.setTime(previousEnd.getTime());
    startDate.setTime(previousEnd.getTime());
    startDate.setUTCDate(startDate.getUTCDate() - days + 1);
  }
  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(parsed);
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
