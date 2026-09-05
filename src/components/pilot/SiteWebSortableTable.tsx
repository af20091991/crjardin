import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCcw, Search } from "lucide-react";

export type ColumnTone = "positive" | "warning" | "negative" | "neutral";

export type SortableColumn<Row> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: Row) => string;
  sortValue: (row: Row) => number | string;
  /** Couleur optionnelle de la cellule (ex: CTR faible en rouge, position top en vert). */
  tone?: (row: Row) => ColumnTone | null;
};

const toneClasses: Record<ColumnTone, string> = {
  positive: "text-emerald-700",
  warning: "text-amber-700",
  negative: "text-destructive",
  neutral: "",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

/**
 * Tableau générique triable par en-tête de colonne, avec recherche texte,
 * filtre "impressions minimum", pagination, et mise en avant colorée
 * optionnelle par cellule (ex: signaler une ligne à fort potentiel).
 * Réutilisé par les différentes vues Site Web pour éviter de dupliquer la
 * logique de tri/filtrage/pagination à chaque fois.
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
  highlightRow,
}: {
  columns: Array<SortableColumn<Row>>;
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  searchField?: (row: Row) => string;
  searchPlaceholder?: string;
  minImpressionsField?: (row: Row) => number;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
  /** Marque une ligne comme "à fort potentiel" (léger fond coloré + pastille). */
  highlightRow?: (row: Row) => boolean;
}) {
  const [search, setSearch] = useState("");
  const [minImpressions, setMinImpressions] = useState(0);
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey ?? columns[0]?.key);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);

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

  // Revenir à la première page à chaque changement de filtre/tri, pour éviter
  // de se retrouver sur une page vide.
  useEffect(() => {
    setPage(0);
  }, [search, minImpressions, sortKey, sortDirection, pageSize]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const paginated = useMemo(
    () => sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [sorted, currentPage, pageSize],
  );

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const hasActiveFilters = Boolean(search) || minImpressions > 0;
  const resetFilters = () => {
    setSearch("");
    setMinImpressions(0);
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
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Réinitialiser
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {sorted.length} / {rows.length} lignes
          </span>
        </div>
      )}
      <div className="max-h-[28rem] overflow-y-auto overflow-x-auto rounded-md border border-border/40">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              {columns.map((column) => {
                const active = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={`border-b border-border/60 bg-card px-3 ${
                      column.align === "left" ? "" : "text-right"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={`inline-flex items-center gap-1 py-2.5 transition-colors hover:text-foreground ${
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
            {paginated.map((row, index) => {
              const highlighted = highlightRow?.(row) ?? false;
              return (
                <tr
                  key={getRowKey(row, currentPage * pageSize + index)}
                  className={`border-t border-border/40 transition-colors hover:bg-muted/30 ${
                    highlighted ? "bg-primary/5" : index % 2 === 1 ? "bg-muted/10" : ""
                  }`}
                >
                  {columns.map((column, columnIndex) => {
                    const tone = column.tone?.(row) ?? null;
                    return (
                      <td
                        key={column.key}
                        className={`px-3 py-2.5 tabular-nums ${
                          column.align === "left" ? "text-left" : "text-right"
                        } ${tone ? toneClasses[tone] : ""}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {columnIndex === 0 && highlighted && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                              aria-label="À fort potentiel"
                            />
                          )}
                          {column.render(row)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucune ligne ne correspond à ces critères.
        </p>
      )}
      {sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            Lignes par page
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-7 rounded-md border border-border bg-background px-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <span>
              Page {currentPage + 1} / {pageCount}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
              >
                Précédent
              </button>
              <button
                type="button"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
