// Classeur Pilot Pro : lecture, filtre, tri et édition manuelle cellule par
// cellule. Chaque modification est écrite dans la table d'origine et tracée
// dans le journal des modifications (annulable).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  displayCell,
  fetchRows,
  parseCell,
  updateCell,
  type ColumnDef,
  type DatasetDef,
} from "@/lib/pilot-edit";

type Row = Record<string, unknown>;

export function PilotDataGrid({ def }: { def: DatasetDef }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; asc: boolean } | null>(null);
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pilot-grid", def.id],
    queryFn: () => fetchRows(def),
  });

  const save = useMutation({
    mutationFn: async (p: { row: Row; col: ColumnDef; raw: string }) =>
      updateCell({
        def,
        row: p.row,
        field: p.col.key,
        value: parseCell(p.col.type, p.raw),
        reason,
      }),
    onSuccess: () => {
      toast.success("Modification enregistrée et tracée");
      setEditing(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["pilot-grid", def.id] });
      qc.invalidateQueries({ queryKey: ["pilot-edit-log"] });
    },
    onError: (e: Error) => toast.error(e.message || "Modification impossible"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = rows as Row[];
    if (q) {
      out = out.filter((r) =>
        def.searchFields.some((f) => String(r[f] ?? "").toLowerCase().includes(q)),
      );
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const va = a[sort.key];
        const vb = b[sort.key];
        if (typeof va === "number" && typeof vb === "number") return sort.asc ? va - vb : vb - va;
        return sort.asc
          ? displayCell(va).localeCompare(displayCell(vb), "fr")
          : displayCell(vb).localeCompare(displayCell(va), "fr");
      });
    }
    return out;
  }, [rows, search, sort, def.searchFields]);

  const startEdit = (row: Row, col: ColumnDef) => {
    setEditing({ id: String(row.id), key: col.key });
    setDraft(displayCell(row[col.key]));
    setReason("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer…"
          className="h-9 max-w-xs"
        />
        <Badge variant="outline">{filtered.length} ligne(s)</Badge>
        <span className="text-xs text-muted-foreground">
          Cliquez sur l'icône crayon d'une cellule pour la corriger : la valeur précédente est conservée.
        </span>
      </div>

      {editing && (
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif de la correction (facultatif)"
          className="h-9 max-w-md"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {def.columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={`cursor-pointer whitespace-nowrap ${c.width ?? ""}`}
                  onClick={() =>
                    setSort((s) => (s?.key === c.key ? { key: c.key, asc: !s.asc } : { key: c.key, asc: true }))
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort?.key === c.key &&
                      (sort.asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={def.columns.length} className="text-sm text-muted-foreground">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={def.columns.length} className="text-sm text-muted-foreground">
                  Aucune ligne.
                </TableCell>
              </TableRow>
            )}
            {filtered.slice(0, 400).map((row) => (
              <TableRow key={String(row.id)}>
                {def.columns.map((col) => {
                  const isEditing = editing?.id === String(row.id) && editing.key === col.key;
                  if (isEditing) {
                    return (
                      <TableCell key={col.key} className="min-w-[12rem]">
                        <div className="flex items-center gap-1">
                          {col.type === "select" && col.options ? (
                            <Select value={draft} onValueChange={setDraft}>
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {col.options.map((o) => (
                                  <SelectItem key={o} value={o}>
                                    {o}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              className="h-8"
                              type={col.type === "date" ? "date" : "text"}
                            />
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={save.isPending}
                            onClick={() => save.mutate({ row, col, raw: draft })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={col.key} className="group whitespace-nowrap text-sm">
                      <span className="align-middle">{displayCell(row[col.key]) || "—"}</span>
                      {col.editable && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="ml-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => startEdit(row, col)}
                          title="Corriger cette valeur"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filtered.length > 400 && (
        <p className="text-xs text-muted-foreground">
          Affichage limité aux 400 premières lignes : affinez le filtre pour voir les suivantes.
        </p>
      )}
    </div>
  );
}