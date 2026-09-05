// Tableaux triables et filtres texte pour le module Site web.
// Présentation uniquement : aucune règle métier, aucune donnée inventée.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export type SiteWebColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type SiteWebCell = { value: string | number; display: string };
export type SiteWebRow = Record<string, SiteWebCell>;

export type SiteWebSort = { key: string; direction: "asc" | "desc" };

function compare(a: SiteWebCell | undefined, b: SiteWebCell | undefined) {
  const av = a?.value ?? "";
  const bv = b?.value ?? "";
  if (typeof av === "number" && typeof bv === "number") return av - bv;
  return String(av).localeCompare(String(bv), "fr");
}

export function SortableTable({
  columns,
  rows,
  defaultSort,
}: {
  columns: SiteWebColumn[];
  rows: SiteWebRow[];
  defaultSort: SiteWebSort;
}) {
  const [sort, setSort] = useState<SiteWebSort>(defaultSort);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const result = compare(a[sort.key], b[sort.key]);
      return sort.direction === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sort]);

  const toggle = (key: string) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" },
    );

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          {columns.map((column) => {
            const active = sort.key === column.key;
            const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
            return (
              <th
                key={column.key}
                className={`pb-2 ${column.align === "left" ? "text-left" : "text-right"}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(column.key)}
                  aria-label={`Trier par ${column.label}`}
                  className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground ${
                    active ? "text-foreground" : ""
                  }`}
                >
                  {column.label}
                  <Icon className="h-3 w-3 opacity-60" />
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, rowIndex) => (
          <tr
            key={`${row[columns[0].key]?.display ?? "row"}-${rowIndex}`}
            className="border-t border-border/40"
          >
            {columns.map((column) => (
              <td
                key={column.key}
                className={`py-3 tabular-nums ${
                  column.align === "left" ? "text-left" : "text-right"
                }`}
              >
                {row[column.key]?.display ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Champ de recherche + seuil d'impressions au-dessus d'un tableau de requêtes. */
export function QueryFilters({
  search,
  onSearchChange,
  minImpressions,
  onMinImpressionsChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  minImpressions: number;
  onMinImpressionsChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher une requête…"
          className="h-9 pl-8 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Impressions minimum
        <Input
          type="number"
          min={0}
          value={String(minImpressions)}
          onChange={(event) => onMinImpressionsChange(Math.max(0, Number(event.target.value) || 0))}
          className="h-9 w-24 text-sm tabular-nums"
        />
      </label>
    </div>
  );
}
