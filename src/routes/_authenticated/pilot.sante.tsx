import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { computeKpis, fetchConfirmedHoursByClient, clientStats, DEFAULT_SETTINGS, formatEuro } from "@/lib/pilot";
import { listGoals } from "@/lib/pilot-goals";
import { fetchClientActivityRows } from "@/lib/client-activity";
import { listChargeRows, listSalesByYear, listChargeCategories, analyzeCharges } from "@/lib/pilot-charges";
import { annualSummary } from "@/lib/pilot-annual";
import { pragmaticHealth, margeHealthScore, HEALTH_THEME_META, HEALTH_LEVEL_META } from "@/lib/pilot-health";
import { usePilotPeriod } from "@/lib/pilot-mode";
import { useThresholds } from "@/lib/pilot-thresholds";
import { askPilotAi, type AiChartSpec } from "@/lib/pilot-ai.functions";
import { AiChart } from "@/components/pilot/AiChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Bot, HeartPulse, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { currentYear } from "@/lib/date-utils";
import { entriesForMode, goalsForMode, periodScopeLabel, PERIOD_LABELS } from "@/lib/pilot-realized";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ReferenceLine } from "recharts";
import { PP_COLORS } from "@/lib/pilot-colors";

export const Route = createFileRoute("/_authenticated/pilot/sante")({
  head: () => ({ meta: [{ title: "Santé de l'entreprise — Pilot Pro" }] }),
  component: SantePage,
});

function SantePage() {
  const { entries, charges, settings } = usePilotData();
  /**
   * Règle absolue : la santé est une photographie RÉELLE à la date du jour.
   * Aucune projection, aucune extrapolation, aucun objectif futur — le mode
   * global Réel/Projection n'est volontairement pas lu ici.
   */
  const mode = "reel" as const;
  const { period } = usePilotPeriod();
  const thresholds = useThresholds();
  const year = currentYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };

  const confirmed = useQuery({ queryKey: ["confirmed-hours-by-client", year, mode, period], queryFn: () => fetchConfirmedHoursByClient(year, { mode, period }) });
  const goalsQ = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const activityQ = useQuery({ queryKey: ["client-activity-rows"], queryFn: fetchClientActivityRows });
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const salesQ = useQuery({ queryKey: ["pilot-sales-by-year", mode, period], queryFn: () => listSalesByYear({ mode, period }) });
  const catsQ = useQuery({ queryKey: ["pilot-charge-categories"], queryFn: listChargeCategories });

  const k = useMemo(
    () => computeKpis({
      entries: entries.data ?? [], charges: charges.data ?? [], settings: set,
      year, month: new Date().getMonth(), confirmedHoursByClient: confirmed.data, mode, period,
    }),
    [entries.data, charges.data, set, year, confirmed.data, mode, period],
  );

  // Source unique du bénéfice/de la marge : annualSummary().
  const annualRows = useMemo(
    () => annualSummary(entries.data ?? [], chargeRowsQ.data ?? [], { mode, period }),
    [entries.data, chargeRowsQ.data, mode, period],
  );
  const currentAnnual = useMemo(() => annualRows.find((r) => r.year === year) ?? null, [annualRows, year]);

  const chargesAnalysis = useMemo(() => {
    if (!chargeRowsQ.data || !salesQ.data) return null;
    return analyzeCharges(chargeRowsQ.data, salesQ.data, (catsQ.data ?? []).map((c) => c.label), { mode, period });
  }, [chargeRowsQ.data, salesQ.data, catsQ.data, mode, period]);

  const topClientSharePct = useMemo(() => {
    // Concentration client : le bucket « ventes non rattachées » n'est pas un
    // client et ne peut donc jamais être le 1er client du portefeuille.
    // Concentration client : même périmètre temporel que le reste de l'écran.
    const stats = clientStats(
      entriesForMode(entries.data ?? [], mode, undefined, period),
      year,
    ).filter((s) => !s.unassigned);
    return stats.length ? stats[0].share : null;
  }, [entries.data, year, mode, period]);

  const health = useMemo(() => {
    const rows = activityQ.data ?? [];
    return pragmaticHealth({
      k,
      annual: currentAnnual,
      settings: set,
      goals: goalsForMode(goalsQ.data ?? [], mode, undefined, period),
      charges: chargesAnalysis,
      dormantClients: rows.filter((r) => r.status === "dormant").length,
      activeClients: rows.filter((r) => r.status === "actif").length,
      topClientSharePct,
      thresholds,
    });
  }, [k, currentAnnual, set, goalsQ.data, chargesAnalysis, activityQ.data, mode, period, topClientSharePct, thresholds]);

  // Graphique 1 : scores par thématique (histogramme horizontal).
  const themeChartData = useMemo(
    () =>
      health.themes.map((t) => ({
        label: HEALTH_THEME_META[t.theme].label,
        score: t.score ?? 0,
        hasData: t.score != null,
        fill: HEALTH_THEME_META[t.theme].color,
      })),
    [health.themes],
  );

  // Graphique 2 : évolution du score de marge par exercice (annualSummary).
  const margeEvolutionData = useMemo(
    () =>
      [...annualRows]
        .sort((a, b) => a.year - b.year)
        .map((r) => ({
          year: String(r.year),
          margePct: r.margePct != null ? Math.round(r.margePct) : null,
          score: margeHealthScore(r.margePct, thresholds),
        }))
        .filter((r) => r.score != null),
    [annualRows, thresholds],
  );

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [chart, setChart] = useState<AiChartSpec | null>(null);
  const askMut = useMutation({
    mutationFn: (q: string) => askPilotAi({ data: { question: q } }),
    onSuccess: (r) => {
      setAnswer(r.answer);
      setChart(r.chart);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (entries.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (chargeRowsQ.isLoading || salesQ.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  // Une erreur de chargement des charges ne doit JAMAIS devenir « 0 € de
  // charges » : sans charges fiables, aucun score financier n'est publié.
  if (chargeRowsQ.isError || salesQ.isError) {
    const failed = (chargeRowsQ.error ?? salesQ.error) as Error;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Score Santé indisponible
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Les charges (ou le CA de référence) n'ont pas pu être chargées : le score financier ne
            peut pas être calculé sans elles. Aucun score n'est publié sur une base de charges vide.
          </p>
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {failed?.message ?? "Erreur de chargement"}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (chargeRowsQ.isError) void chargeRowsQ.refetch();
              if (salesQ.isError) void salesQ.refetch();
            }}
          >
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const meta = HEALTH_LEVEL_META[health.level];
  const R = 54;
  const C = 2 * Math.PI * R;
  const pctScore = health.score ?? 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <HeartPulse className="h-6 w-6 text-primary" /> Santé de l'entreprise
        </h1>
        <p className="text-sm text-muted-foreground">
          Quatre questions simples : est-ce que je gagne de l'argent, est-ce que je vends assez,
          est-ce que mon temps est bien employé, est-ce que j'avance sur mes priorités ?
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
            Période : {PERIOD_LABELS[period]}
          </span>
          <span className="text-xs text-muted-foreground">{periodScopeLabel(year, period)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {period === "exercice_complet"
            ? "Lecture intégrale de l'exercice demandée explicitement : les charges et ventes postérieures à aujourd'hui sont incluses."
            : `Photographie réelle au ${new Date().toLocaleDateString("fr-FR")} : CA, charges, marge, bénéfice et poids des charges sont arrêtés à cette date. Aucune donnée future, aucune projection.`}{" "}
          Un axe sans donnée exploitable affiche « Données insuffisantes ».
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-8">
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
                <circle cx="60" cy="60" r={R} className="fill-none stroke-muted" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r={R} fill="none" stroke={meta.color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C - (C * pctScore) / 100}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-serif text-3xl font-semibold">{health.score ?? "—"}</span>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${meta.tone}`}>{meta.label}</span>
            <p className="max-w-sm text-center text-sm text-muted-foreground">{health.interpretation}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ce qu'il faut faire</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {health.actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{a}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Scores par thématique</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ score: { label: "Score", color: PP_COLORS.primary } }} className="h-[220px] w-full">
              <BarChart data={themeChartData} layout="vertical" margin={{ left: 8, right: 12 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} fontSize={11} width={110} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, _name, item) =>
                        item?.payload?.hasData ? `${value} / 100` : "Données insuffisantes"
                      }
                    />
                  }
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {themeChartData.map((d, i) => (
                    <Bar key={i} dataKey="score" fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Évolution du score de marge par exercice</CardTitle></CardHeader>
          <CardContent>
            {margeEvolutionData.length ? (
              <ChartContainer config={{ score: { label: "Score de marge", color: PP_COLORS.sales } }} className="h-[220px] w-full">
                <LineChart data={margeEvolutionData} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={11} width={32} />
                  <ReferenceLine y={75} stroke={PP_COLORS.neutral} strokeDasharray="3 3" />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, _name, item) =>
                          `${value} / 100${item?.payload?.margePct != null ? ` (marge ${item.payload.margePct} %)` : ""}`
                        }
                      />
                    }
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--color-score)" strokeWidth={2} dot />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Aucun exercice avec CA exploitable.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {health.themes.map((t) => {
          const tm = HEALTH_THEME_META[t.theme];
          return (
            <Card key={t.theme}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{tm.label}</span>
                  <span className="font-serif text-xl" style={{ color: t.score == null ? "#94A3B8" : tm.color }}>
                    {t.score == null ? "—" : `${t.score}/100`}
                  </span>
                </CardTitle>
                <p className="text-xs italic text-muted-foreground">{tm.question}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${t.score ?? 0}%`, background: tm.color }} />
                </div>
                {t.details.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.reason}</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {t.details.map((d) => (
                      <li key={d.label} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            {d.ok == null ? <MinusCircle className="h-3.5 w-3.5" />
                              : d.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                            {d.label}
                          </span>
                          <span className="font-medium tabular-nums">{d.value}</span>
                        </div>
                        <p className="pl-5 text-xs text-muted-foreground">
                          Origine : {d.origin} · {d.why}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">{t.reason}</p>
                <p className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                  Action recommandée : {themeAction(t.theme, t.score)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" /> Assistant de direction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={2}
            placeholder="Ex : quelles prestations sont les plus rentables cette année ?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex justify-end">
            <Button onClick={() => question.trim() && askMut.mutate(question.trim())} disabled={askMut.isPending} className="gap-2">
              <Send className="h-4 w-4" /> {askMut.isPending ? "Analyse…" : "Poser la question"}
            </Button>
          </div>
          {answer && (
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {answer}
            </div>
          )}
          {chart && <AiChart chart={chart} />}
          <p className="text-xs text-muted-foreground">
            Analyse courte, chiffres cités et graphique lorsqu'il apporte de la clarté. L'assistant
            n'utilise que les données enregistrées dans Pilot Pro et répond « Données insuffisantes »
            si elles manquent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function themeAction(theme: keyof typeof HEALTH_THEME_META, score: number | null): string {
  if (score == null) return "compléter les données sources avant de conclure.";
  if (score >= 75) return "maintenir le suivi mensuel, aucune correction urgente.";
  if (theme === "financiere") return "arbitrer les charges et revoir les prix des prestations sous marge.";
  if (theme === "commerciale") return "relancer les clients dormants et sécuriser le CA récurrent.";
  if (theme === "activite") return "comparer le temps réel au temps vendu et ajuster les devis.";
  return "prioriser les objectifs en retard ou les replanifier.";
}
