import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";
import type { Kpis, PilotEntry, PilotSettings } from "@/lib/pilot";
import { listChargeRows, listSalesByYear, analyzeCharges, projectionBase } from "@/lib/pilot-charges";
import { fetchHoursLedger } from "@/lib/pilot-hours-ledger";
import { resolveRealHours } from "@/lib/pilot-real-hours";
import { annualSummary } from "@/lib/pilot-annual";
import { buildPortfolio } from "@/lib/pilot-portfolio";
import { useEntityStatuses } from "@/lib/pilot-entity-rules";
import { getClientEconomicScores } from "@/lib/client-score";
import { buildDirectorInsights, type InsightTone } from "@/lib/pilot-director-insights";
import { usePilotMode } from "@/lib/pilot-mode";

const TONE_STYLE: Record<InsightTone, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-primary",
  warning: "bg-orange-500",
};

/**
 * Analyse automatique du dirigeant : 10 informations utiles affichées par
 * défaut, le reste sur demande. Une information n'apparaît que si toutes ses
 * données existent réellement dans Pilot Pro.
 */
export function DirectorInsightsCard({
  k,
  settings,
  entries,
  year,
  opportunities,
}: {
  k: Kpis;
  settings: PilotSettings;
  entries: PilotEntry[];
  year: number;
  opportunities?: { pendingValue: number; acceptedValue: number; invoicedCa: number } | null;
}) {
  const { mode } = usePilotMode();
  const [expanded, setExpanded] = useState(false);

  const chargesQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const salesQ = useQuery({ queryKey: ["pilot-sales-by-year", mode], queryFn: () => listSalesByYear({ mode }) });
  const ledgerQ = useQuery({ queryKey: ["pilot-hours-ledger", year, mode], queryFn: () => fetchHoursLedger(year, { mode }) });
  const scoresQ = useQuery({ queryKey: ["client-economic-scores"], queryFn: getClientEconomicScores });
  const statusesQ = useEntityStatuses();

  const loading = chargesQ.isLoading || salesQ.isLoading || ledgerQ.isLoading || scoresQ.isLoading;

  const insights = useMemo(() => {
    const chargeRows = chargesQ.data ?? [];
    const sales = salesQ.data ?? new Map<number, number>();
    const ledger = ledgerQ.data ?? [];
    return buildDirectorInsights({
      k,
      settings,
      annual: annualSummary(entries, chargeRows, { mode }),
      charges: chargeRows.length > 0 ? analyzeCharges(chargeRows, sales, [], { mode }) : null,
      projection: chargeRows.length > 0 ? projectionBase(chargeRows, year, sales) : null,
      portfolio: buildPortfolio({ entries, ledger, scores: scoresQ.data ?? [], year, statuses: statusesQ.data }),
      hours: ledger.length > 0 ? resolveRealHours(ledger, year) : null,
      opportunities: opportunities ?? null,
      year,
    });
  }, [k, settings, entries, year, opportunities, chargesQ.data, salesQ.data, ledgerQ.data, scoresQ.data, statusesQ.data, mode]);

  const visible = expanded ? insights : insights.slice(0, 10);

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Analyse automatique</h3>
          <span className="text-xs text-muted-foreground">— uniquement des données vérifiées</span>
          <Badge variant="outline" className="ml-auto">{insights.length}</Badge>
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : insights.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Pas assez de données fiables pour produire une analyse.
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {visible.map((i) => (
                <li key={i.id} className="flex gap-2.5 text-sm">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_STYLE[i.tone]}`} />
                  <span className="min-w-0">
                    <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {i.theme}
                    </span>
                    <span className="text-foreground">{i.text}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Donnée : {i.source} · Décision : {i.decision}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {insights.length > 10 && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
                {expanded ? (
                  <>
                    <ChevronUp className="mr-1 h-4 w-4" /> Réduire
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-4 w-4" /> Voir les {insights.length - 10} analyses complémentaires
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}