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
  activeMonth,
  onMonthSelect,
}: {
  entries: CaEntry[];
  year: number;
  period: PeriodMode;
  now?: Date;
  activeMonth?: number;
  onMonthSelect?: (month: number) => void;
}) {
  const rows = monthlyCaRows(entries, year, { now, period });
  const totals = monthlyCaTotals(rows);
  const [showInvestments, setShowInvestments] = useState(true);
  const selectedMonth =
    activeMonth ?? (now.getFullYear() === year ? now.getMonth() + 1 : undefined);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(INVESTMENTS_VISIBILITY_KEY);
      if (saved === "false") setShowInvestments(false);
    } catch {
      /* stockage local indisponible */
    }
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".pp-annual-ca-fresque");
    const monthNav = root?.nextElementSibling;
    if (!monthNav) return;

    const buttons = Array.from(monthNav.querySelectorAll<HTMLButtonElement>("button"));
    const styleButtons = (activeIndex: number | null) => {
      buttons.forEach((button, index) => {
        const row = rows[index];
        if (!row) return;

        const active = index === activeIndex;
        const tone = monthResultTone(row.resultat, row.nature, active);
        button.classList.remove(
          "!bg-emerald-100",
          "!text-emerald-800",
          "!bg-rose-100",
          "!text-rose-800",
          "!bg-muted",
          "!text-muted-foreground",
          "!bg-emerald-700",
          "!text-white",
        );
        tone.split(" ").forEach((className) => button.classList.add(`!${className}`));

        let result = button.querySelector<HTMLElement>(".pp-month-result");
        if (!result) {
          result = document.createElement("span");
          result.className = "pp-month-result text-[10px] tabular-nums opacity-80";
          button.appendChild(result);
        }
        result.textContent = row.nature === "aucun" ? "—" : formatEuro(row.resultat);
      });
    };

    styleButtons(selectedMonth ? selectedMonth - 1 : null);

    const listeners = buttons.map((button, index) => {
      const handleClick = () => {
        window.setTimeout(() => styleButtons(index), 0);
      };
      button.addEventListener("click", handleClick);
      return { button, handleClick };
    });

    return () => {
      listeners.forEach(({ button, handleClick }) =>
        button.removeEventListener("click", handleClick),
      );
    };
  }, [rows, selectedMonth, onMonthSelect]);

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

  return (
    <Card className="pp-annual-ca-fresque">
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
      </CardContent>
    </Card>
  );
}
