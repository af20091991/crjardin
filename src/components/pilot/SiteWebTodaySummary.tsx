import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Metric } from "@/components/pilot/SiteWebMetric";
import {
  listAnalyticsProperties,
  querySearchConsole,
  runAnalyticsReport,
} from "@/lib/site-web-api";

const SITE_URL = "https://www.delagraineaujardin.com/";
const PREFERRED_GA4_PROPERTY_ID = "159443253";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};
type SearchTotals = { clicks: number; impressions: number; position: number };
type Ga4Totals = { sessions: number };
type TrendPoint = { date: string; sessions: number; clicks: number };

function periodDates(daysAgo: number, length: number) {
  const end = new Date();
  end.setDate(end.getDate() - daysAgo);
  const start = new Date(end);
  start.setDate(start.getDate() - (length - 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function computeTotals(rows: SearchRow[]): SearchTotals {
  const clicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
  const impressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
  const weighted = rows.reduce(
    (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
    0,
  );
  return { clicks, impressions, position: impressions ? weighted / impressions : 0 };
}

/**
 * Résumé chiffré de l'onglet "Aujourd'hui" : les métriques clés sur 30 jours,
 * comparées à la période équivalente précédente (comme un vrai tableau de
 * bord de suivi plutôt qu'un simple instantané), plus une courbe de tendance.
 */
export function SiteWebTodaySummary({ onOpenOpportunities }: { onOpenOpportunities: () => void }) {
  const [search, setSearch] = useState<SearchTotals | null>(null);
  const [previousSearch, setPreviousSearch] = useState<SearchTotals | null>(null);
  const [ga4, setGa4] = useState<Ga4Totals | null>(null);
  const [previousGa4, setPreviousGa4] = useState<Ga4Totals | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [topOpportunity, setTopOpportunity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const current = periodDates(1, 30);
    const previous = periodDates(31, 30);

    const load = async () => {
      setLoading(true);

      const [currentSearchResult, previousSearchResult, dailySearchResult, opportunitiesResult] =
        await Promise.all([
          querySearchConsole({
            siteUrl: SITE_URL,
            startDate: current.start,
            endDate: current.end,
          }),
          querySearchConsole({
            siteUrl: SITE_URL,
            startDate: previous.start,
            endDate: previous.end,
          }),
          querySearchConsole({
            siteUrl: SITE_URL,
            startDate: current.start,
            endDate: current.end,
            dimensions: ["date"],
          }),
          querySearchConsole({
            siteUrl: SITE_URL,
            startDate: current.start,
            endDate: current.end,
            dimensions: ["query"],
          }),
        ]);
      if (!active) return;

      if (!currentSearchResult.error)
        setSearch(computeTotals(currentSearchResult.data?.rows ?? []));
      if (!previousSearchResult.error)
        setPreviousSearch(computeTotals(previousSearchResult.data?.rows ?? []));

      const dailyClicks = new Map<string, number>();
      if (!dailySearchResult.error) {
        for (const row of dailySearchResult.data?.rows ?? []) {
          dailyClicks.set(row.keys?.[0] ?? "", Number(row.clicks ?? 0));
        }
      }

      if (!opportunitiesResult.error) {
        const best = (opportunitiesResult.data?.rows ?? [])
          .filter(
            (row) =>
              Number(row.impressions ?? 0) >= 30 &&
              Number(row.position ?? 99) <= 20 &&
              Number(row.ctr ?? 0) < 0.08,
          )
          .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0))[0];
        setTopOpportunity(best?.keys?.[0] ?? null);
      }

      const propertiesResult = await listAnalyticsProperties();
      if (!active) return;
      if (!propertiesResult.error) {
        const properties = propertiesResult.data?.properties ?? [];
        const selected =
          properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ??
          properties[0];
        if (selected) {
          const propertyId = selected.name.replace(/^properties\//, "");
          const [currentReport, previousReport] = await Promise.all([
            runAnalyticsReport({
              propertyId,
              startDate: current.start,
              endDate: current.end,
              dimensions: ["date"],
              metrics: ["sessions"],
            }),
            runAnalyticsReport({
              propertyId,
              startDate: previous.start,
              endDate: previous.end,
              dimensions: ["date"],
              metrics: ["sessions"],
            }),
          ]);
          if (!active) return;

          const extractPoints = (report: typeof currentReport) => {
            const data = report.data as {
              rows?: Array<{
                dimensionValues?: Array<{ value?: string }>;
                metricValues?: Array<{ value?: string }>;
              }>;
            } | null;
            return (data?.rows ?? []).map((row) => ({
              date: row.dimensionValues?.[0]?.value ?? "",
              sessions: Number(row.metricValues?.[0]?.value ?? 0),
            }));
          };

          if (!currentReport.error) {
            const points = extractPoints(currentReport);
            setGa4({ sessions: points.reduce((sum, point) => sum + point.sessions, 0) });
            setTrend(
              points.map((point) => ({
                date: point.date,
                sessions: point.sessions,
                clicks: dailyClicks.get(point.date) ?? 0,
              })),
            );
          }
          if (!previousReport.error) {
            const points = extractPoints(previousReport);
            setPreviousGa4({ sessions: points.reduce((sum, point) => sum + point.sessions, 0) });
          }
        }
      }

      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const positionLabel = useMemo(
    () => (search?.position ? search.position.toFixed(1).replace(".", ",") : "—"),
    [search],
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          30 derniers jours · comparé aux 30 jours précédents
        </p>
        <div className="mt-3 grid gap-5 sm:grid-cols-4">
          <Metric
            label="Sessions (trafic)"
            value={loading ? "…" : formatNumber(ga4?.sessions ?? 0)}
            description="Nombre de visites sur le site sur la période (Google Analytics 4). Une même personne peut générer plusieurs sessions si elle revient à des moments différents."
            trend={!loading ? delta(ga4?.sessions, previousGa4?.sessions) : null}
          />
          <Metric
            label="Clics Google"
            value={loading ? "…" : formatNumber(search?.clicks ?? 0)}
            description="Nombre de fois où quelqu'un a cliqué sur une page du site depuis les résultats de recherche Google (Search Console)."
            trend={!loading ? delta(search?.clicks, previousSearch?.clicks) : null}
          />
          <Metric
            label="Impressions Google"
            value={loading ? "…" : formatNumber(search?.impressions ?? 0)}
            description="Nombre de fois où une page du site est apparue dans les résultats de recherche Google, cliquée ou non."
            trend={!loading ? delta(search?.impressions, previousSearch?.impressions) : null}
          />
          <Metric
            label="Position moyenne"
            value={loading ? "…" : positionLabel}
            description="Position moyenne du site dans les résultats de recherche Google, sur l'ensemble des requêtes où il apparaît (1 = tout en haut de la page). Une baisse du chiffre est une amélioration."
            trend={!loading ? delta(previousSearch?.position, search?.position) : null}
          />
        </div>

        <div className="mt-6 h-48">
          {loading ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chargement…
            </p>
          ) : trend.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aucune donnée disponible sur la période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis />
                <Tooltip labelFormatter={(value) => formatDateLabel(String(value))} />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="hsl(var(--primary))"
                  fill="url(#sessionsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {!loading && topOpportunity && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm">
                Meilleure opportunité du moment : la requête « {topOpportunity} » est déjà bien
                positionnée mais peu cliquée.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenOpportunities}
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary"
            >
              Voir le pipeline d'opportunités
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function delta(current: number | undefined, previous: number | undefined) {
  if (current === undefined || previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatShortDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
