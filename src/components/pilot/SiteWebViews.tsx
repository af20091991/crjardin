import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, FileText, MapPin, Search, Target } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { SiteWebGoogleConnection } from "@/components/pilot/SiteWebGoogleConnection";
import {
  getBusinessProfilePerformance,
  listBusinessProfileAccounts,
  listBusinessProfileLocations,
  querySearchConsole,
} from "@/lib/site-web-api";

type View = "visibility" | "local" | "content" | "actions";

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
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

type BusinessSeriesRow = Record<string, number>;

const SITE_URL = "https://www.delagraineaujardin.com/";
const LOCAL_TERMS = [
  "montpellier",
  "castelnau",
  "lattes",
  "saint-jean-de-védas",
  "saint jean de vedas",
  "jacou",
  "clapiers",
  "le crès",
  "le cres",
  "juvignac",
  "pérols",
  "perols",
];

export function SiteWebViewContent({
  view,
  showConnection = true,
}: {
  view: View;
  showConnection?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showConnection && <SiteWebGoogleConnection />}
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
    const impressions = rows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    const weightedPosition = rows.reduce(
      (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
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
          <Metric label="Impressions" value={loading ? "…" : formatNumber(totals.impressions)} />
          <Metric label="CTR" value={loading ? "…" : formatPercent(totals.ctr)} />
          <Metric
            label="Position moyenne"
            value={
              loading ? "…" : totals.position ? totals.position.toFixed(1).replace(".", ",") : "—"
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
            <DataTable
              headers={["Date", "Position", "Impressions", "Clics", "CTR"]}
              rows={rows.slice(-31).map((row) => [
                formatDateLabel(row.keys?.[0] ?? ""),
                Number(row.position ?? 0)
                  .toFixed(1)
                  .replace(".", ","),
                formatNumber(Number(row.impressions ?? 0)),
                formatNumber(Number(row.clicks ?? 0)),
                formatPercent(Number(row.ctr ?? 0)),
              ])}
            />
          )}
        </div>
      </Card>
    </>
  );
}

function LocalView() {
  const [queryRows, setQueryRows] = useState<SearchRow[]>([]);
  const [dailyRows, setDailyRows] = useState<SearchRow[]>([]);
  const [performance, setPerformance] = useState<BusinessPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [queryResult, dailyResult, accountsResult] = await Promise.all([
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: yearStart(),
          endDate: yesterday(),
          dimensions: ["query"],
        }),
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: yearStart(),
          endDate: yesterday(),
          dimensions: ["date"],
        }),
        listBusinessProfileAccounts(),
      ]);
      if (!active) return;
      if (queryResult.error) setError(queryResult.error);
      setQueryRows(queryResult.data?.rows ?? []);
      if (dailyResult.error) setError((current) => current ?? dailyResult.error ?? null);
      setDailyRows(dailyResult.data?.rows ?? []);

      if (!accountsResult.error) {
        const account = accountsResult.data?.accounts?.[0];
        if (account?.name) {
          const locationsResult = await listBusinessProfileLocations(account.name);
          if (!active) return;
          if (locationsResult.error) {
            setError((current) => current ?? locationsResult.error ?? null);
          } else {
            const location =
              locationsResult.data?.locations?.find((item) =>
                item.websiteUri?.includes("delagraineaujardin.com"),
              ) ?? locationsResult.data?.locations?.[0];
            if (location?.name) {
              const performanceResult = await getBusinessProfilePerformance({
                locationName: location.name,
                startDate: yearStart(),
                endDate: yesterday(),
              });
              if (!active) return;
              if (performanceResult.error) {
                setError((current) => current ?? performanceResult.error ?? null);
              }
              setPerformance((performanceResult.data ?? null) as BusinessPerformance | null);
            }
          }
        }
      } else if (accountsResult.error !== "google_token_unavailable") {
        setError((current) => current ?? accountsResult.error ?? null);
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const localQueries = useMemo(
    () =>
      queryRows
        .filter((row) =>
          LOCAL_TERMS.some((term) => (row.keys?.[0] ?? "").toLowerCase().includes(term)),
        )
        .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0)),
    [queryRows],
  );

  const localTotals = useMemo(() => {
    const clicks = localQueries.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
    const impressions = localQueries.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    const weightedPosition = localQueries.reduce(
      (sum, row) => sum + Number(row.position ?? 0) * Number(row.impressions ?? 0),
      0,
    );
    return {
      clicks,
      impressions,
      ctr: impressions ? clicks / impressions : 0,
      position: impressions ? weightedPosition / impressions : 0,
    };
  }, [localQueries]);

  const searchChart = useMemo(
    () =>
      dailyRows.slice(-31).map((row) => ({
        date: row.keys?.[0] ?? "",
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
      })),
    [dailyRows],
  );

  const businessSeries = useMemo(() => {
    const byDate = new Map<string, BusinessSeriesRow>();
    for (const item of performance?.multiDailyMetricTimeSeries ?? []) {
      const metric = item.metric ?? "";
      for (const point of item.dailyMetricTimeSeries?.[0]?.timeSeries ?? []) {
        const date = point.date;
        if (!date?.year || !date.month || !date.day) continue;
        const key = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
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

  return (
    <>
      <SiteWebGoogleConnection />
      {error && <GoogleDataError message={error} />}
      <Card className="p-5">
        <Header
          icon={MapPin}
          title="SEO local réel"
          description="Search Console + Google Business Profile. Aucune position Maps inventée."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Périmètre : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <Metric label="Clics locaux" value={loading ? "…" : formatNumber(localTotals.clicks)} />
        </Card>
        <Card className="p-5">
          <Metric
            label="Impressions locales"
            value={loading ? "…" : formatNumber(localTotals.impressions)}
          />
        </Card>
        <Card className="p-5">
          <Metric label="CTR local" value={loading ? "…" : formatPercent(localTotals.ctr)} />
        </Card>
        <Card className="p-5">
          <Metric
            label="Position locale"
            value={
              loading
                ? "…"
                : localTotals.position
                  ? localTotals.position.toFixed(1).replace(".", ",")
                  : "—"
            }
          />
        </Card>
      </div>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Requêtes locales réellement observées"
          description="Requêtes Search Console contenant une commune de la zone ciblée. Cela ne mesure pas le classement Google Maps."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : localQueries.length === 0 ? (
            <EmptyState text="Aucune requête locale observée sur la période." />
          ) : (
            <DataTable
              headers={["Requête", "Position", "Impressions", "Clics", "CTR"]}
              rows={localQueries.slice(0, 50).map((row) => [
                row.keys?.[0] ?? "—",
                Number(row.position ?? 0)
                  .toFixed(1)
                  .replace(".", ","),
                formatNumber(Number(row.impressions ?? 0)),
                formatNumber(Number(row.clicks ?? 0)),
                formatPercent(Number(row.ctr ?? 0)),
              ])}
            />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={BarChart3}
          title="Évolution de la visibilité organique locale"
          description="Axe X explicite : date. Données Search Console réelles."
        />
        <div className="mt-4 h-72">
          {loading ? (
            <LoadingState />
          ) : searchChart.length === 0 ? (
            <EmptyState text="Aucune donnée Search Console disponible sur la période." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={searchChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} minTickGap={24} />
                <YAxis />
                <Tooltip labelFormatter={(value) => formatDateLabel(String(value))} />
                <Line type="monotone" dataKey="clicks" name="Clics" dot={false} />
                <Line type="monotone" dataKey="impressions" name="Impressions" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Performance Google Business Profile"
          description="Interactions et visibilité de la fiche Google, issues de l'API officielle."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          <Metric label="Clics site" value={loading ? "…" : formatNumber(businessTotals.website)} />
          <Metric label="Appels" value={loading ? "…" : formatNumber(businessTotals.calls)} />
          <Metric
            label="Itinéraires"
            value={loading ? "…" : formatNumber(businessTotals.directions)}
          />
          <Metric
            label="Impressions"
            value={loading ? "…" : formatNumber(businessTotals.impressions)}
          />
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Évolution Google Business Profile"
          description="Axe X explicite : date. Les impressions regroupent Search et Maps, sans prétendre fournir un rang Maps."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : businessSeries.length === 0 ? (
            <EmptyState text="Aucune donnée Google Business Profile disponible sur la période." />
          ) : (
            <DataTable
              headers={["Date", "Clics site", "Appels", "Itinéraires", "Impressions"]}
              rows={businessSeries
                .slice(-31)
                .map(([date, row]) => [
                  formatDateLabel(date),
                  formatNumber(row.WEBSITE_CLICKS ?? 0),
                  formatNumber(row.CALL_CLICKS ?? 0),
                  formatNumber(row.BUSINESS_DIRECTION_REQUESTS ?? 0),
                  formatNumber(
                    (row.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0) +
                      (row.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) +
                      (row.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) +
                      (row.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0),
                  ),
                ])}
            />
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
        L'inventaire réel des pages et leurs données SEO sera branché lorsque leur source réelle
        sera disponible.
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
        Aucune action automatique n'est calculée sans données consolidées suffisantes.
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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          {headers.map((header) => (
            <th key={header} className="pb-2 text-right first:text-left">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${row[0]}-${rowIndex}`} className="border-t border-border/40">
            {row.map((cell, index) => (
              <td
                key={`${row[0]}-${index}`}
                className="py-3 text-right tabular-nums first:text-left"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
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
    <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p>
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
function formatShortDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}
function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}
