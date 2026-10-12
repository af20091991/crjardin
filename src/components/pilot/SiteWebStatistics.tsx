import { useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, BarChart3, Eye, MousePointerClick, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "@/components/ui/lazy-recharts";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/pilot/EmptyState";
import { friendlyConnectionError } from "@/components/pilot/SiteWebGoogleConnection";
import { listAnalyticsProperties, runAnalyticsReport } from "@/lib/site-web-api";

type Property = { name: string; displayName?: string; propertyType?: string };
type ReportRow = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
type Report = { rows?: ReportRow[]; rowCount?: number };
type DailyRow = { date: string; sessions: number; users: number; views: number; engagement: number };
type RankedRow = { name: string; value: number };

const numberFormat = new Intl.NumberFormat("fr-FR");
const percentFormat = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });
const dateISO = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return dateISO(date);
};
const displayDate = (value: string) => {
  if (!/^\d{8}$/.test(value)) return value;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(
    new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))),
  );
};
const asNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const errorMessage = (error: string) => friendlyConnectionError(error) ?? error;

export function SiteWebStatistics() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [channels, setChannels] = useState<RankedRow[]>([]);
  const [landingPages, setLandingPages] = useState<RankedRow[]>([]);
  const [events, setEvents] = useState<RankedRow[]>([]);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await listAnalyticsProperties();
      if (!active) return;
      if (result.error) {
        setPropertyError(result.error);
      } else {
        const available = result.data?.properties ?? [];
        setProperties(available);
        // Prefer an explicitly matching property; otherwise let the user select
        // instead of silently attributing metrics to an unrelated GA4 property.
        const matching = available.find((item) =>
          /graine.?au.?jardin|delagraineaujardin/i.test(item.displayName ?? item.name),
        );
        if (matching) setPropertyId(matching.name);
        else if (available.length === 1) setPropertyId(available[0].name);
      }
      setLoadingProperties(false);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setDaily([]);
      setChannels([]);
      setLandingPages([]);
      setEvents([]);
      return;
    }
    let active = true;
    void (async () => {
      setLoadingReport(true);
      setReportError(null);
      const startDate = daysAgo(90);
      const endDate = daysAgo(1);
      const shortStart = daysAgo(30);
      const [dailyResult, channelResult, landingResult, eventResult] = await Promise.all([
        runAnalyticsReport({
          propertyId, startDate, endDate, dimensions: ["date"],
          metrics: ["sessions", "totalUsers", "screenPageViews", "engagementRate"],
        }),
        runAnalyticsReport({
          propertyId, startDate: shortStart, endDate, dimensions: ["sessionDefaultChannelGroup"],
          metrics: ["sessions"],
        }),
        runAnalyticsReport({
          propertyId, startDate: shortStart, endDate, dimensions: ["landingPagePlusQueryString"],
          metrics: ["sessions"],
        }),
        runAnalyticsReport({
          propertyId, startDate: shortStart, endDate, dimensions: ["eventName"],
          metrics: ["eventCount"],
        }),
      ]);
      if (!active) return;
      const firstError = dailyResult.error ?? channelResult.error ?? landingResult.error ?? eventResult.error;
      if (firstError) {
        setReportError(firstError);
        setDaily([]);
        setChannels([]);
        setLandingPages([]);
        setEvents([]);
      } else {
        const dailyReport = dailyResult.data as Report | null;
        const channelReport = channelResult.data as Report | null;
        const landingReport = landingResult.data as Report | null;
        const eventReport = eventResult.data as Report | null;
        setDaily((dailyReport?.rows ?? []).map((row) => ({
          date: row.dimensionValues?.[0]?.value ?? "",
          sessions: asNumber(row.metricValues?.[0]?.value),
          users: asNumber(row.metricValues?.[1]?.value),
          views: asNumber(row.metricValues?.[2]?.value),
          engagement: asNumber(row.metricValues?.[3]?.value),
        })).filter((row) => row.date).sort((a, b) => a.date.localeCompare(b.date)));
        setChannels((channelReport?.rows ?? []).map((row) => ({
          name: row.dimensionValues?.[0]?.value || "(Non défini)",
          value: asNumber(row.metricValues?.[0]?.value),
        })).sort((a, b) => b.value - a.value).slice(0, 7));
        setLandingPages((landingReport?.rows ?? []).map((row) => ({
          name: row.dimensionValues?.[0]?.value || "(Page d'entrée non définie)",
          value: asNumber(row.metricValues?.[0]?.value),
        })).sort((a, b) => b.value - a.value).slice(0, 8));
        setEvents((eventReport?.rows ?? []).map((row) => ({
          name: row.dimensionValues?.[0]?.value || "(Événement sans nom)",
          value: asNumber(row.metricValues?.[0]?.value),
        })).sort((a, b) => b.value - a.value).slice(0, 10));
      }
      setLoadingReport(false);
    })();
    return () => { active = false; };
  }, [propertyId]);

  const totals = useMemo(() => daily.reduce((sum, row) => ({
    sessions: sum.sessions + row.sessions,
    users: sum.users + row.users,
    views: sum.views + row.views,
    engagementWeighted: sum.engagementWeighted + row.engagement * row.sessions,
  }), { sessions: 0, users: 0, views: 0, engagementWeighted: 0 }), [daily]);
  const averageEngagement = totals.sessions ? totals.engagementWeighted / totals.sessions : null;
  const propertyName = properties.find((item) => item.name === propertyId)?.displayName ?? propertyId;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted/50 p-2 text-primary"><BarChart3 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-lg font-semibold">Audience & parcours du site</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Google Analytics 4 uniquement : fréquentation, canaux d’acquisition, pages d’entrée et événements observés.
              Les clics et positions Google restent dans « SEO & mots-clés » ; les interactions de la fiche restent dans « SEO local ».
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Périodes : évolution sur 90 jours, canaux/pages/événements sur 30 jours, données jusqu’à hier.
            </p>
          </div>
        </div>
        {!loadingProperties && properties.length > 1 && (
          <div className="mt-4 max-w-xl">
            <label htmlFor="site-web-ga4-property" className="mb-1 block text-sm font-medium">Propriété Google Analytics 4</label>
            <select id="site-web-ga4-property" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Choisir la propriété du site</option>
              {properties.map((property) => <option key={property.name} value={property.name}>{property.displayName || property.name}</option>)}
            </select>
          </div>
        )}
        {propertyId && <p className="mt-2 text-xs text-muted-foreground">Propriété : {propertyName}</p>}
      </Card>

      {propertyError && <SourceError title="Google Analytics 4" code={propertyError} />}
      {!loadingProperties && !propertyError && properties.length === 0 && (
        <EmptyState icon={Activity} title="Aucune propriété Google Analytics 4 accessible" compact />
      )}
      {!loadingProperties && !propertyError && properties.length > 1 && !propertyId && (
        <EmptyState icon={Activity} title="Sélectionnez la propriété Analytics du site" description="Aucune propriété n’a été choisie automatiquement afin d’éviter d’afficher les statistiques d’un autre site." compact />
      )}
      {reportError && <SourceError title="Rapport Google Analytics 4" code={reportError} />}

      {propertyId && !reportError && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Activity} label="Sessions" value={loadingReport ? "…" : daily.length ? numberFormat.format(totals.sessions) : "—"} detail="Visites commencées sur le site · 90 jours" />
            <Kpi icon={Users} label="Utilisateurs actifs" value={loadingReport ? "…" : daily.length ? numberFormat.format(totals.users) : "—"} detail="Utilisateurs actifs rapportés par GA4 · cumul journalier" />
            <Kpi icon={Eye} label="Vues de pages/écrans" value={loadingReport ? "…" : daily.length ? numberFormat.format(totals.views) : "—"} detail="Pages vues et écrans vus · 90 jours" />
            <Kpi icon={MousePointerClick} label="Taux d’engagement" value={loadingReport ? "…" : averageEngagement === null ? "—" : percentFormat.format(averageEngagement)} detail="Moyenne pondérée par les sessions · 90 jours" />
          </div>
          <Card className="p-5">
            <h3 className="font-serif text-base font-semibold">Évolution de l’audience</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sessions et utilisateurs actifs par jour, source GA4.</p>
            <div className="mt-4 h-64">
              {loadingReport ? <p className="py-10 text-center text-sm text-muted-foreground">Chargement des rapports Analytics…</p>
                : daily.length === 0 ? <EmptyState icon={BarChart3} title="Aucune donnée d’audience disponible sur la période" compact />
                : <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={displayDate} interval={Math.max(0, Math.ceil(daily.length / 9) - 1)} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => displayDate(String(value))} formatter={(value: number, name: string) => [numberFormat.format(value), name]} />
                    <Line type="monotone" dataKey="sessions" name="Sessions" stroke="var(--pp-sales)" dot={false} />
                    <Line type="monotone" dataKey="users" name="Utilisateurs actifs" stroke="var(--primary)" dot={false} />
                  </LineChart>
                </ResponsiveContainer>}
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <RankedCard title="Canaux d’acquisition" description="Sessions par canal, 30 jours." rows={channels} loading={loadingReport} empty="Aucun canal disponible." />
            <RankedCard title="Pages d’entrée" description="Pages par lesquelles les sessions ont commencé, 30 jours." rows={landingPages} loading={loadingReport} empty="Aucune page d’entrée disponible." />
          </div>
          <Card className="p-5">
            <h3 className="font-serif text-base font-semibold">Événements observés</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Événements remontés par GA4 sur 30 jours. Un événement de formulaire ou de clic ne prouve pas à lui seul un contact unique, un prospect qualifié ou une demande commerciale.
            </p>
            {loadingReport ? <p className="py-6 text-sm text-muted-foreground">Chargement…</p>
              : events.length === 0 ? <EmptyState icon={MousePointerClick} title="Aucun événement disponible sur la période" compact />
              : <div className="mt-3 divide-y divide-border">
                {events.map((event) => <div key={event.name} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span className="min-w-0 break-words">{event.name}</span><span className="shrink-0 font-medium tabular-nums">{numberFormat.format(event.value)}</span>
                </div>)}
              </div>}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string; detail: string }) {
  return <Card className="p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-muted/50 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div></div></Card>;
}

function RankedCard({ title, description, rows, loading, empty }: { title: string; description: string; rows: RankedRow[]; loading: boolean; empty: string }) {
  return <Card className="p-5"><h3 className="font-serif text-base font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p>
    {loading ? <p className="py-6 text-sm text-muted-foreground">Chargement…</p> : rows.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{empty}</p>
      : <div className="mt-3 divide-y divide-border">{rows.map((row) => <div key={row.name} className="flex items-start justify-between gap-4 py-2 text-sm"><span className="min-w-0 break-words">{row.name}</span><span className="shrink-0 font-medium tabular-nums">{numberFormat.format(row.value)}</span></div>)}</div>}
  </Card>;
}

function SourceError({ title, code }: { title: string; code: string }) {
  return <Card className="border-destructive/30 bg-destructive/5 p-4"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><div><p className="text-sm font-medium">{title} indisponible</p><p className="mt-1 text-xs text-muted-foreground">{errorMessage(code)}</p></div></div></Card>;
}
