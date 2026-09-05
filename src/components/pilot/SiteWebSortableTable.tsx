import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

export type SortableColumn<Row> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => string;
  sortValue: (row: Row) => number | string;
};

/**
 * Tableau générique triable par en-tête de colonne, avec un champ de
 * recherche texte optionnel (filtre sur un champ au choix) et un filtre
 * "impressions minimum" optionnel. Pensé pour être réutilisé par les
 * différentes vues Site Web (requêtes locales, pages, etc.) sans dupliquer la
 * logique de tri/filtrage à chaque fois.
 */
export function SortableDataTable<Row>({
  columns,
  rows,
  getRowKey,
  searchField,
  searchPlaceholder = "Rechercher…",
  minImpressionsField,
  defaultSortKey,
  defaultSortDirection = "desc",
}: {
  columns: Array<SortableColumn<Row>>;
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  searchField?: (row: Row) => string;
  searchPlaceholder?: string;
  minImpressionsField?: (row: Row) => number;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
}) {
  const [search, setSearch] = useState("");
  const [minImpressions, setMinImpressions] = useState(0);
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey ?? columns[0]?.key);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);

  const filtered = useMemo(() => {
    let result = rows;
    if (searchField && search.trim()) {
      const needle = search.trim().toLowerCase();
      result = result.filter((row) => searchField(row).toLowerCase().includes(needle));
    }
    if (minImpressionsField && minImpressions > 0) {
      result = result.filter((row) => minImpressionsField(row) >= minImpressions);
    }
    return result;
  }, [rows, search, minImpressions, searchField, minImpressionsField]);

  const sorted = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const valueA = column.sortValue(a);
      const valueB = column.sortValue(b);
      const comparison =
        typeof valueA === "number" && typeof valueB === "number"
          ? valueA - valueB
          : String(valueA).localeCompare(String(valueB));
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return copy;
  }, [filtered, columns, sortKey, sortDirection]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const showToolbar = Boolean(searchField || minImpressionsField);

  return (
    <div>
      {showToolbar && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {searchField && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-56 rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}
          {minImpressionsField && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Impressions min.
              <input
                type="number"
                min={0}
                value={minImpressions || ""}
                onChange={(event) => setMinImpressions(Number(event.target.value) || 0)}
                placeholder="0"
                className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          )}
          <span className="text-xs text-muted-foreground">
            {sorted.length} / {rows.length} lignes
          </span>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((column) => {
              const active = sortKey === column.key;
              return (
                <th key={column.key} className={column.align === "left" ? "" : "text-right"}>
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={`inline-flex items-center gap-1 pb-2 transition-colors hover:text-foreground ${
                      column.align === "left" ? "" : "flex-row-reverse"
                    } ${active ? "text-foreground" : ""}`}
                  >
                    {column.label}
                    {active ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={getRowKey(row, index)} className="border-t border-border/40">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`py-3 tabular-nums ${column.align === "left" ? "text-left" : "text-right"}`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucune ligne ne correspond à ces critères.
        </p>
      )}
    </div>
  );
}
