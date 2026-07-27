import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { computeKpis, fetchConfirmedHoursByClient, DEFAULT_SETTINGS } from "@/lib/pilot";
import { listGoals } from "@/lib/pilot-goals";
import { fetchClientActivityRows } from "@/lib/client-activity";
import { listChargeRows, listSalesByYear, listChargeCategories, analyzeCharges } from "@/lib/pilot-charges";
import { pragmaticHealth, HEALTH_THEME_META, HEALTH_LEVEL_META } from "@/lib/pilot-health";
import { askPilotAi } from "@/lib/pilot-ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Bot, HeartPulse, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { currentYear } from "@/lib/date-utils";
import { goalsForMode } from "@/lib/pilot-realized";
import { usePilotMode } from "@/lib/pilot-mode";

export const Route = createFileRoute("/_authenticated/pilot/sante")({
  head: () => ({ meta: [{ title: "Santé de l'entreprise — Pilot Pro" }] }),
  component: SantePage,
});

function SantePage() {
  const { entries, charges, settings } = usePilotData();
  const { mode } = usePilotMode();
  const year = currentYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };

  const confirmed = useQuery({ queryKey: ["confirmed-hours-by-client", year], queryFn: () => fetchConfirmedHoursByClient(year) });
  const goalsQ = useQuery({ queryKey: ["pilot-goals"], queryFn: listGoals });
  const activityQ = useQuery({ queryKey: ["client-activity-rows"], queryFn: fetchClientActivityRows });
  const chargeRowsQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const salesQ = useQuery({ queryKey: ["pilot-sales-by-year"], queryFn: () => listSalesByYear() });
  const catsQ = useQuery({ queryKey: ["pilot-charge-categories"], queryFn: listChargeCategories });

  const k = useMemo(
    () => computeKpis({
      entries: entries.data ?? [], charges: charges.data ?? [], settings: set,
      year, month: new Date().getMonth(), confirmedHoursByClient: confirmed.data, mode,
    }),
    [entries.data, charges.data, set, year, confirmed.data, mode],
  );

  const chargesAnalysis = useMemo(() => {
    if (!chargeRowsQ.data || !salesQ.data) return null;
    return analyzeCharges(chargeRowsQ.data, salesQ.data, (catsQ.data ?? []).map((c) => c.label), { mode });
  }, [chargeRowsQ.data, salesQ.data, catsQ.data, mode]);

  const health = useMemo(() => {
    const rows = activityQ.data ?? [];
    return pragmaticHealth({
      k,
      settings: set,
      goals: goalsForMode(goalsQ.data ?? [], mode),
      charges: chargesAnalysis,
      dormantClients: rows.filter((r) => r.status === "dormant").length,
      activeClients: rows.filter((r) => r.status === "actif").length,
    });
  }, [k, set, goalsQ.data, chargesAnalysis, activityQ.data, mode]);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const askMut = useMutation({
    mutationFn: (q: string) => askPilotAi({ data: { question: q } }),
    onSuccess: (r) => setAnswer(r.answer),
    onError: (e: Error) => toast.error(e.message),
  });

  if (entries.isLoading) return <Skeleton className="h-64 rounded-xl" />;

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
          {answer && <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">{answer}</div>}
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
