import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  FileText,
  MapPin,
  Search,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import {
  getBusinessProfilePerformance,
  listBusinessProfileAccounts,
  listBusinessProfileLocations,
  querySearchConsole,
  runAnalyticsReport,
} from "@/lib/site-web-api";

type View = "visibility" | "local" | "content" | "actions";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type AnalyticsReport = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

type BusinessMetric = {
  metric?: string;
  dailyMetricTimeSeries?: Array<{
    timeSeries?: Array<{
      date?: { year?: number; month?: number; day?: number };
      value?: number;
    }>;
  }>;
};

type BusinessPerformance = {
  multiDailyMetricTimeSeries?: BusinessMetric[];
};

const SITE_URL = "https://www.delagraineaujardin.com/";
const GA4_PROPERTY_ID = "159443253";

export function SiteWebViewContent({ view }: { view: View }) {
  return (
    <div className="space-y-4">
      <SiteWebGoogleConnection />
      {view === "visibility" && <VisibilityView />}
      {view === "local" && <LocalView />}
      {view === "content" && <ContentView />}
      {view === "actions" && <ActionsView />}
    </div>
  );
}

function VisibilityView() {
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error: apiError } = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: yearStart(),
        endDate: yesterday(),
      });

      if (!active) return;
      if (apiError) setError(apiError);
      setRows(data?.rows ?? []);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    const clicks = rows.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
    const impressions = rows.reduce(
      (sum, row) => sum + Number(row.impressions ?? 0),
      0,
    );
    const weightedPosition = rows.reduce(
      (sum, row) =>
        sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
      0,
    );

    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions ? weightedPosition / impressions : 0,
    };
  }, [rows]);

  return (
    <>
      {error && <GoogleDataError message={error} />}
      <Card className="p-5">
        <div className="grid gap-5 sm:grid-cols-4">
          <Metric label="Clics" value={loading ? "…" : formatNumber(totals.clicks)} />
          <Metric
            label="Impressions"
            value={loading ? "…" : formatNumber(totals.impressions)}
          />
          <Metric label="CTR" value={loading ? "…" : formatPercent(totals.ctr)} />
          <Metric
            label="Position moyenne"
            value={
              loading
                ? "…"
                : totals.position
                  ? totals.position.toFixed(1).replace(".", ",")
                  : "—"
            }
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Search Console · {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Évolution de la visibilité"
          description="Données réelles Search Console, agrégées par jour."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState text="Aucune donnée Search Console disponible sur la période." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Position</th>
                  <th className="pb-2 text-right">Impressions</th>
                  <th className="pb-2 text-right">Clics</th>
                  <th className="pb-2 text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-31).map((row) => {
                  const date = row.keys?.[0] ?? "";
                  return (
                    <tr key={date} className="border-t border-border/40">
                      <td className="py-3">{formatDateLabel(date)}</td>
                      <td className="py-3 text-right tabular-nums">
                        {Number(row.position ?? 0).toFixed(1).replace(".", ",")}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(Number(row.impressions ?? 0))}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(Number(row.clicks ?? 0))}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatPercent(Number(row.ctr ?? 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}

function LocalView() {
  const [performance, setPerformance] = useState<BusinessPerformance | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const [analyticsResult, accounts] = await Promise.all([
        runAnalyticsReport({
          propertyId: GA4_PROPERTY_ID,
          dateRange: {
            startDate: yearStart(),
            endDate: yesterday(),
          },
          dimensions: ["date"],
          metrics: ["sessions", "screenPageViews"],
        }),
        listBusinessProfileAccounts(),
      ]);

      if (!active) return;
      if (analyticsResult.error) setError(analyticsResult.error);
      setAnalytics((analyticsResult.data ?? null) as AnalyticsReport | null);

      if (accounts.error) {
        setError(accounts.error);
        setLoading(false);
        return;
      }

      const account = accounts.data?.accounts?.[0];
      if (!account?.name) {
        setLoading(false);
        return;
      }

      const locations = await listBusinessProfileLocations(account.name);
      if (!active) return;
      if (locations.error) {
        setError(locations.error);
        setLoading(false);
        return;
      }

      const location =
        locations.data?.locations?.find((item) =>
          item.websiteUri?.includes("delagraineaujardin.com"),
        ) ?? locations.data?.locations?.[0];

      if (!location?.name) {
        setLoading(false);
        return;
      }

      const result = await getBusinessProfilePerformance({
        locationName: location.name,
        startDate: yearStart(),
        endDate: yesterday(),
      });

      if (!active) return;
      if (result.error) setError(result.error);
      setPerformance((result.data ?? null) as BusinessPerformance | null);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const analyticsSeries = useMemo(() => {
    return (analytics?.rows ?? [])
      .map((row) => ({
        date: row.dimensionValues?.[0]?.value ?? "",
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
        pageViews: Number(row.metricValues?.[1]?.value ?? 0),
      }))
      .filter((row) => row.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [analytics]);

  const businessSeries = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();

    for (const item of performance?.multiDailyMetricTimeSeries ?? []) {
      const metric = item.metric ?? "";
      for (const point of item.dailyMetricTimeSeries?.[0]?.timeSeries ?? []) {
        const date = point.date;
        if (!date?.year || !date.month || !date.day) continue;

        const key = `${date.year}-${String(date.month).padStart(2, "0")}-${String(
          date.day,
        ).padStart(2, "0")}`;
        const row = byDate.get(key) ?? {};
        row[metric] = Number(point.value ?? 0);
        byDate.set(key, row);
      }
    }

    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [performance]);

  const businessTotals = useMemo(
    () =>
      businessSeries.reduce(
        (acc, [, row]) => {
          acc.website += row.WEBSITE_CLICKS ?? 0;
          acc.calls += row.CALL_CLICKS ?? 0;
          acc.directions += row.BUSINESS_DIRECTION_REQUESTS ?? 0;
          acc.impressions +=
            (row.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0) +
            (row.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) +
            (row.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) +
            (row.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0);
          return acc;
        },
        { website: 0, calls: 0, directions: 0, impressions: 0 },
      ),
    [businessSeries],
  );

  const analyticsTotals = useMemo(
    () =>
      analyticsSeries.reduce(
        (acc, row) => {
          acc.sessions += row.sessions;
          acc.pageViews += row.pageViews;
          return acc;
        },
        { sessions: 0, pageViews: 0 },
      ),
    [analyticsSeries],
  );

  return (
    <>
      {error && <GoogleDataError message={error} />}

      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Performance locale"
          description="Google Business Profile · données réelles de la fiche établissement."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          <Metric
            label="Clics site"
            value={loading ? "…" : formatNumber(businessTotals.website)}
          />
          <Metric
            label="Appels"
            value={loading ? "…" : formatNumber(businessTotals.calls)}
          />
          <Metric
            label="Itinéraires"
            value={loading ? "…" : formatNumber(businessTotals.directions)}
          />
          <Metric
            label="Impressions"
            value={loading ? "…" : formatNumber(businessTotals.impressions)}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Google Business Profile · {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>

      <Card className="p-5">
        <Header
          icon={BarChart3}
          title="Trafic du site"
          description="Google Analytics 4 · données réelles, avec axe temporel explicite."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Metric
            label="Sessions"
            value={loading ? "…" : formatNumber(analyticsTotals.sessions)}
          />
          <Metric
            label="Pages vues"
            value={loading ? "…" : formatNumber(analyticsTotals.pageViews)}
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : analyticsSeries.length === 0 ? (
            <EmptyState text="Aucune donnée Google Analytics 4 disponible sur la période." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Sessions</th>
                  <th className="pb-2 text-right">Pages vues</th>
                </tr>
              </thead>
              <tbody>
                {analyticsSeries.slice(-31).map((row) => (
                  <tr key={row.date} className="border-t border-border/40">
                    <td className="py-3">{formatDateLabel(row.date)}</td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.sessions)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.pageViews)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={BarChart3}
          title="Évolution de la visibilité locale"
          description="Google Business Profile · chaque ligne correspond à une date réelle."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : businessSeries.length === 0 ? (
            <EmptyState text="Aucune donnée Google Business Profile disponible sur la période." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2 text-right">Clics site</th>
                  <th className="pb-2 text-right">Appels</th>
                  <th className="pb-2 text-right">Itinéraires</th>
                  <th className="pb-2 text-right">Impressions</th>
                </tr>
              </thead>
              <tbody>
                {businessSeries.slice(-31).map(([date, row]) => (
                  <tr key={date} className="border-t border-border/40">
                    <td className="py-3">{formatDateLabel(date)}</td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.WEBSITE_CLICKS ?? 0)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.CALL_CLICKS ?? 0)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(row.BUSINESS_DIRECTION_REQUESTS ?? 0)}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {formatNumber(
                        (row.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0) +
                          (row.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) +
                          (row.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) +
                          (row.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </>
  );
}

function ContentView() {
  return (
    <Card className="p-5">
      <Header
        icon={FileText}
        title="Contenus"
        description="Le suivi éditorial reste séparé des statistiques Google."
      />
      <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Le raccordement des statistiques est opérationnel. L'inventaire réel des pages et
        leurs données SEO sera branché dans cette vue.
      </div>
    </Card>
  );
}

function ActionsView() {
  return (
    <Card className="p-5">
      <Header
        icon={Target}
        title="Actions"
        description="Les recommandations seront calculées à partir des données Google réelles."
      />
      <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
        Aucune action automatique n'est encore calculée : cette étape attend les données
        consolidées Search Console, Analytics 4 et Business Profile.
      </div>
    </Card>
  );
}

function Header({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted/50 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-serif text-lg font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
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

function GoogleDataError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-medium">Données Google indisponibles</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      Chargement des données Google…
    </p>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
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
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
