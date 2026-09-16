// Tableau « Année complète » : 12 mois de l'exercice, saisies telles quelles.
// Aucun calcul ici : tout vient de `pilot-ca-months.ts`.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/lib/pilot";
import type { CaEntry } from "@/lib/pilot-ca";
import {
  MONTH_NATURE_LABELS,
  monthlyCaRows,
  monthlyCaTotals,
  type MonthNature,
} from "@/lib/pilot-ca-months";
import { periodScopeLabel, type PeriodMode } from "@/lib/pilot-realized";
import { monthResultTone } from "@/lib/pilot-ca-month-status";

const NATURE_TONE: Record<MonthNature, string> = {
  realise_a_date: "border-emerald-300 text-emerald-700",
  saisi_futur: "border-amber-300 text-amber-700",
  aucun: "text-muted-foreground",
};

const INVESTMENTS_VISIBILITY_KEY = "pilot-ca-annual-investments-visible-v1";

export function AnnualMonthsTable({
  entries,
  year,
  period,
  now = new Date(),
}: {
  entries: CaEntry[];
  year: number;
  period: PeriodMode;
  now?: Date;
}) {
  const rows = monthlyCaRows(entries, year, { now, period }, true);
  const totals = monthlyCaTotals(rows);
  const [showInvestments, setShowInvestments] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(INVESTMENTS_VISIBILITY_KEY);
      if (saved === "false") setShowInvestments(false);
    } catch {
      /* stockage local indisponible */
    }
  }, []);

  const toggleInvestments = () => {
    setShowInvestments((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(INVESTMENTS_VISIBILITY_KEY, String(next));
      } catch {
        /* le réglage reste valable pour la session */
      }
      return next;
    });
  };

  const activeMonth = now.getFullYear() === year ? now.getMonth() + 1 : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Exercice {year} — les 12 mois</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{periodScopeLabel(year, period, now)}</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={toggleInvestments}
            >
              {showInvestments ? "Masquer investissements" : "Afficher investissements"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mois</TableHead>
              <TableHead className="text-right">Ventes saisies</TableHead>
              <TableHead className="text-right">Charges saisies</TableHead>
              {showInvestments && <TableHead className="text-right">Investissements</TableHead>}
              <TableHead className="text-right">Résultat des saisies</TableHead>
              <TableHead>Nature</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.month}
                className={r.nature === "aucun" ? "text-muted-foreground" : ""}
              >
                <TableCell className="font-medium">{r.monthLabel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.nature === "aucun" ? "—" : formatEuro(r.ventesHt)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-rose-600">
                  {r.nature === "aucun" ? "—" : formatEuro(r.chargesHt)}
                </TableCell>
                {showInvestments && (
                  <TableCell className="text-right tabular-nums text-sky-600">
                    {r.investissements ? formatEuro(r.investissements) : "—"}
                  </TableCell>
                )}
                <TableCell
                  className={`text-right tabular-nums ${
                    r.nature === "aucun"
                      ? ""
                      : r.resultat >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                  }`}
                >
                  {r.nature === "aucun" ? "—" : formatEuro(r.resultat)}
                </TableCell>
                <TableCell>
                  <span className={`text-xs ${NATURE_TONE[r.nature]}`}>
                    {MONTH_NATURE_LABELS[r.nature]}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-semibold">
              <TableCell>Total exercice</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatEuro(totals.ventesHt)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-rose-600">
                {formatEuro(totals.chargesHt)}
              </TableCell>
              {showInvestments && (
                <TableCell className="text-right tabular-nums text-sky-600">
                  {totals.investissements ? formatEuro(totals.investissements) : "—"}
                </TableCell>
              )}
              <TableCell
                className={`text-right tabular-nums ${
                  totals.resultat >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatEuro(totals.resultat)}
              </TableCell>
              <TableCell className="text-xs font-normal text-muted-foreground">
                {totals.monthsWithData} mois renseigné(s)
                {totals.monthsFuture > 0 ? ` · dont ${totals.monthsFuture} à venir` : ""}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2" aria-label="Chronologie des résultats mensuels">
          <div className="grid grid-cols-12 gap-1">
            {rows.map((r) => {
              const active = r.month === activeMonth;
              const tone = monthResultTone(r.resultat, r.nature, active);
              return (
                <div
                  key={r.month}
                  title={`${r.monthLabel} — ${r.nature === "aucun" ? "aucune donnée" : formatEuro(r.resultat)}`}
                  className={`min-w-0 rounded-md px-1 py-2 text-center text-[10px] font-medium ${tone}`}
                >
                  {r.monthLabel.slice(0, 3)}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
