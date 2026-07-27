import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { listEntries, getSettings, formatEuro, DEFAULT_SETTINGS } from "@/lib/pilot";
import { fetchHoursLedger, formatHours } from "@/lib/pilot-hours-ledger";
import { classifyClients, PROFIT_CLASS_META } from "@/lib/pilot-client-profitability";
import { suggestCrossSell, formatMonths } from "@/lib/pilot-cross-sell";
import { useThresholds } from "@/lib/pilot-thresholds";
import { currentYear } from "@/lib/date-utils";
import { usePilotMode } from "@/lib/pilot-mode";

/**
 * Analyse 360° d'un client : rentabilité classée + ventes additionnelles
 * déduites de l'historique. Aucune saisie n'est demandée ; si les données
 * sont insuffisantes, PP l'indique explicitement.
 */
export function ClientProfitabilityCard({
  clientId,
  interventions,
}: {
  clientId: string;
  interventions: number;
}) {
  const year = currentYear();
  const { mode } = usePilotMode();
  const thresholds = useThresholds();
  const entriesQ = useQuery({ queryKey: ["pilot-entries"], queryFn: listEntries });
  const ledgerQ = useQuery({
    queryKey: ["pilot-hours-ledger-all", mode],
    queryFn: () => fetchHoursLedger(undefined, { mode }),
  });
  const settingsQ = useQuery({ queryKey: ["pilot-settings"], queryFn: getSettings });

  const target = settingsQ.data?.target_hourly_rate ?? DEFAULT_SETTINGS.target_hourly_rate;

  const row = useMemo(() => {
    if (!entriesQ.data || !ledgerQ.data) return null;
    return (
      classifyClients({
        entries: entriesQ.data,
        ledger: ledgerQ.data,
        year,
        targetHourlyRate: target,
        thresholds,
        interventionsByClient: new Map([[clientId, interventions]]),
      }).find((r) => r.clientId === clientId) ?? null
    );
  }, [entriesQ.data, ledgerQ.data, year, target, thresholds, clientId, interventions]);

  const suggestions = useMemo(
    () => (entriesQ.data ? suggestCrossSell({ clientId, entries: entriesQ.data }) : []),
    [entriesQ.data, clientId],
  );

  const loading = entriesQ.isLoading || ledgerQ.isLoading || settingsQ.isLoading;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-primary" />
            Rentabilité client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : !row ? (
            <p className="text-sm text-muted-foreground">
              Aucune donnée économique exploitable pour ce client.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={PROFIT_CLASS_META[row.classe].badge}>
                  {PROFIT_CLASS_META[row.classe].label}
                </Badge>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  confiance {row.confidence}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Cell label="CA cumulé" value={formatEuro(row.caTotal)} />
                <Cell label={`CA ${year}`} value={formatEuro(row.caYear)} />
                <Cell
                  label="Évolution"
                  value={
                    row.evolutionPct == null
                      ? "—"
                      : `${row.evolutionPct >= 0 ? "+" : ""}${row.evolutionPct.toFixed(0)} %`
                  }
                  icon={
                    row.evolutionPct == null ? undefined : row.evolutionPct >= 0 ? "up" : "down"
                  }
                />
                <Cell
                  label="Heures consacrées"
                  value={row.hours > 0 ? formatHours(row.hours) : "—"}
                  hint={row.hoursSource === "aucune" ? undefined : `source : ${row.hoursSource}`}
                />
                <Cell label="Interventions" value={String(row.interventions)} />
                <Cell
                  label="Taux horaire généré"
                  value={row.tauxHoraire == null ? "—" : `${formatEuro(row.tauxHoraire)}/h`}
                />
              </div>
              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Pourquoi ce classement ? </span>
                {row.why}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Ventes additionnelles à proposer
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Historique insuffisant pour proposer une vente additionnelle fiable.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {suggestions.map((s) => (
                <li key={s.prestation} className="rounded-lg border border-border/60 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{s.prestation}</p>
                    <Badge variant="secondary" className="ml-auto tabular-nums">
                      ~ {formatEuro(s.potentiel)}
                    </Badge>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      confiance {s.confidence}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.justification}</p>
                  {s.saison.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Saison : {formatMonths(s.saison)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: "up" | "down";
}) {
  return (
    <div className="rounded-lg border border-border/60 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 font-medium tabular-nums">
        {icon === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
        {icon === "down" && <TrendingDown className="h-3.5 w-3.5 text-orange-600" />}
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
