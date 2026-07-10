import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { usePilotData } from "@/components/pilot/usePilotData";
import { computeKpis, healthScore, HEALTH_META, generateInsights, clientStats, DEFAULT_SETTINGS } from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pilot/sante")({
  component: SantePage,
});

function SantePage() {
  const { entries, charges, objectives, settings } = usePilotData();
  const year = new Date().getFullYear();
  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const k = useMemo(
    () => computeKpis({ entries: entries.data ?? [], charges: charges.data ?? [], objectives: objectives.data ?? [], settings: set, year, month: new Date().getMonth() }),
    [entries.data, charges.data, objectives.data, set, year],
  );
  const health = useMemo(() => healthScore(k, set), [k, set]);
  const insights = useMemo(() => generateInsights(k, set, clientStats(entries.data ?? [], year)), [k, set, entries.data, year]);
  const meta = HEALTH_META[health.level];

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
            <div key={b.label} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{b.label}</span><span className="font-medium">{b.value}/100</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${b.value}%` }} /></div>
            </div>
          ))}
        </CardContent></Card>
      </div>
      {insights.length > 0 && (
        <Card><CardContent className="space-y-2 pt-6">
          <h3 className="font-medium">Explications automatiques</h3>
          <ul className="space-y-1.5">
            {insights.map((t, i) => <li key={i} className="flex gap-2 text-sm text-muted-foreground"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{t}</li>)}
          </ul>
        </CardContent></Card>
      )}
    </div>
  );
}