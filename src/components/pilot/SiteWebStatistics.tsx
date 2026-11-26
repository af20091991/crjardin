import { useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Eye, Users, Zap } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/components/ui/lazy-recharts";
import { Card } from "@/components/ui/card";
import {
  readSavedGa4Property,
  saveGa4Property,
  SITE_WEB_DEFAULT_GA4_PROPERTY_ID,
} from "@/lib/site-web-config";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";
import {
  formatChange,
  parseTopPages,
  parseTotals,
  pickProperty,
  relativeChange,
  statisticsPeriods,
  type AudienceTotals,
  type GaProperty,
  type GaReport,
} from "@/lib/site-web-statistics";

type Point = { date: string; users: number; pageViews: number };
type Page = { path: string; pageViews: number; users: number };
const n = (v?: string) => {
  const value = Number(v);
  return Number.isFinite(value) ? value : 0;
};
const number = (v: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);
const percent = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(v);
const dateLabel = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR");

export function SiteWebStatistics() {
  const [daily, setDaily] = useState<Point[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [totals, setTotals] = useState<AudienceTotals | null>(null);
  const [previousTotals, setPreviousTotals] = useState<AudienceTotals | null>(null);
  const [properties, setProperties] = useState<GaProperty[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(readSavedGa4Property);
  const [period, setPeriod] = useState("");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setTotals(null);
      setPreviousTotals(null);
      setDaily([]);
      setPages([]);
      setCheckedAt(null);
      const { current, previous } = statisticsPeriods();
      setPeriod(`${dateLabel(current.startDate)} → ${dateLabel(current.endDate)}`);
      const list = await listAnalyticsProperties();
      if (!active) return;
      if (list.error) {
        setError(`Google Analytics 4 : ${list.error}`);
        setLoading(false);
        return;
      }
      const available = list.data?.properties ?? [];
      setProperties(available);
      if (!available.length) {
        setError("Aucune propriété Google Analytics 4 accessible avec la connexion actuelle.");
        setLoading(false);
        return;
      }
      const property = pickProperty(available, propertyId, SITE_WEB_DEFAULT_GA4_PROPERTY_ID);
      if (!property) {
        setError(
          "Plusieurs propriétés Google Analytics 4 sont accessibles : choisissez celle du site.",
        );
        setLoading(false);
        return;
      }
      const id = property.name.replace(/^properties\//, "");
      const summaryMetrics = ["totalUsers", "screenPageViews", "engagedSessions", "engagementRate"];
      const [summary, before, trend, topPages] = await Promise.all([
        runAnalyticsReport({ propertyId: id, ...current, dimensions: [], metrics: summaryMetrics }),
        runAnalyticsReport({
          propertyId: id,
          ...previous,
          dimensions: [],
          metrics: summaryMetrics,
        }),
        runAnalyticsReport({
          propertyId: id,
          ...current,
          dimensions: ["date"],
          metrics: ["totalUsers", "screenPageViews"],
        }),
        runAnalyticsReport({
          propertyId: id,
          ...current,
          dimensions: ["pagePath"],
          metrics: ["screenPageViews", "totalUsers"],
        }),
      ]);
      if (!active) return;
      if (summary.error) {
        setError(`Google Analytics 4 : ${summary.error}`);
        setLoading(false);
        return;
      }
      const parsed = parseTotals(summary.data as GaReport);
      if (!parsed) {
        setError("Google Analytics 4 n'a renvoyé aucune donnée pour cette période.");
        setLoading(false);
        return;
      }
      setTotals(parsed);
      if (!before.error) setPreviousTotals(parseTotals(before.data as GaReport));
      if (!trend.error)
        setDaily(
          ((trend.data as GaReport)?.rows ?? []).map((r) => ({
            date: r.dimensionValues?.[0]?.value ?? "",
            users: n(r.metricValues?.[0]?.value),
            pageViews: n(r.metricValues?.[1]?.value),
          })),
        );
      if (!topPages.error) setPages(parseTopPages(topPages.data as GaReport));
      const unavailable = [
        trend.error ? "évolution quotidienne" : null,
        topPages.error ? "pages consultées" : null,
        before.error ? "comparaison avec la période précédente" : null,
      ].filter(Boolean);
      setError(
        unavailable.length
          ? `Certaines vues GA4 sont indisponibles : ${unavailable.join(", ")}.`
          : null,
      );
      setCheckedAt(new Date().toLocaleString("fr-FR"));
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [propertyId]);

  const chooseProperty = (value: string) => {
    saveGa4Property(value);
    setPropertyId(value);
  };
  const summaryAvailable = totals !== null;
  const change = (key: keyof AudienceTotals) =>
    formatChange(relativeChange(totals?.[key] ?? null, previousTotals?.[key] ?? null));

  const chart = useMemo(
    () =>
      daily.map((p) => ({
        ...p,
        label: p.date.length === 8 ? `${p.date.slice(6, 8)}/${p.date.slice(4, 6)}` : p.date,
      })),
    [daily],
  );
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Audience et consultation des pages</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Données Google Analytics 4 sur les 30 derniers jours complets. Cette vue détaille
              l’audience et les contenus consultés, sans répéter les indicateurs de visibilité
              Search Console ni assimiler les visites à des prospects.
            </p>
            {period && (
              <p className="mt-2 text-xs text-muted-foreground">
                Période : {period}
                {checkedAt ? ` · Lecture du ${checkedAt}` : ""}
              </p>
            )}
            {properties.length > 1 && (
              <label className="mt-3 block text-xs text-muted-foreground">
                Propriété GA4{" "}
                <select
                  className="ml-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
                  value={propertyId ?? SITE_WEB_DEFAULT_GA4_PROPERTY_ID}
                  onChange={(e) => chooseProperty(e.target.value)}
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {properties.map((p) => {
                    const id = p.name.replace(/^properties\//, "");
                    return (
                      <option key={id} value={id}>
                        {p.displayName ?? id}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
          </div>
        </div>
      </Card>
      {error && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{error}</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Utilisateurs"
          value={loading ? "…" : !summaryAvailable ? "—" : number(totals!.users)}
          hint={loading ? null : change("users")}
        />
        <Metric
          icon={Eye}
          label="Pages vues"
          value={loading ? "…" : !summaryAvailable ? "—" : number(totals!.pageViews)}
          hint={loading ? null : change("pageViews")}
        />
        <Metric
          icon={Zap}
          label="Sessions avec engagement"
          value={loading ? "…" : !summaryAvailable ? "—" : number(totals!.engagedSessions)}
          hint={loading ? null : change("engagedSessions")}
        />
        <Metric
          icon={BarChart3}
          label="Taux d’engagement"
          value={loading ? "…" : !summaryAvailable ? "—" : percent(totals!.engagementRate)}
          hint={loading ? null : change("engagementRate")}
        />
      </div>
      <Card className="p-5">
        <h3 className="font-serif text-base font-semibold">Évolution quotidienne</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Utilisateurs et pages vues par jour, selon GA4.
        </p>
        <div className="mt-4 h-72">
          {loading ? (
            <Empty>Lecture des données GA4…</Empty>
          ) : !chart.length ? (
            <Empty>Aucune série quotidienne disponible pour cette période.</Empty>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
                <YAxis tick={{ fontSize: 11 }} width={42} />
                <Tooltip
                  formatter={(v: number, key: string) => [
                    number(Number(v)),
                    key === "users" ? "Utilisateurs" : "Pages vues",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  name="Utilisateurs"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  name="Pages vues"
                  stroke="var(--pp-sales)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-serif text-base font-semibold">Pages les plus consultées</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Classement par pages vues ; les utilisateurs par page ne s’additionnent pas nécessairement
          au total du site.
        </p>
        {loading ? (
          <Empty>Lecture des pages…</Empty>
        ) : !pages.length ? (
          <Empty>Aucune donnée de page disponible pour cette période.</Empty>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Page</th>
                  <th className="py-2 pr-4 text-right font-medium">Pages vues</th>
                  <th className="py-2 text-right font-medium">Utilisateurs</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.path} className="border-b last:border-0">
                    <td className="max-w-[420px] truncate py-3 pr-4" title={p.path}>
                      {p.path}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{number(p.pageViews)}</td>
                    <td className="py-3 text-right tabular-nums">{number(p.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Source : Google Analytics 4. Si la lecture échoue, les données restent indisponibles ;
        aucune statistique fictive n’est affichée.
      </p>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string | null;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
function Empty({ children }: { children: string }) {
  return (
    <p className="flex h-full min-h-20 items-center justify-center py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
