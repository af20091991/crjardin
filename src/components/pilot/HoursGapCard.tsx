import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { usePilotMode } from "@/lib/pilot-mode";
import {
  aggregateHoursByClient,
  aggregateHoursByPrestation,
  fetchHoursLedger,
  formatHours,
} from "@/lib/pilot-hours-ledger";

/** Écarts heures vendues / réalisées, par prestation et par client. */
export function HoursGapCard({ year }: { year: number }) {
  const { mode } = usePilotMode();
  const q = useQuery({
    queryKey: ["pilot-hours-gap", year, mode],
    queryFn: async () => {
      const entries = await fetchHoursLedger(year, { mode });
      const prestations = aggregateHoursByPrestation(entries).slice(0, 6);
      const clients = [...aggregateHoursByClient(entries).values()]
        .filter((c) => c.reelles > 0 && c.vendues > 0)
        .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))
        .slice(0, 5);
      return { prestations, clients };
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" />
          Heures vendues vs réalisées ({year})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading && <Skeleton className="h-32 w-full" />}
        {q.data && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Par prestation</p>
              {q.data.prestations.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune heure sur la période.</p>
              )}
              {q.data.prestations.map((p) => (
                <div key={p.prestation} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-sm">
                  <span className="min-w-0 truncate">{p.prestation}</span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    {formatHours(p.vendues)} vendues ·{" "}
                    {p.reelles > 0 ? `${formatHours(p.reelles)} réalisées` : "réel non confirmé"}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Écarts clients les plus marqués</p>
              {q.data.clients.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun client ne dispose à la fois d'heures vendues et d'heures réelles confirmées.
                </p>
              )}
              {q.data.clients.map((c) => (
                <Link
                  key={c.clientId}
                  to="/pilot/fiche/$clientId"
                  params={{ clientId: c.clientId }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5 text-sm hover:bg-muted/50"
                >
                  <span className="min-w-0 truncate">{c.clientName}</span>
                  <span className={`shrink-0 text-xs ${c.ecart < 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {c.ecart >= 0 ? "+" : ""}
                    {formatHours(c.ecart)} · {formatHours(c.vendues)} vendues / {formatHours(c.reelles)} réelles
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
