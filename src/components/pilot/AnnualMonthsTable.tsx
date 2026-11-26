// Tableau « Année complète » : 12 mois de l'exercice, saisies telles quelles.
// Aucun calcul ici : tout vient de `pilot-ca-months.ts`.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const [personalizationMount, setPersonalizationMount] = useState<HTMLElement | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(
    () => activeMonth ?? (now.getFullYear() === year ? now.getMonth() + 1 : undefined),
  );

  useEffect(() => {
    if (activeMonth != null) setSelectedMonth(activeMonth);
  }, [activeMonth]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(INVESTMENTS_VISIBILITY_KEY);
      if (saved === "false") setShowInvestments(false);
    } catch {
      /* stockage local indisponible */
    }
  }, []);

  useEffect(() => {
    const applyFresqueWidth = () => {
      const root = document.querySelector<HTMLElement>(".pp-annual-ca-fresque");
      const monthNav = root?.nextElementSibling as HTMLElement | null;
      if (!monthNav) return;

      const nav = monthNav.firstElementChild as HTMLElement | null;
      if (nav) {
        nav.style.width = "100%";
        nav.style.minWidth = "912px";
        nav.style.display = "grid";
        nav.style.gridTemplateColumns = "repeat(12, minmax(0, 1fr))";
      }
      monthNav.style.width = "100%";
      monthNav.style.maxWidth = "100%";
      monthNav.style.overflowX = "auto";
      nav?.querySelectorAll<HTMLElement>("button").forEach((button) => {
        button.style.minWidth = "0";
        button.style.width = "100%";
      });
    };

    const findPersonalizationMount = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
      for (const dialog of dialogs) {
        const pageSection = Array.from(dialog.querySelectorAll<HTMLElement>("section")).find(
          (section) => section.querySelector("p")?.textContent?.trim() === "Page",
        );
        const options = pageSection?.querySelector<HTMLElement>("div.space-y-1");
        if (!options) continue;
        let mount = options.querySelector<HTMLElement>('[data-ca-investments-setting="true"]');
        if (!mount) {
          mount = document.createElement("div");
          mount.dataset.caInvestmentsSetting = "true";
          options.appendChild(mount);
        }
        setPersonalizationMount((current) => (current === mount ? current : mount));
        return;
      }
      setPersonalizationMount(null);
    };

    applyFresqueWidth();
    findPersonalizationMount();
    const observer = new MutationObserver(() => {
      applyFresqueWidth();
      findPersonalizationMount();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const mount = document.querySelector<HTMLElement>('[data-ca-investments-setting="true"]');
      mount?.remove();
    };
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
          "!bg-[color-mix(in_oklab,#4AAC33_18%,transparent)]",
          "!text-[#4F8E33]",
          "!bg-[color-mix(in_oklab,#EE8627_18%,transparent)]",
          "!text-[#EE8627]",
          "!bg-[#4F8E33]",
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
        setSelectedMonth(index + 1);
      };
      button.addEventListener("click", handleClick);
      return { button, handleClick };
    });

    return () => {
      listeners.forEach(({ button, handleClick }) =>
        button.removeEventListener("click", handleClick),
      );
    };
  }, [rows, selectedMonth]);

  const investmentSetting: ReactNode = personalizationMount
    ? createPortal(
        <label className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
          <span>Colonne investissements</span>
          <input
            type="checkbox"
            checked={showInvestments}
            onChange={(e) => {
              const next = e.target.checked;
              setShowInvestments(next);
              try {
                window.localStorage.setItem(INVESTMENTS_VISIBILITY_KEY, String(next));
              } catch {
                /* le réglage reste valable pour la session */
              }
            }}
          />
        </label>,
        personalizationMount,
      )
    : null;

  return (
    <>
      {investmentSetting}
      <Card className="pp-annual-ca-fresque">
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
    </>
  );
}
