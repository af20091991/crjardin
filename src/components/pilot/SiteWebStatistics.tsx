import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";

const PREFERRED_GA4_PROPERTY_ID = "159443253";
type Granularity = "day" | "week" | "month";

type Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Report = { rows?: Row[] };
type AnalyticsProperty = {
  name: string;
  displayName?: string;
  propertyType?: string;
};

type StatsRow = {
  key: string;
  label: string;
  sessions: number;
  views: number;
  users: number;
};

export function SiteWebStatistics() {
  const [report, setReport] = useState<Report | null>(null);
  const [property, setProperty] = useState<AnalyticsProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [startDate, setStartDate] = useState(yearStart());
  const [endDate, setEndDate] = useState(yesterday());

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      if (startDate > endDate) {
        setError("La date de début doit être antérieure ou égale à la date de fin.");
        setLoading(false);
        return;
      }

      const propertiesResult = await listAnalyticsProperties();
      if (!active) return;

      if (propertiesResult.error) {
        setError(propertiesResult.error);
        setLoading(false);
        return;
      }

      const properties = propertiesResult.data?.properties ?? [];
      const selected =
        properties.find(
          (item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`,
        ) ??
        properties.find((item) => item.name === PREFERRED_GA4_PROPERTY_ID) ??
        properties[0];

      if (!selected) {
        setError("Aucune propriété Google Analytics 4 accessible avec ce compte Google.");
        setLoading(false);
        return;
      }

      const propertyId = selected.name.replace(/^properties\//, "");
      setProperty(selected);

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
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [startDate, endDate]);

  const rows = report?.rows ?? [];
  const statsRows = useMemo(
    () => aggregateRows(rows, granularity),
    [rows, granularity],
  );
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
  const periodLabel = `${formatDateLabel(startDate)} → ${formatDateLabel(endDate)}`;

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Données Google indisponibles : {error}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-lg font-semibold">Statistiques</h2>
              <Badge variant="outline" className="font-normal">
                Analytics 4
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {property?.displayName ?? "Propriété Google Analytics 4"} · ID {propertyId}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Période analysée : {periodLabel}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Sessions" value={loading ? "…" : formatNumber(totals.sessions)} />
          <Metric label="Pages vues" value={loading ? "…" : formatNumber(totals.views)} />
          <Metric
            label="Utilisateurs actifs"
            value={loading ? "…" : formatNumber(totals.users)}
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium">Période et niveau de lecture</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choisissez précisément la période puis regroupez les données par jour,
              semaine ou mois.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Du
              <Input
                type="date"
                value={startDate}
                max={yesterday()}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-[155px]"
                aria-label="Date de début"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Au
              <Input
                type="date"
                value={endDate}
                max={yesterday()}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-[155px]"
                aria-label="Date de fin"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Regrouper par
              <select
                value={granularity}
                onChange={(event) => setGranularity(event.target.value as Granularity)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Regrouper les statistiques par"
              >
                <option value="day">Jour</option>
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
              </select>
            </label>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Évolution du trafic</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {statsRows.length} période{statsRows.length > 1 ? "s" : ""} affichée
              {statsRows.length > 1 ? "s" : ""} · données Google Analytics 4
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chargement des données…
            </p>
          ) : statsRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune donnée Analytics 4 disponible sur cette période.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Période</th>
                  <th className="pb-2 text-right">Sessions</th>
                  <th className="pb-2 text-right">Pages vues</th>
                  <th className="pb-2 text-right">Utilisateurs</th>
                </tr>
              </thead>
              <tbody>
                {statsRows.map((row) => (
                  <tr key={row.key} className="border-t border-border/40">
                    <td className="py-3 font-medium">{row.label}</td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.sessions)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.views)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.users)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function aggregateRows(rows: Row[], granularity: Granularity): StatsRow[] {
  const grouped = new Map<string, StatsRow>();

  for (const row of rows) {
    const rawDate = row.dimensionValues?.[0]?.value ?? "";
    const date = parseDateValue(rawDate);
    if (!date) continue;

    const key = groupingKey(date, granularity);
    const existing = grouped.get(key) ?? {
      key,
      label: groupingLabel(date, granularity),
      sessions: 0,
      views: 0,
      users: 0,
    };

    existing.sessions += Number(row.metricValues?.[0]?.value ?? 0);
    existing.views += Number(row.metricValues?.[1]?.value ?? 0);
    existing.users += Number(row.metricValues?.[2]?.value ?? 0);
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function groupingKey(date: Date, granularity: Granularity) {
  if (granularity === "month") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    return mondayOfWeek(date).toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function groupingLabel(date: Date, granularity: Granularity) {
  if (granularity === "month") {
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(date);
  }
  if (granularity === "week") {
    const monday = mondayOfWeek(date);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return `Semaine du ${formatDateLabel(monday.toISOString().slice(0, 10))} au ${formatDateLabel(
      sunday.toISOString().slice(0, 10),
    )}`;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function mondayOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function parseDateValue(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
