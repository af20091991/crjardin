import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro } from "@/lib/pilot";
import type { CaEntry } from "@/lib/pilot-ca";
import {
  MONTH_NATURE_LABELS,
  monthlyCaRows,
  monthlyCaTotals,
  type MonthNature,
} from "@/lib/pilot-ca-months";
import { periodScopeLabel, type PeriodMode } from "@/lib/pilot-realized";

const NATURE_TONE: Record<MonthNature, string> = {
  realise_a_date: "border-emerald-300 text-emerald-700",
  saisi_futur: "border-amber-300 text-amber-700",
  aucun: "text-muted-foreground",
};

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
  const [showInvestments, setShowInvestments] = useState(true);

  // IMPORTANT : ne jamais activer la propagation automatique des charges fixes.
  // Chaque mois doit afficher uniquement les lignes réellement saisies pour ce mois.
  const rows = monthlyCaRows(entries, year, { now, period }, false);
  const totals = monthlyCaTotals(rows);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Exercice {year} — les 12 mois</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowInvestments((visible) => !visible)}
              aria-pressed={showInvestments}
              title={showInvestments ? "Masquer la colonne Investissements" : "Afficher la colonne Investissements"}
            >
              {showInvestments ? "Masquer investissements" : "Afficher investissements"}
            </Button>
            <Badge variant="outline">{periodScopeLabel(year, period, now)}</Badge>
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
              {showInvestments ? (
                <TableHead className="text-right">Investissements</TableHead>
              ) : null}
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
                {showInvestments ? (
                  <TableCell className="text-right tabular-nums text-sky-600">
                    {r.investissements ? formatEuro(r.investissements) : "—"}
                  </TableCell>
                ) : null}
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
              {showInvestments ? (
                <TableCell className="text-right tabular-nums text-sky-600">
                  {totals.investissements ? formatEuro(totals.investissements) : "—"}
                </TableCell>
              ) : null}
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
      </CardContent>
    </Card>
  );
}
