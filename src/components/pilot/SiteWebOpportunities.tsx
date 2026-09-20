import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/pilot/EmptyState";
import { Lightbulb, TrendingDown, TrendingUp } from "lucide-react";
import { querySearchConsole } from "@/lib/site-web-api";
import {
  aggregateSeoPages,
  aggregateSeoQueries,
  compareSeoQueries,
  seoOpportunities,
  seoPageOpportunities,
  significantChanges,
  type SeoQueryRow,
} from "@/lib/site-web-seo-diagnostic";

const SITE_URL = "https://www.delagraineaujardin.com/";

export function SiteWebOpportunities() {
  const [currentRows, setCurrentRows] = useState<SeoQueryRow[]>([]);
  const [previousRows, setPreviousRows] = useState<SeoQueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const current = period(28, 0);
      const previous = period(28, 28);
      const [currentResult, previousResult] = await Promise.all([
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: current.start,
          endDate: current.end,
          dimensions: ["query", "page"],
        }),
        querySearchConsole({
          siteUrl: SITE_URL,
          startDate: previous.start,
          endDate: previous.end,
          dimensions: ["query", "page"],
        }),
      ]);
      if (!active) return;
      if (currentResult.error) setError(currentResult.error);
      else setCurrentRows(currentResult.data?.rows ?? []);
      if (previousResult.error) setError(previousResult.error);
      else setPreviousRows(previousResult.data?.rows ?? []);
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const queries = useMemo(() => aggregateSeoQueries(currentRows), [currentRows]);
  const pages = useMemo(() => aggregateSeoPages(currentRows), [currentRows]);
  const queryOpportunities = useMemo(() => seoOpportunities(queries), [queries]);
  const pageOpportunities = useMemo(() => seoPageOpportunities(pages), [pages]);
  const changes = useMemo(
    () => significantChanges(compareSeoQueries(currentRows, previousRows)),
    [currentRows, previousRows],
  );

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Données Google indisponibles : {error}
        </Card>
      )}

      <Card className="p-5">
        <Header
          icon={<Lightbulb className="h-4 w-4 text-primary" />}
          title="Opportunités SEO"
          description="Les opportunités sont détectées sur les données réelles des 28 derniers jours. Elles sont accompagnées d'une règle explicable, pas d'un score opaque."
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Période : {formatDateLabel(period(28, 0).start)} → {formatDateLabel(period(28, 0).end)}
        </p>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement des données…</p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <OpportunityList
              title="Requêtes à potentiel"
              rows={queryOpportunities.map((item) => ({
                label: item.query,
                detail: `${formatNumber(item.impressions)} impressions · ${formatNumber(item.clicks)} clics · position ${formatPosition(item.position)} · CTR ${formatPercent(item.ctr)}`,
                rule: "≥ 30 impressions · position 4 à 20 · CTR < 8 %",
              }))}
            />
            <OpportunityList
              title="Pages à potentiel"
              rows={pageOpportunities.map((item) => ({
                label: item.page,
                detail: `${formatNumber(item.impressions)} impressions · ${formatNumber(item.clicks)} clics · position ${formatPosition(item.position)} · CTR ${formatPercent(item.ctr)}`,
                rule: "≥ 50 impressions · position 4 à 15 · CTR < 8 %",
              }))}
            />
          </div>
        )}
      </Card>

      <Card className="p-5">
        <Header
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          title="Évolutions à surveiller"
          description="Une variation n'est signalée que lorsque la période précédente contient au moins 5 clics et que l'écart atteint 20 %."
        />
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
        ) : changes.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Aucune variation significative détectée." compact />
        ) : (
          <div className="mt-4 space-y-2">
            {changes.map((item) => {
              const positive = (item.change ?? 0) >= 0;
              return (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.key}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(item.previous)} → {formatNumber(item.current)} clics
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1 font-normal">
                    {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {positive ? "+" : ""}{formatPercent(item.change ?? 0)}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function OpportunityList({ title, rows }: { title: string; rows: Array<{ label: string; detail: string; rule: string }> }) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <EmptyState icon={Lightbulb} title="Aucune opportunité détectée." compact />
        ) : (
          rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium">{row.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">Règle : {row.rule}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function period(days: number, offset: number) {
  const end = new Date();
  end.setDate(end.getDate() - 1 - offset);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR").format(parsed);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPosition(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function Header({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted/50 p-2">{icon}</div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          <Badge variant="outline" className="font-normal">Search Console</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
