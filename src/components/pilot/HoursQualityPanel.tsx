import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Timer } from "lucide-react";
import {
  HOURS_TYPE_META,
  aggregateHoursByClient,
  countInterventionsToConfirm,
  fetchHoursLedger,
  formatHours,
  hoursQuality,
} from "@/lib/pilot-hours-ledger";

/** Tableau de contrôle « Qualité des heures » — toutes sources confondues. */
export function HoursQualityPanel() {
  const q = useQuery({
    queryKey: ["pilot-hours-quality"],
    queryFn: async () => {
      const [entries, toConfirm] = await Promise.all([fetchHoursLedger(), countInterventionsToConfirm()]);
      const clients = aggregateHoursByClient(entries);
      const withReal = [...clients.values()].filter((c) => c.reelles > 0).length;
      return { quality: hoursQuality(entries, toConfirm), clients: clients.size, withReal };
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="h-4 w-4 text-primary" />
          Qualité des heures — vision consolidée
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading && <Skeleton className="h-40 w-full" />}
        {q.data && (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Couverture des heures rattachées à un client</span>
                <span className="font-semibold tabular-nums">{q.data.quality.coveragePct.toFixed(1)} %</span>
              </div>
              <Progress value={q.data.quality.coveragePct} />
              <p className="text-xs text-muted-foreground">
                {formatHours(q.data.quality.linkedHours)} rattachées sur {formatHours(q.data.quality.totalHours)} analysées
                {q.data.quality.pendingHours > 0
                  ? ` — ${formatHours(q.data.quality.pendingHours)} en attente de rattachement`
                  : " — aucune heure orpheline"}
              </p>
            </div>

            <div className="space-y-2">
              {q.data.quality.bySource.map((b) => {
                const meta = HOURS_TYPE_META[b.type];
                return (
                  <div
                    key={b.type}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5"
                  >
                    <div className="min-w-0">
                      <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{meta.origin}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold tabular-nums">{formatHours(b.linked)} reliées</p>
                      <p className="text-xs text-muted-foreground">
                        {b.lines} ligne(s) · {formatHours(b.total)} au total
                        {b.pending > 0 ? ` · ${formatHours(b.pending)} en attente` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Mini label="Interventions à confirmer" value={String(q.data.quality.interventionsToConfirm)} />
              <Mini label="Clients avec heures réelles" value={`${q.data.withReal} / ${q.data.clients}`} />
              <Mini label="Heures estimées (exclues des KPI)" value={formatHours(q.data.quality.estimatedHours)} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
