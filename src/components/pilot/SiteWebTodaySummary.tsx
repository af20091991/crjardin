// Résumé chiffré réel des 30 derniers jours (Analytics 4 + Search Console).
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { describeSiteWebError } from "@/lib/site-web-error-labels";
import {
  listAnalyticsProperties,
  querySearchConsole,
  runAnalyticsReport,
} from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";
const PREFERRED_GA4_PROPERTY_ID = "159443253";

type SearchRow = { clicks?: number; impressions?: number; position?: number };
type AnalyticsRow = { metricValues?: Array<{ value?: string }> };

function dayOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function SiteWebTodaySummary() {
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);
  const [sessions, setSessions] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = dayOffset(30);
  const endDate = dayOffset(1);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const searchResult = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate,
        endDate,
        dimensions: ["date"],
      });
      if (!active) return;
      if (searchResult.error) setError(describeSiteWebError(searchResult.error));
      setSearchRows(searchResult.data?.rows ?? []);

      const propertiesResult = await listAnalyticsProperties();
      if (!active) return;
      if (propertiesResult.error) {
        setError((current) => current ?? describeSiteWebError(propertiesResult.error ?? ""));
        setLoading(false);
        return;
      }
      const properties = propertiesResult.data?.properties ?? [];
      const selected =
        properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
        properties[0];
      if (!selected) {
        setLoading(false);
        return;
      }

      const reportResult = await runAnalyticsReport({
        propertyId: selected.name.replace(/^properties\//, ""),
        startDate,
        endDate,
        dimensions: ["date"],
        metrics: ["sessions"],
      });
      if (!active) return;
      if (reportResult.error) {
        setError((current) => current ?? describeSiteWebError(reportResult.error ?? ""));
      }
      const rows = ((reportResult.data as { rows?: AnalyticsRow[] } | null)?.rows ?? []) as
        AnalyticsRow[];
      setSessions(rows.reduce((sum, row) => sum + Number(row.metricValues?.[0]?.value ?? 0), 0));
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const clicks = searchRows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
    const impressions = searchRows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    const weighted = searchRows.reduce(
      (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
      0,
    );
    return { clicks, impressions, position: impressions ? weighted / impressions : 0 };
  }, [searchRows]);

  const value = (input: number | null, formatter: (v: number) => string) =>
    loading ? "…" : input === null ? "—" : formatter(input);

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium">Données Google partiellement indisponibles</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Aujourd'hui</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Chiffres réels des 30 derniers jours ({formatDate(startDate)} → {formatDate(endDate)}).
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Sessions" value={value(sessions, formatNumber)} />
          <Metric label="Clics" value={value(totals.clicks, formatNumber)} />
          <Metric label="Impressions" value={value(totals.impressions, formatNumber)} />
          <Metric
            label="Position moyenne"
            value={value(totals.position || null, (v) => v.toFixed(1).replace(".", ","))}
          />
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
