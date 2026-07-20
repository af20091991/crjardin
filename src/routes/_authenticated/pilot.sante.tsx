import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import { useQuery } from "@tanstack/react-query";
import { computeKpis, healthScore, HEALTH_META, generateThematicInsights, clientStatsWithHours, fetchConfirmedHoursByClient, DEFAULT_SETTINGS } from "@/lib/pilot";
import { askPilotAi } from "@/lib/pilot-ai.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Bot } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/sante")({
  component: SantePage,
});

const BREAKDOWN_DEFS: Record<string, string> = {
  Marge: "Marge nette (bénéfice / CA). Objectif ≥ 30 % pour une note maximale.",
  Croissance: "Progression du CA vs même période N-1. +25 % ≈ 100/100.",
  Objectif: "Pourcentage de l'objectif annuel de CA atteint à date.",
  Rentabilité: "Taux horaire réel comparé au taux horaire cible défini dans les paramètres.",
  Activité: "Volume d'interventions annuelles (100 interventions = 100/100).",
};

const THEME_TONE: Record<string, string> = {
  Croissance: "bg-emerald-100 text-emerald-700",
  Rentabilité: "bg-blue-100 text-blue-700",
  Activité: "bg-amber-100 text-amber-700",
  Mix: "bg-purple-100 text-purple-700",
  Clients: "bg-orange-100 text-orange-700",
  Saisonnalité: "bg-cyan-100 text-cyan-700",
  Charges: "bg-rose-100 text-rose-700",
  Objectif: "bg-primary/10 text-primary",
};

function SantePage() {
  const { entries, charges, settings } = usePilotData();
  const year = new Date().getFullYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const confirmed = useQuery({
    queryKey: ["confirmed-hours-by-client", year],
    queryFn: () => fetchConfirmedHoursByClient(year),
  });
  const k = useMemo(
    () => computeKpis({
      entries: entries.data ?? [], charges: charges.data ?? [], settings: set,
      year, month: new Date().getMonth(),
      confirmedHoursByClient: confirmed.data,
    }),
    [entries.data, charges.data, set, year, confirmed.data],
  );
  const health = useMemo(() => healthScore(k, set), [k, set]);
  const insights = useMemo(
    () => generateThematicInsights(k, set, clientStatsWithHours(entries.data ?? [], year, confirmed.data), charges.data ?? []),
    [k, set, entries.data, charges.data, year, confirmed.data],
  );
  const meta = HEALTH_META[health.level];

  // Groupe par thème
  const insightsByTheme = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const i of insights) {
      const arr = map.get(i.theme) ?? [];
      arr.push(i.text);
      map.set(i.theme, arr);
    }
    return [...map.entries()];
  }, [insights]);

  // AI chat
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const askMut = useMutation({
    mutationFn: (q: string) => askPilotAi({ data: { question: q } }),
    onSuccess: (r) => setAnswer(r.answer),
    onError: (e: Error) => toast.error(e.message),
  });

  if (entries.isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="flex flex-col items-center gap-3 pt-8">
          <div className="relative h-40 w-40">
            <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
              <circle cx="64" cy="64" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
              <circle cx="64" cy="64" r={R} fill="none" stroke={meta.color} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * health.score) / 100} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-serif text-4xl font-semibold">{health.score}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${meta.tone}`}>{meta.label}</span>
        </CardContent></Card>
        <Card><CardContent className="space-y-3 pt-6">
          <h3 className="font-medium">Détail de la note</h3>
          {health.breakdown.map((b) => (
            <div key={b.label} className="space-y-1" title={BREAKDOWN_DEFS[b.label]}>
              <div className="flex justify-between text-sm"><span>{b.label}</span><span className="font-medium">{b.value}/100</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${b.value}%` }} /></div>
            </div>
          ))}
        </CardContent></Card>
      </div>

      {/* Explications automatiques par thématique */}
      {insightsByTheme.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />Explications automatiques</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {insightsByTheme.map(([theme, texts]) => (
              <div key={theme} className="space-y-2">
                <Badge className={THEME_TONE[theme] ?? "bg-muted"}>{theme}</Badge>
                <ul className="space-y-1.5">
                  {texts.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assistant IA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4 text-primary" />Assistant IA CR Pro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Posez une question sur votre activité (CA, marge, clients, saisonnalité, objectifs…). L'IA interroge les données de votre application.</p>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. : Sur quels clients dois-je concentrer mes efforts commerciaux au T3 ?"
            className="min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => askMut.mutate(question)} disabled={askMut.isPending || question.trim().length < 3}>
              <Send className="mr-1.5 h-4 w-4" />{askMut.isPending ? "Analyse…" : "Interroger l'IA"}
            </Button>
          </div>
          {answer && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5" />Réponse</div>
              <div className="whitespace-pre-wrap leading-relaxed text-foreground">{answer}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}