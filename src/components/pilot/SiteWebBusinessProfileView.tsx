import { useEffect, useMemo, useState } from "react";
import { AlertCircle, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  getBusinessProfilePerformance,
  listBusinessProfileAccounts,
  listBusinessProfileLocations,
} from "@/lib/site-web-api";

type DailyMetric = {
  metric?: string;
  timeSeries?: { datedValues?: Array<{ date?: { year?: number; month?: number; day?: number }; value?: string }> };
};

type PerformanceResponse = { multiDailyMetricTimeSeries?: DailyMetric[] };
type Location = { name: string; title?: string; websiteUri?: string };

type Day = { date: string; website: number; calls: number; directions: number; impressions: number };

export function SiteWebBusinessProfileView() {
  const [days, setDays] = useState<Day[]>([]);
  const [locationTitle, setLocationTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const accounts = await listBusinessProfileAccounts();
      if (accounts.error) {
        if (active) { setError(accounts.error); setLoading(false); }
        return;
      }
      const account = accounts.data?.accounts?.[0];
      if (!account?.name) {
        if (active) { setError("Aucun compte Google Business Profile accessible."); setLoading(false); }
        return;
      }
      const locations = await listBusinessProfileLocations(account.name);
      if (locations.error) {
        if (active) { setError(locations.error); setLoading(false); }
        return;
      }
      const location = (locations.data?.locations ?? []).find((item: Location) =>
        item.websiteUri?.replace(/\/$/, "") === "https://www.delagraineaujardin.com",
      ) ?? locations.data?.locations?.[0];
      if (!location?.name) {
        if (active) { setError("Aucun établissement Google Business Profile accessible."); setLoading(false); }
        return;
      }
      const result = await getBusinessProfilePerformance({
        locationName: location.name,
        startDate: `${new Date().getFullYear()}-01-01`,
        endDate: yesterday(),
      });
      if (!active) return;
      if (result.error) setError(result.error);
      setLocationTitle(location.title ?? null);
      setDays(normalizePerformance((result.data ?? null) as PerformanceResponse));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => days.reduce(
    (acc, day) => ({ website: acc.website + day.website, calls: acc.calls + day.calls, directions: acc.directions + day.directions, impressions: acc.impressions + day.impressions }),
    { website: 0, calls: 0, directions: 0, impressions: 0 },
  ), [days]);

  return (
    <>
      {error && <Card className="border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div><p className="text-sm font-medium">Google Business Profile indisponible</p><p className="mt-1 text-xs text-muted-foreground">{error}</p></div></div></Card>}
      <Card className="p-5">
        <div className="flex items-start gap-3"><div className="rounded-lg bg-muted/50 p-2 text-primary"><MapPin className="h-4 w-4" /></div><div><h2 className="font-serif text-lg font-semibold">Performance locale Google</h2><p className="mt-0.5 text-sm text-muted-foreground">{locationTitle ?? "Google Business Profile"} · données quotidiennes réelles.</p></div></div>
        <div className="mt-5 grid gap-5 sm:grid-cols-4">
          <Metric label="Clics site" value={loading ? "…" : formatNumber(totals.website)} />
          <Metric label="Appels" value={loading ? "…" : formatNumber(totals.calls)} />
          <Metric label="Itinéraires" value={loading ? "…" : formatNumber(totals.directions)} />
          <Metric label="Impressions" value={loading ? "…" : formatNumber(totals.impressions)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}</p>
      </Card>
      <Card className="p-5">
        <h2 className="font-serif text-lg font-semibold">Évolution de la visibilité locale</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">Axe temporel explicite : chaque ligne correspond à une date Google Business Profile.</p>
        <div className="mt-4 overflow-x-auto">
          {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données Google…</p> : days.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée Google Business Profile disponible sur la période.</p> : <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="pb-2">Date</th><th className="pb-2 text-right">Clics site</th><th className="pb-2 text-right">Appels</th><th className="pb-2 text-right">Itinéraires</th><th className="pb-2 text-right">Impressions</th></tr></thead><tbody>{days.slice(-31).map((day) => <tr key={day.date} className="border-t border-border/40"><td className="py-3">{formatDateLabel(day.date)}</td><td className="py-3 text-right tabular-nums">{formatNumber(day.website)}</td><td className="py-3 text-right tabular-nums">{formatNumber(day.calls)}</td><td className="py-3 text-right tabular-nums">{formatNumber(day.directions)}</td><td className="py-3 text-right tabular-nums">{formatNumber(day.impressions)}</td></tr>)}</tbody></table>}
        </div>
      </Card>
    </>
  );
}

function normalizePerformance(data: PerformanceResponse | null): Day[] {
  const byDate = new Map<string, Day>();
  for (const series of data?.multiDailyMetricTimeSeries ?? []) {
    const metric = series.metric;
    for (const item of series.timeSeries?.datedValues ?? []) {
      const d = item.date;
      if (!d?.year || !d.month || !d.day) continue;
      const date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
      const current = byDate.get(date) ?? { date, website: 0, calls: 0, directions: 0, impressions: 0 };
      const value = Number(item.value ?? 0);
      if (metric === "WEBSITE_CLICKS") current.website += value;
      else if (metric === "CALL_CLICKS") current.calls += value;
      else if (metric === "BUSINESS_DIRECTION_REQUESTS") current.directions += value;
      else if (metric?.startsWith("BUSINESS_IMPRESSIONS_")) current.impressions += value;
      byDate.set(date, current);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p></div>; }
function yearStart() { return `${new Date().getFullYear()}-01-01`; }
function yesterday() { const date = new Date(); date.setDate(date.getDate() - 1); return date.toISOString().slice(0, 10); }
function formatDateLabel(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function formatNumber(value: number) { return new Intl.NumberFormat("fr-FR").format(value); }
