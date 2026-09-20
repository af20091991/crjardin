import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Crosshair, Eye, Lightbulb, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/pilot/EmptyState";
import { listAnalyticsProperties, querySearchConsole, runAnalyticsReport } from "@/lib/site-web-api";
import {
  aggregateSeoPages, aggregateSeoQueries, seoActions, seoOpportunities, seoStrengths, seoSummary,
  seoWeaknesses, topSeoPages, topSeoTraffic, type SeoAction, type SeoPage, type SeoQuery, type SeoQueryRow,
} from "@/lib/site-web-seo-diagnostic";

const SITE_URL = "https://www.delagraineaujardin.com/";
const PREFERRED_GA4_PROPERTY_ID = "159443253";

type AnalyticsRow = { dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> };
type AnalyticsReport = { rows?: AnalyticsRow[] };
type Channel = { name: string; sessions: number };

export function SiteWebSeoDiagnostic() {
  const [rows, setRows] = useState<SeoQueryRow[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(null);
      const searchResult = await querySearchConsole({ siteUrl: SITE_URL, startDate: yearStart(), endDate: yesterday(), dimensions: ["query", "page"] });
      if (!active) return;
      if (searchResult.error) { setError(searchResult.error); setLoading(false); return; }
      setRows((searchResult.data?.rows ?? []) as SeoQueryRow[]);
      const propertiesResult = await listAnalyticsProperties();
      if (!active) return;
      const properties = propertiesResult.data?.properties ?? [];
      const selected = properties.find((item) => item.name === `properties/${PREFERRED_GA4_PROPERTY_ID}`) ?? properties.find((item) => item.name === PREFERRED_GA4_PROPERTY_ID) ?? properties[0];
      if (selected) {
        const reportResult = await runAnalyticsReport({
          propertyId: selected.name.replace(/^properties\//, ""), startDate: yearStart(), endDate: yesterday(),
          dimensions: ["sessionDefaultChannelGroup"], metrics: ["sessions"],
        });
        if (active && reportResult.data) {
          const report = reportResult.data as AnalyticsReport;
          setChannels((report.rows ?? []).map((row) => ({ name: row.dimensionValues?.[0]?.value ?? "Inconnu", sessions: Number(row.metricValues?.[0]?.value ?? 0) })));
        }
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const queries = useMemo(() => aggregateSeoQueries(rows), [rows]);
  const pages = useMemo(() => aggregateSeoPages(rows), [rows]);
  const summary = useMemo(() => seoSummary(queries), [queries]);
  const strengths = useMemo(() => seoStrengths(queries), [queries]);
  const opportunities = useMemo(() => seoOpportunities(queries), [queries]);
  const weaknesses = useMemo(() => seoWeaknesses(queries), [queries]);
  const actions = useMemo(() => seoActions(queries), [queries]);
  const trafficQueries = useMemo(() => topSeoTraffic(queries), [queries]);
  const trafficPages = useMemo(() => topSeoPages(pages), [pages]);
  const organicSessions = channels.find((item) => item.name.toLowerCase() === "organic search")?.sessions ?? 0;

  return (
    <div className="space-y-5">
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-background p-2 text-primary shadow-sm"><Crosshair className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-xl font-semibold">Diagnostic SEO</h2><Badge variant="outline" className="font-normal">Données réelles Google</Badge></div>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">PP transforme les données Search Console et Analytics en constats et en actions concrètes. Aucune requête n'est classée comme opportunité sans données suffisantes.</p>
            <p className="mt-2 text-xs text-muted-foreground">Période : {formatDateLabel(yearStart())} → {formatDateLabel(yesterday())}</p>
          </div>
        </div>
      </Card>

      {error && <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Données Google indisponibles : {error}</Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Eye} label="Clics Google" value={loading ? "…" : formatNumber(summary.totalClicks)} detail="trafic organique généré par les recherches" />
        <Metric icon={Crosshair} label="Requêtes visibles" value={loading ? "…" : formatNumber(summary.queryCount)} detail="requêtes ayant généré une ligne Search Console" />
        <Metric icon={ShieldCheck} label="Clics depuis le top 10" value={loading ? "…" : formatPercent(summary.top10ClickShare)} detail="part des clics provenant des positions 1 à 10" />
        <Metric icon={Users} label="Sessions SEO" value={loading ? "…" : formatNumber(organicSessions)} detail="sessions Analytics 4 issues de la recherche organique" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SwotCard icon={CheckCircle2} title="Forces" tone="positive">{strengths.length ? strengths.map((item) => <QueryLine key={item.query} item={item} suffix="bien positionnée" />) : <EmptyState icon={CheckCircle2} title="Pas encore assez de données" compact />}</SwotCard>
        <SwotCard icon={AlertTriangle} title="Faiblesses" tone="warning">{weaknesses.length ? weaknesses.map((item) => <QueryLine key={item.query} item={item} suffix="visibilité à améliorer" />) : <EmptyState icon={AlertTriangle} title="Aucune faiblesse nette détectée" compact />}</SwotCard>
        <SwotCard icon={Lightbulb} title="Opportunités" tone="info">{opportunities.length ? opportunities.map((item) => <QueryLine key={item.query} item={item} suffix="proche d'une position forte" />) : <EmptyState icon={Lightbulb} title="Aucune opportunité nette détectée" compact />}</SwotCard>
        <SwotCard icon={Users} title="Concurrence" tone="neutral"><div className="rounded-lg border border-border/60 p-4"><p className="text-sm font-medium">Comparaison non mesurée</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Search Console ne fournit pas les domaines concurrents présents devant le site. PP ne fabrique donc pas de liste de concurrents à partir d'une supposition.</p></div></SwotCard>
      </div>

      <ActionPanel actions={actions} loading={loading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="Ce qui rapporte du trafic" subtitle="Requêtes organiques classées par clics">{trafficQueries.map((item) => <QueryLine key={item.query} item={item} suffix={`${formatNumber(item.clicks)} clics`} />)}</ListCard>
        <ListCard title="Pages qui captent le trafic" subtitle="Pages organiques classées par clics">{trafficPages.map((item) => <PageLine key={item.page} item={item} />)}</ListCard>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="font-serif text-lg font-semibold">Lecture à retenir</h2><p className="mt-1 text-sm text-muted-foreground">Une synthèse courte plutôt qu'un tableau de mots-clés.</p></div><Badge variant="outline" className="font-normal">{formatNumber(summary.totalImpressions)} impressions</Badge></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Insight title="Ce qui marche" text={strengths[0] ? `« ${strengths[0].query} » est déjà dans le top 10 et génère ${formatNumber(strengths[0].clicks)} clics.` : "Pas assez de données pour identifier une force dominante."} />
          <Insight title="Le levier immédiat" text={actions[0]?.reason ?? "Pas de levier prioritaire identifié sur la période."} />
          <Insight title="Le point à surveiller" text={weaknesses[0] ? `« ${weaknesses[0].query} » bénéficie de ${formatNumber(weaknesses[0].impressions)} impressions mais reste autour de la position ${formatPosition(weaknesses[0].position)}.` : "Pas de faiblesse dominante identifiée sur la période."} />
        </div>
      </Card>
    </div>
  );
}

function ActionPanel({ actions, loading }: { actions: SeoAction[]; loading: boolean }) {
  return <Card className="p-5">
    <div className="flex items-start gap-3"><div className="rounded-lg bg-muted/50 p-2 text-primary"><TargetIcon /></div><div><h2 className="font-serif text-lg font-semibold">Plan d'action SEO</h2><p className="mt-1 text-sm text-muted-foreground">PP transforme les signaux Google en prochaines actions, sans inventer de problème lorsque les données ne le permettent pas.</p></div></div>
    <div className="mt-4 space-y-2">
      {loading ? <p className="py-4 text-center text-sm text-muted-foreground">Analyse des données…</p> : actions.length ? actions.map((action) => <ActionRow key={action.query} action={action} />) : <EmptyState icon={Lightbulb} title="Aucune action prioritaire détectée sur les données disponibles." compact />}
    </div>
  </Card>;
}

function ActionRow({ action }: { action: SeoAction }) {
  const label = action.type === "local" ? "Local" : action.type === "content" ? "Contenu" : action.type === "authority" ? "Autorité" : "Gain rapide";
  return <div className="rounded-lg border border-border/60 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">« {action.query} »</p><Badge variant="outline" className="font-normal">{label}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{action.title}</p></div></div>
    <p className="mt-3 text-sm leading-relaxed">{action.reason}</p>
    <p className="mt-2 text-xs text-muted-foreground">Cible : {action.target}</p>
  </div>;
}

function TargetIcon() { return <Crosshair className="h-4 w-4" />; }
function Metric({ icon: Icon, label, value, detail }: { icon: typeof Eye; label: string; value: string; detail: string }) { return <Card className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></Card>; }
function SwotCard({ icon: Icon, title, tone, children }: { icon: typeof Eye; title: string; tone: "positive" | "warning" | "info" | "neutral"; children: ReactNode }) { const toneClass = tone === "positive" ? "border-primary/30" : tone === "warning" ? "border-accent/30" : tone === "info" ? "border-primary/30" : "border-border"; return <Card className={`p-5 ${toneClass}`}><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><h2 className="font-serif text-lg font-semibold">{title}</h2></div><div className="mt-4 space-y-2">{children}</div></Card>; }
function QueryLine({ item, suffix }: { item: SeoQuery; suffix: string }) { return <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.query}</p><p className="mt-1 text-xs text-muted-foreground">Position {formatPosition(item.position)} · CTR {formatPercent(item.ctr)} · {formatNumber(item.impressions)} impressions</p></div><Badge variant="outline" className="shrink-0 font-normal">{suffix}</Badge></div>; }
function PageLine({ item }: { item: SeoPage }) { return <div className="rounded-lg border border-border/60 p-3"><p className="truncate text-sm font-medium">{item.page.replace(SITE_URL, "/")}</p><p className="mt-1 text-xs text-muted-foreground">{formatNumber(item.clicks)} clics · {formatNumber(item.impressions)} impressions · position {formatPosition(item.position)}</p></div>; }
function ListCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <Card className="p-5"><h2 className="font-serif text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p><div className="mt-4 space-y-2">{children}</div></Card>; }
function Insight({ title, text }: { title: string; text: string }) { return <div className="rounded-lg bg-muted/40 p-4"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div>; }
function yearStart() { return `${new Date().getFullYear()}-01-01`; }
function yesterday() { const date = new Date(); date.setDate(date.getDate() - 1); return date.toISOString().slice(0, 10); }
function formatDateLabel(value: string) { const parsed = new Date(`${value}T12:00:00`); if (Number.isNaN(parsed.getTime())) return value; return new Intl.DateTimeFormat("fr-FR").format(parsed); }
function formatNumber(value: number) { return new Intl.NumberFormat("fr-FR").format(value); }
function formatPercent(value: number) { return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value); }
function formatPosition(value: number) { return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value); }
