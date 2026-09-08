import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, MapPin, Search, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { friendlyConnectionError } from "@/components/pilot/SiteWebGoogleConnection";
import { Metric } from "@/components/pilot/SiteWebMetric";
import { EmptyState } from "@/components/pilot/EmptyState";
import { PilotFlexChart } from "@/components/pilot/PilotFlexChart";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";
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
const FAVORITES_STORAGE_KEY = "site-web:local-favoris";
const TOP_QUERIES_LIMIT = 15;
const FAVORITES_PICKER_LIMIT = 40;

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

/** Une requête bien positionnée mais peu cliquée est un potentiel à saisir (même règle que l'onglet Actions). */
function isOpportunity(row: SearchRow) {
  return (
    Number(row.impressions ?? 0) >= 30 &&
    Number(row.position ?? 99) <= 20 &&
    Number(row.ctr ?? 0) < 0.08
  );
}

/** Suivi des mots-clés favoris : persisté localement, propre à cet appareil/navigateur. */
function useFavoriteKeywords() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      // Pas de favoris sauvegardés ou stockage indisponible : on repart à vide.
    }
  }, []);

  const toggle = (keyword: string) => {
    setFavorites((current) => {
      const exists = current.includes(keyword);
      const next = exists ? current.filter((item) => item !== keyword) : [...current, keyword];
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Préférence d'affichage uniquement : une erreur de stockage n'est pas bloquante.
      }
      return next;
    });
  };

  return { favorites, toggle };
}

export function SiteWebLocalView() {
  const [queryRows, setQueryRows] = useState<SearchRow[]>([]);
  const [performance, setPerformance] = useState<BusinessPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [minImpressions, setMinImpressions] = useState(0);

  const { favorites, toggle: toggleFavorite } = useFavoriteKeywords();
  const [favoriteRows, setFavoriteRows] = useState<SearchRow[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

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

  // Suivi individuel des mots-clés favoris : on ne va chercher le détail
  // jour par jour que si au moins un favori a été ajouté, pour ne pas
  // alourdir la page inutilement.
  useEffect(() => {
    if (favorites.length === 0) {
      setFavoriteRows([]);
      return;
    }
    let active = true;
    const load = async () => {
      setFavoriteLoading(true);
      setFavoriteError(null);
      const result = await querySearchConsole({
        siteUrl: SITE_URL,
        startDate: yearStart(),
        endDate: yesterday(),
        dimensions: ["date", "query"],
      });
      if (!active) return;
      if (result.error) setFavoriteError(result.error);
      const favoriteSet = new Set(favorites.map((item) => item.toLowerCase()));
      const filtered = (result.data?.rows ?? []).filter((row) =>
        favoriteSet.has((row.keys?.[1] ?? "").toLowerCase()),
      );
      setFavoriteRows(filtered);
      setFavoriteLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [favorites]);

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

  const filteredLocalQueries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return localQueries
      .filter((row) => Number(row.impressions ?? 0) >= minImpressions)
      .filter((row) => !needle || (row.keys?.[0] ?? "").toLowerCase().includes(needle))
      .sort((a, b) => Number(b.impressions ?? 0) - Number(a.impressions ?? 0));
  }, [localQueries, search, minImpressions]);

  const localQueriesDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "requetes-locales",
        label: "Top requêtes locales (impressions et clics)",
        unit: "nombre",
        categoryLabel: "Requête",
        series: [
          { key: "impressions", label: "Impressions", color: PP_COLORS.primary },
          { key: "clicks", label: "Clics", color: PP_COLORS.sales },
        ],
        rows: filteredLocalQueries.slice(0, TOP_QUERIES_LIMIT).map((row) => ({
          name: truncateLabel(row.keys?.[0] ?? "—"),
          impressions: Number(row.impressions ?? 0),
          clicks: Number(row.clicks ?? 0),
        })),
        note: `${filteredLocalQueries.length} requête(s) locale(s) correspondent au filtre, les ${Math.min(TOP_QUERIES_LIMIT, filteredLocalQueries.length)} premières sont affichées.`,
      },
    ],
    [filteredLocalQueries],
  );

  const favoriteDatasets = useMemo<FlexDataset[]>(() => {
    const byDate = new Map<string, Record<string, number>>();
    for (const row of favoriteRows) {
      const date = row.keys?.[0] ?? "";
      const query = row.keys?.[1] ?? "";
      if (!date || !query) continue;
      const entry = byDate.get(date) ?? {};
      entry[`impressions:${query}`] = Number(row.impressions ?? 0);
      entry[`clicks:${query}`] = Number(row.clicks ?? 0);
      entry[`position:${query}`] = Number(row.position ?? 0);
      byDate.set(date, entry);
    }
    const dates = Array.from(byDate.keys()).sort();

    const buildDataset = (
      id: string,
      label: string,
      metric: "impressions" | "clicks" | "position",
      unit: FlexDataset["unit"],
    ): FlexDataset => ({
      id,
      label,
      unit,
      categoryLabel: "Date",
      series: favorites.map((keyword, index) => ({
        key: `${metric}:${keyword}`,
        label: keyword,
        color: PP_SERIES[index % PP_SERIES.length],
      })),
      rows: dates.map((date) => {
        const entry = byDate.get(date) ?? {};
        const row: Record<string, string | number> = { name: formatShortDate(date) };
        for (const keyword of favorites) {
          row[`${metric}:${keyword}`] = entry[`${metric}:${keyword}`] ?? 0;
        }
        return row;
      }),
      note: "Données réelles Search Console, un point par jour et par mot-clé suivi.",
    });

    return [
      buildDataset("favoris-impressions", "Impressions par mot-clé suivi", "impressions", "nombre"),
      buildDataset("favoris-clics", "Clics par mot-clé suivi", "clicks", "nombre"),
      buildDataset("favoris-position", "Position moyenne par mot-clé suivi", "position", "nombre"),
    ];
  }, [favoriteRows, favorites]);

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

  const businessDatasets = useMemo<FlexDataset[]>(
    () => [
      {
        id: "business-interactions",
        label: "Interactions (clics site, appels, itinéraires)",
        unit: "nombre",
        categoryLabel: "Date",
        series: [
          { key: "website", label: "Clics site", color: PP_COLORS.primary },
          { key: "calls", label: "Appels", color: PP_COLORS.sales },
          { key: "directions", label: "Itinéraires", color: PP_COLORS.mid },
        ],
        rows: businessSeries.map(([date, row]) => ({
          name: formatShortDate(date),
          website: row.WEBSITE_CLICKS ?? 0,
          calls: row.CALL_CLICKS ?? 0,
          directions: row.BUSINESS_DIRECTION_REQUESTS ?? 0,
        })),
        note: "Données réelles Google Business Profile.",
      },
      {
        id: "business-impressions",
        label: "Impressions de la fiche (Maps + Recherche)",
        unit: "nombre",
        categoryLabel: "Date",
        series: [{ key: "impressions", label: "Impressions", color: PP_COLORS.primary }],
        rows: businessSeries.map(([date, row]) => ({
          name: formatShortDate(date),
          impressions:
            (row.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0) +
            (row.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) +
            (row.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0) +
            (row.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0),
        })),
        note: "Données réelles Google Business Profile.",
      },
    ],
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
          description="Nombre de clics obtenus sur des requêtes Google contenant le nom d'une commune de la zone ciblée (Montpellier, Castelnau, Lattes…)."
        />
        <MetricCard
          label="Impressions locales"
          value={loading ? "…" : hasLocalSearchData ? formatNumber(localTotals.impressions) : "—"}
          description="Nombre de fois où le site est apparu dans Google pour une requête contenant le nom d'une commune de la zone ciblée."
        />
        <MetricCard
          label="CTR local"
          value={loading ? "…" : hasLocalSearchData ? formatPercent(localTotals.ctr) : "—"}
          description="Part des impressions locales ayant donné lieu à un clic (clics locaux ÷ impressions locales)."
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
          description="Position moyenne du site dans Google, calculée uniquement sur les requêtes contenant une commune de la zone ciblée."
        />
        <MetricCard
          label="Part du trafic total"
          value={
            loading || localShareOfImpressions === null
              ? "…"
              : formatPercent(localShareOfImpressions)
          }
          description="Part des impressions locales par rapport à l'ensemble des impressions Google du site, toutes requêtes confondues."
        />
      </div>

      <Card className="p-5">
        <Header
          icon={Search}
          title="Requêtes locales réellement observées"
          description="Requêtes Search Console contenant une commune de la zone ciblée. Cliquez sur l'étoile d'une requête pour la suivre individuellement plus bas."
        />
        <div className="mt-4">
          {loading ? (
            <LoadingState />
          ) : !hasLocalSearchData ? (
            <EmptyState
              icon={Search}
              title="Aucune requête locale observée sur la période."
              compact
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une requête…"
                  className="h-8 max-w-xs text-sm"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Impressions min.
                  <Input
                    type="number"
                    min={0}
                    value={minImpressions}
                    onChange={(event) => setMinImpressions(Number(event.target.value) || 0)}
                    className="h-8 w-20 text-sm"
                  />
                </label>
              </div>

              {filteredLocalQueries.some(isOpportunity) && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Requêtes bien
                  positionnées mais peu cliquées — à optimiser en priorité.
                </p>
              )}

              <div className="mt-4">
                {filteredLocalQueries.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="Aucune requête ne correspond à ce filtre."
                    compact
                  />
                ) : (
                  <PilotFlexChart
                    title="Top requêtes locales"
                    subtitle="Choisissez le type de graphique le plus lisible pour vous"
                    datasets={localQueriesDatasets}
                    storageKey="site-web:local-requetes"
                    defaultType="barres_h"
                  />
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {filteredLocalQueries.slice(0, FAVORITES_PICKER_LIMIT).map((row, index) => {
                  const keyword = row.keys?.[0] ?? "";
                  const isFavorite = favorites.some(
                    (item) => item.toLowerCase() === keyword.toLowerCase(),
                  );
                  return (
                    <button
                      key={`${keyword}-${index}`}
                      type="button"
                      onClick={() => toggleFavorite(keyword)}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        isFavorite
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{keyword}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatNumber(Number(row.impressions ?? 0))} impr. ·{" "}
                        {formatNumber(Number(row.clicks ?? 0))} clics · pos.{" "}
                        {formatPosition(row.position)}
                      </span>
                      <Star
                        className={`h-4 w-4 shrink-0 ${isFavorite ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    </button>
                  );
                })}
              </div>
              {filteredLocalQueries.length > FAVORITES_PICKER_LIMIT && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {filteredLocalQueries.length - FAVORITES_PICKER_LIMIT} autre(s) requête(s)
                  correspondent au filtre — affinez la recherche pour les faire apparaître ici et
                  les ajouter en favori.
                </p>
              )}
            </>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <Header
          icon={Star}
          title="Mots-clés suivis"
          description="Évolution jour par jour des requêtes marquées en favori ci-dessus."
        />
        {favoriteError && <SourceError title="Search Console" code={favoriteError} compact />}
        <div className="mt-4">
          {favorites.length === 0 ? (
            <EmptyState
              icon={Star}
              title="Aucun mot-clé suivi pour l'instant"
              description="Cliquez sur l'étoile d'une requête ci-dessus pour commencer."
              compact
            />
          ) : favoriteLoading ? (
            <LoadingState />
          ) : (
            <PilotFlexChart
              title="Suivi des mots-clés favoris"
              subtitle="Un point par jour et par mot-clé suivi"
              datasets={favoriteDatasets}
              storageKey="site-web:local-favoris-chart"
              defaultType="courbe"
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
        <div className="mt-5">
          {loading ? (
            <LoadingState />
          ) : !hasBusinessData ? null : (
            <PilotFlexChart
              title="Évolution de la fiche Google Business Profile"
              subtitle="Choisissez le type de graphique le plus lisible pour vous"
              datasets={businessDatasets}
              storageKey="site-web:local-business"
              defaultType="courbe"
            />
          )}
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

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <Card className="p-5">
      <Metric label={label} value={value} description={description} />
    </Card>
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

function truncateLabel(value: string, maxLength = 28) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
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

function formatShortDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(parsed);
}

function yearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
