import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/pilot/SiteWebMetric";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";

const PREFERRED_GA4_PROPERTY_ID = "159443253";

type Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type Report = { rows?: Row[] };
type AnalyticsProperty = { name: string; displayName?: string; propertyType?: string };

export function SiteWebStatistics() {
  const [report, setReport] = useState<Report | null>(null);
  const [property, setProperty] = useState<AnalyticsProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

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

      const result = await runAnalyticsReport({
        propertyId,
        startDate: yearStart(),
        endDate: yesterday(),
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
  }, []);

  const rows = report?.rows ?? [];
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
              Période : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Sessions"
            value={loading ? "…" : formatNumber(totals.sessions)}
            description="Nombre de visites sur le site sur la période. Une même personne qui revient plusieurs fois génère plusieurs sessions."
          />
          <Metric
            label="Pages vues"
            value={loading ? "…" : formatNumber(totals.views)}
            description="Nombre total de pages consultées, toutes sessions confondues. Une seule session peut compter plusieurs pages vues."
          />
          <Metric
            label="Utilisateurs actifs"
            value={loading ? "…" : formatNumber(totals.users)}
            description="Nombre de personnes différentes ayant visité le site sur la période (chaque personne n'est comptée qu'une fois, même si elle revient plusieurs fois)."
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Chargement des données…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune donnée Analytics 4 disponible sur la période.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Sessions</th>
                  <th className="pb-2 text-right">Pages vues</th>
                  <th className="pb-2 text-right">Utilisateurs</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-31).map((row, index) => (
                  <tr
                    key={`${row.dimensionValues?.[0]?.value ?? "row"}-${index}`}
                    className="border-t border-border/40"
                  >
                    <td className="py-3">
                      {formatDateLabel(row.dimensionValues?.[0]?.value ?? "")}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(Number(row.metricValues?.[0]?.value ?? 0))}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(Number(row.metricValues?.[1]?.value ?? 0))}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(Number(row.metricValues?.[2]?.value ?? 0))}
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

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
