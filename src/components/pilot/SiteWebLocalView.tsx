import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, MapPin, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { friendlyConnectionError } from "@/components/pilot/SiteWebGoogleConnection";
import { SortableDataTable, type SortableColumn } from "@/components/pilot/SiteWebSortableTable";
import {
  getBusinessProfilePerformance,
  listBusinessProfileAccounts,
  listBusinessProfileLocations,
  querySearchConsole,
} from "@/lib/site-web-api";

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

const queryColumns: Array<SortableColumn<SearchRow>> = [
  {
    key: "query",
    label: "Requête",
    align: "left",
    render: (row) => row.keys?.[0] ?? "—",
    sortValue: (row) => row.keys?.[0] ?? "",
  },
  {
    key: "position",
    label: "Position",
    render: (row) => formatPosition(row.position),
    sortValue: (row) => Number(row.position ?? 999),
  },
  {
    key: "impressions",
    label: "Impressions",
    render: (row) => formatNumber(Number(row.impressions ?? 0)),
    sortValue: (row) => Number(row.impressions ?? 0),
  },
  {
    key: "clicks",
    label: "Clics",
    render: (row) => formatNumber(Number(row.clicks ?? 0)),
    sortValue: (row) => Number(row.clicks ?? 0),
  },
  {
    key: "ctr",
    label: "CTR",
    render: (row) => formatPercent(Number(row.ctr ?? 0)),
    sortValue: (row) => Number(row.ctr ?? 0),
  },
];

export function SiteWebLocalView() {
  const [queryRows, setQueryRows] = useState<SearchRow[]>([]);
  const [performance, setPerformance] = useState<BusinessPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setSearchError(null);
      setBusinessError(null);

      const [queryResult, accountsResult] = await Promise.all([
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: yearStart(),
          endDate: yesterday(),
          dimensions: ["query"],
        }),
        listBusinessProfileAccounts(),
      ]);

      if (!active) return;

      setQueryRows(queryResult.data?.rows ?? []);
      if (queryResult.error) setSearchError(queryResult.error);

      if (accountsResult.error) {
        if (accountsResult.error !== "google_token_unavailable") {
          setBusinessError(accountsResult.error);
        }
        setPerformance(null);
        setLoading(false);
        return;
      }

      const account = accountsResult.data?.accounts?.[0];
      if (!account?.name) {
        setBusinessError("no_business_account");
        setPerformance(null);
        setLoading(false);
        return;
      }

      const locationsResult = await listBusinessProfileLocations(account.name);
      if (!active) return;
      if (locationsResult.error) {
        setBusinessError(locationsResult.error);
        setPerformance(null);
        setLoading(false);
        return;
      }

      const location =
        locationsResult.data?.locations?.find((item) =>
          item.websiteUri?.includes("delagraineaujardin.com"),
        ) ?? locationsResult.data?.locations?.[0];

      if (!location?.name) {
        setBusinessError("no_business_location");
        setPerformance(null);
        setLoading(false);
        return;
      }

      const performanceResult = await getBusinessProfilePerformance({
        locationName: location.name,
        startDate: yearStart(),
        endDate: yesterday(),
      });
      if (!active) return;
      if (performanceResult.error) {
        setBusinessError(performanceResult.error);
      }
      setPerformance((performanceResult.data ?? null) as BusinessPerformance | null);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const localQueries = useMemo(
    () =>
      queryRows.filter((row) =>
        LOCAL_TERMS.some((term) => (row.keys?.[0] ?? "").toLowerCase().includes(term)),
      ),
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

  const localShareOfImpressions = useMemo(() => {
    const totalImpressions = queryRows.reduce((sum, row) => sum + Number(row.impressions ?? 0), 0);
    return totalImpressions > 0 ? localTotals.impressions / totalImpressions : null;
  }, [queryRows, localTotals.impressions]);

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

  const hasLocalSearchData = localQueries.length > 0;
  const hasBusinessData = businessSeries.length > 0;

  return (
    <div className="space-y-4">
      {searchError && <SourceError title="Search Console" code={searchError} />}

      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Présence locale"
          description="Uniquement ce qui est spécifique au local : requêtes géolocalisées et fiche Google Business Profile. Le trafic global est dans « Trafic & Recherche »."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Périmètre : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-5">
        <MetricCard
          label="Clics locaux"
          value={loading ? "…" : hasLocalSearchData ? formatNumber(localTotals.clicks) : "—"}
        />
        <MetricCard
          label="Impressions locales"
          value={loading ? "…" : hasLocalSearchData ? formatNumber(localTotals.impressions) : "—"}
        />
        <MetricCard
          label="CTR local"
          value={loading ? "…" : hasLocalSearchData ? formatPercent(localTotals.ctr) : "—"}
        />
        <MetricCard
          label="Position locale"
          value={
            loading
              ? "…"
              : hasLocalSearchData
                ? localTotals.position.toFixed(1).replace(".", ",")
                : "—"
          }
        />
        <MetricCard
          label="Part du trafic total"
          value={
            loading || localShareOfImpressions === null
              ? "…"
              : formatPercent(localShareOfImpressions)
          }
        />
      </div>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Requêtes locales réellement observées"
          description="Requêtes Search Console contenant une commune de la zone ciblée. Ce tableau ne mesure pas le classement Google Maps."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : (
            <SortableDataTable
              columns={queryColumns}
              rows={localQueries}
              getRowKey={(row, index) => `${row.keys?.[0] ?? "row"}-${index}`}
              searchField={(row) => row.keys?.[0] ?? ""}
              searchPlaceholder="Rechercher une requête…"
              minImpressionsField={(row) => Number(row.impressions ?? 0)}
              defaultSortKey="impressions"
              defaultSortDirection="desc"
            />
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={BarChart3}
          title="Performance Google Business Profile"
          description="Interactions et visibilité de la fiche Google, issues de l'API officielle."
        />
        {businessError && <SourceError title="Business Profile" code={businessError} compact />}
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          <Metric
            label="Clics site"
            value={loading ? "…" : hasBusinessData ? formatNumber(businessTotals.website) : "—"}
          />
          <Metric
            label="Appels"
            value={loading ? "…" : hasBusinessData ? formatNumber(businessTotals.calls) : "—"}
          />
          <Metric
            label="Itinéraires"
            value={loading ? "…" : hasBusinessData ? formatNumber(businessTotals.directions) : "—"}
          />
          <Metric
            label="Impressions"
            value={loading ? "…" : hasBusinessData ? formatNumber(businessTotals.impressions) : "—"}
          />
        </div>
      </Card>
    </div>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <Metric label={label} value={value} />
    </Card>
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

function SourceError({
  title,
  code,
  compact = false,
}: {
  title: string;
  code: string;
  compact?: boolean;
}) {
  const knownMessages: Record<string, string> = {
    no_business_account: "Aucun compte Google Business Profile accessible avec ce compte Google.",
    no_business_location: "Aucune fiche établissement Google Business Profile trouvée.",
  };
  const message = knownMessages[code] ?? friendlyConnectionError(code) ?? code;
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive ${
        compact ? "mt-4 p-3" : "p-4"
      }`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-medium">{title} indisponible</p>
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatPosition(value: number | undefined) {
  if (value === undefined || !Number.isFinite(Number(value)) || Number(value) <= 0) return "—";
  return Number(value).toFixed(1).replace(".", ",");
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
