import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, FileSearch, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/pilot/EmptyState";
import {
  listAnalyticsProperties,
  listSearchConsoleSites,
  querySearchConsole,
  runAnalyticsReport,
} from "@/lib/site-web-api";
import {
  pickProperty,
  statisticsPeriods,
  type GaReport,
} from "@/lib/site-web-statistics";
import {
  readSavedGa4Property,
  SITE_WEB_DEFAULT_GA4_PROPERTY_ID,
  SITE_WEB_SITE_URL,
} from "@/lib/site-web-config";

type SortKey =
  | "views"
  | "users"
  | "sessions"
  | "engagementRate"
  | "clicks"
  | "impressions"
  | "ctr"
  | "position";

type PageMetrics = {
  path: string;
  url: string;
  views: number | null;
  users: number | null;
  sessions: number | null;
  engagementRate: number | null;
  avgEngagementSeconds: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
};

const num = (value?: string): number | null => {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const count = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
const pct = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
const decimal = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const seconds = (value: number | null) => {
  if (value === null) return "—";
  const rounded = Math.round(value);
  return rounded >= 60 ? `${Math.floor(rounded / 60)} min ${rounded % 60} s` : `${rounded} s`;
};
const dateLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR");

function normalizedPath(value: string): string {
  try {
    const url = new URL(value, SITE_WEB_SITE_URL);
    return url.pathname.replace(/\/$/, "") || "/";
  } catch {
    return value.split("?")[0].replace(/\/$/, "") || "/";
  }
}
function pageUrl(path: string): string {
  try {
    return new URL(path, SITE_WEB_SITE_URL).toString();
  } catch {
    return path;
  }
}

export function SiteWebPages() {
  const [rows, setRows] = useState<PageMetrics[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [sortDescending, setSortDescending] = useState(true);
  const [selected, setSelected] = useState<PageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [ga4Source, setGa4Source] = useState("Google Analytics 4");
  const [gscSource, setGscSource] = useState("Google Search Console");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setRows([]);
      setSelected(null);
      const { current } = statisticsPeriods();
      setPeriod(`${dateLabel(current.startDate)} → ${dateLabel(current.endDate)}`);
      const [propertyList, sitesList] = await Promise.all([
        listAnalyticsProperties(),
        listSearchConsoleSites(),
      ]);
      if (!active) return;

      const gaProperty = propertyList.data?.properties
        ? pickProperty(
            propertyList.data.properties,
            readSavedGa4Property(),
            SITE_WEB_DEFAULT_GA4_PROPERTY_ID,
          )
        : null;
      const sites = sitesList.data?.siteEntry ?? [];
      const site =
        sites.find(
          (item) =>
            item.siteUrl.replace(/\/$/, "") ===
            SITE_WEB_SITE_URL.replace(/\/$/, ""),
        ) ??
        sites.find((item) => item.siteUrl.includes("delagraineaujardin.com")) ??
        null;
      if (propertyList.error) setGa4Source(`GA4 indisponible : ${propertyList.error}`);
      if (sitesList.error) setGscSource(`Search Console indisponible : ${sitesList.error}`);

      const tasks = await Promise.all([
        gaProperty
          ? runAnalyticsReport({
              propertyId: gaProperty.name.replace(/^properties\//, ""),
              ...current,
              dimensions: ["pagePath"],
              metrics: [
                "screenPageViews",
                "totalUsers",
                "sessions",
                "engagementRate",
                "averageEngagementTime",
              ],
            })
          : Promise.resolve({
              data: null,
              error: propertyList.error ?? "Aucune propriété GA4 accessible.",
            }),
        site
          ? querySearchConsole({
              siteUrl: site.siteUrl,
              ...current,
              dimensions: ["page"],
            })
          : Promise.resolve({
              data: null,
              error:
                sitesList.error ??
                "Aucune propriété Search Console accessible pour le site.",
            }),
      ]);
      if (!active) return;

      const merged = new Map<string, PageMetrics>();
      const gaReport = tasks[0].data as GaReport;
      for (const row of gaReport?.rows ?? []) {
        const path = row.dimensionValues?.[0]?.value || "";
        if (!path) continue;
        const key = normalizedPath(path);
        const values = row.metricValues ?? [];
        const existing = merged.get(key);
        merged.set(key, {
          path: key,
          url: pageUrl(path),
          views: num(values[0]?.value),
          users: num(values[1]?.value),
          sessions: num(values[2]?.value),
          engagementRate: num(values[3]?.value),
          avgEngagementSeconds: num(values[4]?.value),
          clicks: existing?.clicks ?? null,
          impressions: existing?.impressions ?? null,
          ctr: existing?.ctr ?? null,
          position: existing?.position ?? null,
        });
      }
      const searchRows = tasks[1].data?.rows ?? [];
      for (const row of searchRows) {
        const url = row.keys?.[0] ?? "";
        if (!url) continue;
        const key = normalizedPath(url);
        const existing = merged.get(key) ?? {
          path: key,
          url: pageUrl(url),
          views: null,
          users: null,
          sessions: null,
          engagementRate: null,
          avgEngagementSeconds: null,
          clicks: null,
          impressions: null,
          ctr: null,
          position: null,
        };
        merged.set(key, {
          ...existing,
          url: pageUrl(url),
          clicks: num(String(row.clicks)),
          impressions: num(String(row.impressions)),
          ctr: num(String(row.ctr)),
          position: num(String(row.position)),
        });
      }
      setRows([...merged.values()].sort((a, b) => (b.views ?? -1) - (a.views ?? -1)));
      const sourceErrors = [
        tasks[0].error ? `GA4 : ${tasks[0].error}` : null,
        tasks[1].error ? `Search Console : ${tasks[1].error}` : null,
      ].filter(Boolean);
      setError(sourceErrors.length ? sourceErrors.join(" · ") : null);
      setCheckedAt(new Date().toLocaleString("fr-FR"));
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");
    const filtered = query
      ? rows.filter(
          (row) =>
            row.path.toLocaleLowerCase("fr-FR").includes(query) ||
            row.url.toLocaleLowerCase("fr-FR").includes(query),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const left = a[sortKey] ?? (sortDescending ? -Infinity : Infinity);
      const right = b[sortKey] ?? (sortDescending ? -Infinity : Infinity);
      return (Number(left) - Number(right)) * (sortDescending ? -1 : 1);
    });
  }, [rows, search, sortKey, sortDescending]);

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDescending((current) => !current);
    else {
      setSortKey(key);
      setSortDescending(true);
    }
  };
  const sortLabel = (label: string, key: SortKey) => (
    <button type="button" onClick={() => sortBy(key)} className="font-medium hover:text-foreground">
      {label}{sortKey === key ? (sortDescending ? " ↓" : " ↑") : ""}
    </button>
  );

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <FileSearch className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold">Analyse détaillée des pages</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Chaque URL renvoyée par GA4 ou Search Console, y compris les articles de blog,
              sans liste éditoriale codée en dur. Les métriques GA4 décrivent l’audience ;
              Search Console décrit la visibilité dans Google.
            </p>
            {period && (
              <p className="mt-2 text-xs text-muted-foreground">
                Période : {period}
                {checkedAt ? ` · Lecture du ${checkedAt}` : ""}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Audience : {ga4Source}</span>
              <span>Recherche : {gscSource}</span>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card className="p-4">
        <label className="relative block">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une URL ou un article…"
            className="pl-9"
          />
        </label>
        <p className="mt-3 text-xs text-muted-foreground">
          {loading
            ? "Chargement des pages…"
            : `${visibleRows.length} page(s) affichée(s) sur ${rows.length}`}
        </p>
        {loading ? (
          <EmptyState
            title="Chargement des pages"
            description="Lecture des données Google Analytics 4 et Search Console."
          />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            title="Aucune page disponible"
            description="Vérifiez les connexions Google ou modifiez votre recherche. Aucune donnée manquante n’est remplacée par zéro."
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Page / URL</th>
                <th className="py-2 px-3 text-right">{sortLabel("Vues GA4", "views")}</th>
                <th className="py-2 px-3 text-right">{sortLabel("Utilisateurs", "users")}</th>
                <th className="py-2 px-3 text-right">{sortLabel("Sessions", "sessions")}</th>
                <th className="px-3 py-2 text-right">
                  {sortLabel("Engagement", "engagementRate")}
                </th>
                <th className="py-2 px-3 text-right">{sortLabel("Clics Google", "clicks")}</th>
                <th className="py-2 px-3 text-right">{sortLabel("Impressions", "impressions")}</th>
                <th className="py-2 px-3 text-right">{sortLabel("CTR", "ctr")}</th>
                <th className="py-2 pl-3 text-right">{sortLabel("Position", "position")}</th>
              </tr></thead>
              <tbody>{visibleRows.map((row) => (
                <tr key={row.path} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="max-w-[320px] py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="block max-w-full truncate text-left font-medium text-primary hover:underline"
                      title={row.path}
                    >
                      {row.path}
                    </button>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                    >
                      <span className="truncate">{row.url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{count(row.views)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{count(row.users)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{count(row.sessions)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{pct(row.engagementRate)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{count(row.clicks)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{count(row.impressions)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{pct(row.ctr)}</td>
                  <td className="py-3 pl-3 text-right tabular-nums">{decimal(row.position)}</td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-base font-semibold">Détail de la page</h3>
            <p className="mt-1 break-all text-sm text-muted-foreground">{selected.url}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Fermer
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Vues (GA4)", count(selected.views)], ["Utilisateurs (GA4)", count(selected.users)],
            ["Sessions (GA4)", count(selected.sessions)],
            ["Taux d’engagement (GA4)", pct(selected.engagementRate)],
            ["Temps d’engagement moyen (GA4)", seconds(selected.avgEngagementSeconds)],
            ["Clics (Search Console)", count(selected.clicks)],
            ["Impressions (Search Console)", count(selected.impressions)],
            ["CTR (Search Console)", pct(selected.ctr)],
            ["Position moyenne (Search Console)", decimal(selected.position)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Sources : {ga4Source} et {gscSource}. Période : {period}. Les valeurs « — »
          correspondent à des métriques non disponibles pour cette page ou cette source.
        </p>
      </Card>}
      <p className="text-xs text-muted-foreground">
        Sources : Google Analytics 4 et Google Search Console. Les données de chaque source sont
        affichées séparément et ne sont pas additionnées. Les pages présentes dans une seule source
        restent visibles.
      </p>
    </div>
  );
}
