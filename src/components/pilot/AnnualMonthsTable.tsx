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

  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : null;
  const selectedMonth = activeMonth ?? currentMonth;

  return (
    <>
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
        </CardContent>
      </Card>

      {/*
       * Fresque unique : elle reprend la navigation mensuelle existante (mois + CA,
       * mois actif en vert foncé) et lui ajoute la règle de résultat rouge/verte.
       * Elle est volontairement hors de la carte annuelle, à l'emplacement de
       * l'ancienne fresque de navigation située juste au-dessus des cartes mensuelles.
       */}
      <div
        className="-mx-1 overflow-x-auto pb-1"
        aria-label="Chronologie mensuelle du CA et du résultat"
      >
        <div className="min-w-[720px] rounded-xl border border-border bg-card p-1">
          <div className="grid grid-cols-12 gap-1">
            {rows.map((r) => {
              const active = r.month === selectedMonth;
              const tone = monthResultTone(r.resultat, r.nature, active);
              const clickable = !!onMonthSelect;
              const content = (
                <>
                  <span className="truncate text-[10px] font-medium">{r.monthLabel.slice(0, 4)}</span>
                  <span className="mt-0.5 truncate text-[10px] tabular-nums">
                    {r.nature === "aucun" ? "—" : formatEuro(r.ventesHt)}
                  </span>
                </>
              );

              return clickable ? (
                <button
                  key={r.month}
                  type="button"
                  title={`${r.monthLabel} — CA HT ${
                    r.nature === "aucun" ? "aucun" : formatEuro(r.ventesHt)
                  } · résultat ${r.nature === "aucun" ? "aucun" : formatEuro(r.resultat)}`}
                  aria-pressed={active}
                  onClick={() => onMonthSelect?.(r.month)}
                  className={`min-w-0 rounded-lg px-1.5 py-2 text-center transition-opacity hover:opacity-85 ${tone}`}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={r.month}
                  title={`${r.monthLabel} — CA HT ${
                    r.nature === "aucun" ? "aucun" : formatEuro(r.ventesHt)
                  } · résultat ${r.nature === "aucun" ? "aucun" : formatEuro(r.resultat)}`}
                  className={`min-w-0 rounded-lg px-1.5 py-2 text-center ${tone}`}
                >
                  {content}
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[9px] text-muted-foreground">
            <span>Fond vert = résultat positif</span>
            <span>Fond rouge = résultat négatif</span>
            <span>Vert foncé = mois actif</span>
          </div>
        </div>
      </div>

      {/* Masque uniquement l'ancienne navigation CA, remplacée ci-dessus par la fresque unique. */}
      <style>{`
        .space-y-5 > div.-mx-1.overflow-x-auto.pb-1 { display: none !important; }
      `}</style>
    </>
  );
}
