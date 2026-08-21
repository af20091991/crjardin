// Tableau « Année complète » : 12 mois de l'exercice, saisies telles quelles.
// Aucun calcul ici : tout vient de `pilot-ca-months.ts`.
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
  const rows = monthlyCaRows(entries, year, { now, period });
  const totals = monthlyCaTotals(rows);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Exercice {year} — les 12 mois</CardTitle>
          <Badge variant="outline">{periodScopeLabel(year, period, now)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mois</TableHead>
              <TableHead className="text-right">Ventes saisies</TableHead>
              <TableHead className="text-right">Charges saisies</TableHead>
              <TableHead className="text-right">Résultat des saisies</TableHead>
              <TableHead>Nature</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.month} className={r.nature === "aucun" ? "text-muted-foreground" : ""}>
                <TableCell className="font-medium">{r.monthLabel}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.nature === "aucun" ? "—" : formatEuro(r.ventesHt)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-rose-600">
                  {r.nature === "aucun" ? "—" : formatEuro(r.chargesHt)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    r.nature === "aucun" ? "" : r.resultat >= 0 ? "text-emerald-600" : "text-rose-600"
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
              <TableCell className="text-right tabular-nums">{formatEuro(totals.ventesHt)}</TableCell>
              <TableCell className="text-right tabular-nums text-rose-600">
                {formatEuro(totals.chargesHt)}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${totals.resultat >= 0 ? "text-emerald-600" : "text-rose-600"}`}
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
