import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RefreshCw, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/pilot/EmptyState";
import { SeriesChart } from "@/components/pilot/DashboardCharts";
import { PP_COLORS } from "@/lib/pilot-colors";
import { formatCount, formatHourlyRate } from "@/lib/format-utils";
import { loadVisibilityRadar } from "@/lib/visibilite-locale-data";
import {
  CRITERION_LABEL,
  ENTRETIEN_MAX_KM,
  EXCLUDED_ALIASES,
  MAX_TRAVEL_MINUTES,
  PRESTATION_LABEL,
  TARGET_COMMUNES,
  WEIGHTS,
  type CriterionKey,
  type ScoredOpportunity,
} from "@/lib/visibilite-locale";

const RADAR_KEY = ["visibilite-locale-radar"];
const DAY_MS = 24 * 3600 * 1000;

function dateLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: PP_COLORS.primary }}
        />
      </div>
      <span className="w-9 text-right text-sm font-semibold tabular-nums">{value.toFixed(0)}</span>
    </div>
  );
}

export function SiteWebVisibilityRadar() {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const radar = useQuery({
    queryKey: RADAR_KEY,
    queryFn: () => loadVisibilityRadar(),
    staleTime: DAY_MS,
    retry: 1,
  });
  const data = radar.data;

  const rows = useMemo(() => {
    if (!data) return [];
    return data.opportunities.filter((o) => (showAll || o.promoted) && !o.outOfZone);
  }, [data, showAll]);
  const top = rows.slice(0, 10);

  const byCommune = useMemo(() => {
    const map = new Map<string, { impressions: number; clics: number }>();
    for (const c of TARGET_COMMUNES) map.set(c.name, { impressions: 0, clics: 0 });
    for (const o of rows) {
      const cur = map.get(o.commune);
      if (!cur) continue;
      cur.impressions += o.impressions;
      cur.clics += o.clicks;
    }
    return Array.from(map.entries()).map(([commune, v]) => ({ commune, ...v }));
  }, [rows]);

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Radar Visibilité locale</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Classe chaque couple prestation × commune selon la demande Google, la marge par heure,
              la marge de progression, la proximité et la saison. Lecture seule : rien n’est publié.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-muted-foreground">
              Données du {dateLabel(data.period.startDate)} au {dateLabel(data.period.endDate)}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={radar.isFetching}
            onClick={() => void radar.refetch()}
          >
            <RefreshCw className={`mr-1.5 h-4 w-4 ${radar.isFetching ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </Card>

      {radar.isLoading ? (
        <Card className="space-y-3 p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : radar.error ? (
        <Card className="p-4 text-sm text-destructive">
          Radar indisponible : {(radar.error as Error).message}
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Opportunités détectées" value={String(rows.length)} />
            <Kpi
              label="Impressions (zone, 90 j)"
              value={formatCount(rows.reduce((s, o) => s + o.impressions, 0))}
            />
            <Kpi
              label="Clics (zone, 90 j)"
              value={formatCount(rows.reduce((s, o) => s + o.clicks, 0))}
            />
            <Kpi label="Combinaisons sans visibilité" value={String(data.gaps.length)} />
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h3 className="font-serif text-base font-semibold">Classement des opportunités</h3>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                />
                Inclure les prestations non promues (entretien éloigné, remise en état)
              </label>
            </div>
            {top.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Target}
                  title="Aucune requête locale détectée sur la période."
                  compact
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-2 py-2 font-medium">Prestation</th>
                      <th className="px-2 py-2 font-medium">Commune</th>
                      <th className="px-2 py-2 font-medium">Score</th>
                      <th className="px-2 py-2 text-right font-medium">Impr.</th>
                      <th className="px-2 py-2 text-right font-medium">Clics</th>
                      <th className="px-2 py-2 text-right font-medium">Position</th>
                      <th className="px-2 py-2 text-right font-medium">Clics gagnables</th>
                      <th className="px-4 py-2 text-right font-medium">Trajet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((o, index) => (
                      <Fragment key={o.key}>
                        <tr
                          className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                          onClick={() => setOpen(open === o.key ? null : o.key)}
                        >
                          <td className="px-4 py-2 text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              {open === o.key ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              {index + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            {PRESTATION_LABEL[o.prestation]}
                            {!o.promoted && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                non promue
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 py-2">{o.commune}</td>
                          <td className="px-2 py-2">
                            <ScoreBar value={o.score} />
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {formatCount(o.impressions)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {formatCount(o.clicks)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {o.position.toFixed(1)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {o.potentialClicks > 0 ? `+${formatCount(o.potentialClicks)}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            {o.travelMinutes != null ? `${o.travelMinutes} min` : "—"}
                          </td>
                        </tr>
                        {open === o.key && (
                          <tr className="border-b bg-muted/20">
                            <td colSpan={9} className="px-4 py-3">
                              <ScoreDetail o={o} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="font-serif text-base font-semibold">Demande par commune</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Impressions et clics Google sur 90 jours, communes ciblées.
              </p>
              <div className="h-64">
                <SeriesChart
                  data={byCommune.map((c) => ({
                    commune: c.commune,
                    Impressions: c.impressions,
                    Clics: c.clics,
                  }))}
                  xKey="commune"
                  series={[
                    { key: "Impressions", color: PP_COLORS.sales, axis: "left" },
                    { key: "Clics", color: PP_COLORS.primary, axis: "right", kind: "line" },
                  ]}
                  type="barres"
                  formatLeft={(v) => formatCount(v)}
                  formatTooltip={(v) => formatCount(v)}
                />
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-serif text-base font-semibold">Score des 10 premières</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Score sur 100, par prestation × commune.
              </p>
              <div className="h-64">
                <SeriesChart
                  data={top.map((o) => ({
                    nom: `${o.prestation} · ${o.commune}`,
                    Score: Math.round(o.score),
                  }))}
                  xKey="nom"
                  series={[{ key: "Score", color: PP_COLORS.primary }]}
                  type="barres"
                  formatLeft={(v) => String(v)}
                  formatTooltip={(v) => `${v} / 100`}
                />
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-serif text-base font-semibold">Zones sans visibilité</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Prestations promues sans aucune impression dans la commune : candidates à une page
              locale (étape suivante).
            </p>
            {data.gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Toutes les combinaisons ont de la visibilité.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.gaps.map((g) => (
                  <Badge key={`${g.prestation}|${g.commune}`} variant="secondary">
                    {PRESTATION_LABEL[g.prestation]} · {g.commune}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-1 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Hypothèses de calcul</p>
            <p>
              Zone : {MAX_TRAVEL_MINUTES} min maximum depuis Vendargues ; communes exclues (ouest de
              Montpellier) : {EXCLUDED_ALIASES.length} noms ignorés. {data.totalQueries} requêtes
              lues, {data.unattachedQueries} citant une commune sans prestation reconnue,{" "}
              {data.ignoredExcluded} ignorées car communes exclues.
            </p>
            <p>
              Taux horaire par prestation :{" "}
              {Object.entries(data.hourlyRates)
                .map(([k, v]) => `${k} ${v ? formatHourlyRate(v) : "n/d"}`)
                .join(" · ")}
              . Un critère sans donnée prend une valeur neutre (indiquée au clic sur une ligne).
              {data.travelEstimated ? " Certains trajets sont des estimations à vol d’oiseau." : ""}
              {data.hasSeasonality
                ? ""
                : " Saisonnalité neutre : historique de ventes encore trop court."}
            </p>
            <p>
              Entretien promu seulement à moins de {ENTRETIEN_MAX_KM} km de Vendargues. Capacité :
              moyenne de{" "}
              {data.capacity.averageHours != null
                ? `${data.capacity.averageHours.toFixed(0)} h/mois`
                : "n/d"}{" "}
              sur les 3 derniers mois pour un seuil de saturation de {data.capacity.threshold}{" "}
              h/mois
              {data.capacity.saturated
                ? " : saturée, le score des prestations gourmandes en heures est réduit de 15 %."
                : " : non saturée, aucun frein appliqué."}
            </p>
            <p>La structure GEO des pages sera prise en compte à l’étape suivante.</p>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function ScoreDetail({ o }: { o: ScoredOpportunity }) {
  const keys = Object.keys(WEIGHTS) as CriterionKey[];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Pourquoi cette note</p>
        {keys.map((key) => (
          <div key={key} className="flex items-center gap-3 text-xs">
            <span className="w-36 shrink-0">
              {CRITERION_LABEL[key]}{" "}
              <span className="text-muted-foreground">({Math.round(WEIGHTS[key] * 100)} %)</span>
            </span>
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(2, o.criteria[key])}%`,
                  background: o.neutral.includes(key) ? PP_COLORS.neutral : PP_COLORS.primary,
                }}
              />
            </div>
            <span className="tabular-nums">{o.criteria[key].toFixed(0)}</span>
            {o.neutral.includes(key) && (
              <span className="text-muted-foreground">(neutre, faute de données)</span>
            )}
          </div>
        ))}
        {o.hourlyRate ? (
          <p className="pt-1 text-xs text-muted-foreground">
            Taux horaire de la prestation : {formatHourlyRate(o.hourlyRate)}
          </p>
        ) : null}
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Principales requêtes</p>
        <ul className="space-y-1 text-xs">
          {o.topQueries.map((q) => (
            <li key={q.query} className="flex justify-between gap-3">
              <span className="truncate">{q.query}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatCount(q.impressions)} impr. · pos. {q.position.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
