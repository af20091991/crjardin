import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DatabaseZap } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import { getReconstructionSummary, MATCH_STATUS_META } from "@/lib/pilot-reconstruction";

const pct = (n: number) => `${n.toFixed(1)} %`;

/** Tableau de contrôle de la reconstruction du référentiel client. */
export function ReconstructionPanel() {
  const q = useQuery({ queryKey: ["pilot-reconstruction"], queryFn: getReconstructionSummary });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DatabaseZap className="h-4 w-4 text-primary" />
          Tableau de contrôle — reconstruction du référentiel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading && <Skeleton className="h-32 w-full" />}
        {q.data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Lignes CA analysées" value={String(q.data.totalLines)} sub={`${pct(q.data.processedPct)} traitées`} />
              <Stat label="Lignes rattachées" value={pct(q.data.coveredLinesPct)} sub={`${q.data.coveredLines} lignes`} />
              <Stat label="Montant CA couvert" value={pct(q.data.coveredAmountPct)} sub={`${formatEuro(q.data.coveredAmount)} / ${formatEuro(q.data.totalAmount)}`} />
            </div>

            <div className="space-y-1">
              <Progress value={q.data.coveredAmountPct} />
              <p className="text-xs text-muted-foreground">
                {q.data.createdClients} fiche(s) client créée(s) depuis l'historique CA — à compléter manuellement.
              </p>
            </div>

            <div className="space-y-2">
              {q.data.buckets.map((b) => {
                const meta = MATCH_STATUS_META[b.status];
                return (
                  <div key={b.status} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                    <div className="min-w-0">
                      <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{meta.hint}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{b.lines} ligne(s)</p>
                      <p className="text-xs text-muted-foreground">{formatEuro(b.amount)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
