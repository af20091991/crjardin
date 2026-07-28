import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, ChevronDown, ChevronUp } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import type { PilotEntry } from "@/lib/pilot";
import { listChargeRows } from "@/lib/pilot-charges";
import { annualSummary } from "@/lib/pilot-annual";
import { margeHealthScore, HEALTH_LEVEL_META, type PragmaticHealth } from "@/lib/pilot-health";
import { useThresholds } from "@/lib/pilot-thresholds";

/**
 * Vue annuelle multi-exercices : CA, charges, bénéfice brut et taux horaire
 * vendu par année. Aucune année n'est extrapolée : seules les années
 * réellement présentes dans les données apparaissent.
 */
export function AnnualPerformanceCard({
  entries,
  targetHourlyRate,
}: {
  entries: PilotEntry[];
  targetHourlyRate: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const chargesQ = useQuery({ queryKey: ["pilot-charge-rows"], queryFn: listChargeRows });
  const thresholds = useThresholds();
  const rows = useMemo(
    () => annualSummary(entries, chargesQ.data ?? []),
    [entries, chargesQ.data],
  );
  /**
   * Score de marge (0-100) par exercice, calculé avec le moteur unique
   * `margeHealthScore()` (src/lib/pilot-health.ts) — même seuils et même
   * fonction que la page Santé, pour éviter toute divergence de score.
   */
  const margeScoreLevel = (score: number | null): PragmaticHealth["level"] =>
    score == null ? "inconnu" : score >= 75 ? "solide" : score >= 55 ? "correct" : score >= 35 ? "fragile" : "critique";
  const currentYear = new Date().getFullYear();
  const current = rows.find((r) => r.year === currentYear) ?? null;
  const visibleRows = expanded ? rows : current ? [current] : rows.slice(0, 1);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <h3 className="font-medium">Performance annuelle</h3>
          <span className="text-xs text-muted-foreground">
            — bénéfice brut = CA HT − charges enregistrées sur l'exercice
          </span>
          <Badge variant="outline" className="ml-auto">{rows.length} exercices</Badge>
          {rows.length > 1 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Réduire" : "Tout afficher"}
            </Button>
          )}
        </div>

        {chargesQ.isLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucune donnée annuelle disponible.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Exercice</th>
                  <th className="px-3 py-2 text-right font-medium">CA HT</th>
                  <th className="px-3 py-2 text-right font-medium">Charges</th>
                  <th className="px-3 py-2 text-right font-medium">Bénéfice brut</th>
                  <th className="px-3 py-2 text-right font-medium">Marge</th>
                  <th className="px-3 py-2 text-right font-medium">Score marge</th>
                  <th className="px-3 py-2 text-right font-medium">Invest.</th>
                  <th className="px-3 py-2 text-right font-medium">Après invest.</th>
                  <th className="px-3 py-2 text-right font-medium">Heures vendues</th>
                  <th className="px-3 py-2 text-right font-medium">€/h vendu</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.year} className={r.year === currentYear ? "border-t bg-primary/5" : "border-t"}>
                    <td className="px-3 py-2 font-medium">{r.year}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatEuro(r.caHt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.charges > 0 ? formatEuro(r.charges) : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${r.charges > 0 ? (r.beneficeBrut >= 0 ? "text-emerald-700" : "text-rose-700") : "text-muted-foreground"}`}
                    >
                      {r.charges > 0 ? formatEuro(r.beneficeBrut) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.charges > 0 && r.margePct != null ? `${r.margePct.toFixed(0)} %` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {(() => {
                        const score = r.charges > 0 ? margeHealthScore(r.margePct, thresholds) : null;
                        const lvlMeta = HEALTH_LEVEL_META[margeScoreLevel(score)];
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lvlMeta.tone}`}>
                            {score == null ? "—" : `${score}/100`}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatEuro(r.investissements)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.resultatApresInvestissements >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatEuro(r.resultatApresInvestissements)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.heuresVendues > 0 ? `${r.heuresVendues.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} h` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.tauxHoraireVendu != null ? `${formatEuro(r.tauxHoraireVendu)}/h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Conversion de l'objectif en €/h : lecture directe pour le dirigeant. */}
        {targetHourlyRate > 0 && current && current.heuresVendues > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Tile
              label={`Objectif ${currentYear} en €/h`}
              value={`${formatEuro(targetHourlyRate)}/h`}
              hint="Cible définie dans les paramètres"
            />
            <Tile
              label="CA nécessaire à la cible"
              value={formatEuro(targetHourlyRate * current.heuresVendues)}
              hint={`Sur ${current.heuresVendues.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} h vendues ${currentYear}`}
            />
            <Tile
              label="Écart à la cible"
              value={formatEuro(current.caHt - targetHourlyRate * current.heuresVendues)}
              hint={
                current.tauxHoraireVendu != null
                  ? `Taux vendu actuel ${formatEuro(current.tauxHoraireVendu)}/h`
                  : "Taux vendu non calculable"
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}