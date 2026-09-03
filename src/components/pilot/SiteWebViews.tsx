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
  listSearchConsoleSites,
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
type BusinessLocation = {
  name: string;
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  websiteUri?: string;
};

type SearchConsoleSite = {
  siteUrl: string;
  permissionLevel: string;
};

const FALLBACK_SITE_URL = "https://www.delagraineaujardin.com/";
const SITE_DOMAIN = "delagraineaujardin.com";
const LOCAL_QUERY_TERMS = [
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
  const [siteUrl, setSiteUrl] = useState(FALLBACK_SITE_URL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);

      const sitesResult = await listSearchConsoleSites();
      const sites = sitesResult.data?.siteEntry ?? [];
      const selectedSite = selectSearchConsoleSite(sites);
      const resolvedSiteUrl = selectedSite?.siteUrl ?? FALLBACK_SITE_URL;
      if (active) setSiteUrl(resolvedSiteUrl);

      if (sitesResult.error && sites.length === 0) {
        if (active) {
          setError(sitesResult.error);
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const { data, error: apiError } = await querySearchConsole({
        siteUrl: resolvedSiteUrl,
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
          <Metric label="Impressions" value={loading ? "…" : formatNumber(totals.impressions)} />
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
          Search Console · {siteUrl} · {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
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
                Number(row.position ?? 0).toFixed(1).replace(".", ","),
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
  const [performance, setPerformance] = useState<BusinessPerformance | null>(null);
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [localQueries, setLocalQueries] = useState<SearchRow[]>([]);
  const [siteUrl, setSiteUrl] = useState(FALLBACK_SITE_URL);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setSearchError(null);
      setBusinessError(null);

      const sitesResult = await listSearchConsoleSites();
      const sites = sitesResult.data?.siteEntry ?? [];
      const selectedSite = selectSearchConsoleSite(sites);
      const resolvedSiteUrl = selectedSite?.siteUrl ?? FALLBACK_SITE_URL;
      if (active) setSiteUrl(resolvedSiteUrl);

      const searchResult =
        sitesResult.error && sites.length === 0
          ? { data: null, error: sitesResult.error }
          : await querySearchConsole({
              siteUrl: resolvedSiteUrl,
              startDate: yearStart(),
              endDate: yesterday(),
              dimensions: ["query"],
            });

      if (!active) return;
      if (searchResult.error) setSearchError(searchResult.error);
      const queries = (searchResult.data?.rows ?? []).filter((row) => {
        const query = String(row.keys?.[0] ?? "").toLocaleLowerCase("fr-FR");
        return LOCAL_QUERY_TERMS.some((term) => query.includes(term));
      });
      setLocalQueries(queries);

      const accountsResult = await listBusinessProfileAccounts();
      if (!active) return;
      if (accountsResult.error) {
        setBusinessError(accountsResult.error);
        setLoading(false);
        return;
      }

      const account = accountsResult.data?.accounts?.[0];
      if (!account?.name) {
        setBusinessError("Aucun compte Google Business Profile disponible.");
        setLoading(false);
        return;
      }

      const locationsResult = await listBusinessProfileLocations(account.name);
      if (!active) return;
      if (locationsResult.error) {
        setBusinessError(locationsResult.error);
        setLoading(false);
        return;
      }

      const selected =
        (locationsResult.data?.locations as BusinessLocation[] | undefined)?.find((item) =>
          item.websiteUri?.includes(SITE_DOMAIN),
        ) ?? (locationsResult.data?.locations?.[0] as BusinessLocation | undefined);
      setLocation(selected ?? null);

      if (!selected?.name) {
        setBusinessError("Aucune fiche Google Business Profile correspondant au site n'a été trouvée.");
        setLoading(false);
        return;
      }

      const performanceResult = await getBusinessProfilePerformance({
        locationName: selected.name,
        startDate: yearStart(),
        endDate: yesterday(),
      });
      if (!active) return;
      if (performanceResult.error) setBusinessError(performanceResult.error);
      setPerformance((performanceResult.data ?? null) as BusinessPerformance | null);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

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

  const localQueryTotals = useMemo(
    () =>
      localQueries.reduce(
        (acc, row) => {
          acc.clicks += Number(row.clicks ?? 0);
          acc.impressions += Number(row.impressions ?? 0);
          return acc;
        },
        { clicks: 0, impressions: 0 },
      ),
    [localQueries],
  );

  const address = location?.storefrontAddress;
  const locationLabel = [address?.postalCode, address?.locality].filter(Boolean).join(" ");

  return (
    <>
      {searchError && <GoogleDataError message={`Search Console : ${searchError}`} />}
      {businessError && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-medium">Google Business Profile indisponible</p>
              <p className="mt-1 text-xs text-muted-foreground">{businessError}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Les données Search Console restent affichées indépendamment.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Fiche établissement"
          description="Informations lues directement depuis Google Business Profile."
        />
        {loading ? (
          <LoadingState />
        ) : location ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nom</p>
              <p className="mt-1 text-sm font-medium">{location.title || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adresse</p>
              <p className="mt-1 text-sm font-medium">
                {address?.addressLines?.join(", ") || locationLabel || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Site</p>
              <p className="mt-1 break-all text-sm font-medium">{location.websiteUri || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</p>
              <p className="mt-1 text-sm font-medium">Google Business Profile</p>
            </div>
          </div>
        ) : (
          <EmptyState text="Fiche Google Business Profile indisponible." />
        )}
      </Card>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Requêtes à intention locale"
          description="Search Console · requêtes contenant une commune explicitement ciblée. Ce tableau ne mesure pas le classement Google Maps."
        />
        <p className="mt-2 text-xs text-muted-foreground">Propriété : {siteUrl}</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Metric label="Requêtes locales" value={loading ? "…" : formatNumber(localQueries.length)} />
          <Metric label="Impressions locales" value={loading ? "…" : formatNumber(localQueryTotals.impressions)} />
        </div>
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : localQueries.length === 0 ? (
            <EmptyState text="Aucune requête contenant une commune ciblée n'est disponible sur la période." />
          ) : (
            <DataTable
              headers={["Requête", "Position", "Impressions", "Clics", "CTR"]}
              rows={[...localQueries]
                .sort((a, b) => Number(a.position ?? 999) - Number(b.position ?? 999))
                .slice(0, 50)
                .map((row) => [
                  row.keys?.[0] ?? "—",
                  Number(row.position ?? 0).toFixed(1).replace(".", ","),
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
          title="Performance locale Google Business Profile"
          description="Données réelles Google Business Profile. Leur absence ne bloque pas les données Search Console."
        />
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          <Metric label="Clics site" value={loading ? "…" : formatNumber(businessTotals.website)} />
          <Metric label="Appels" value={loading ? "…" : formatNumber(businessTotals.calls)} />
          <Metric label="Itinéraires" value={loading ? "…" : formatNumber(businessTotals.directions)} />
          <Metric label="Impressions" value={loading ? "…" : formatNumber(businessTotals.impressions)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Google Business Profile · {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}
        </p>
      </Card>

      <Card className="p-5">
        <Header
          icon={MapPin}
          title="Évolution de la visibilité de la fiche"
          description="Axe temporel explicite : chaque ligne correspond à une date Google Business Profile."
        />
        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <LoadingState />
          ) : businessSeries.length === 0 ? (
            <EmptyState text="Aucune donnée Google Business Profile disponible sur la période." />
          ) : (
            <DataTable
              headers={["Date", "Clics site", "Appels", "Itinéraires", "Impressions"]}
              rows={businessSeries.slice(-31).map(([date, row]) => [
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
        Le raccordement des statistiques est opérationnel. L'inventaire réel des pages et leurs données SEO sera branché dans cette vue.
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
        Aucune action automatique n'est encore calculée : cette étape attend les données consolidées Search Console, Analytics 4 et Business Profile.
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
          <p className="text-sm font-medium">Données Search Console indisponibles</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    </Card>
  );
}

function LoadingState() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function selectSearchConsoleSite(sites: SearchConsoleSite[]) {
  return (
    sites.find((site) => site.siteUrl.includes(SITE_DOMAIN) && !site.siteUrl.startsWith("sc-domain:")) ??
    sites.find((site) => site.siteUrl.includes(SITE_DOMAIN)) ??
    sites[0]
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
