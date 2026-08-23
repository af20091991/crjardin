// Tableau des natures à qualifier : toutes les lignes en attente sont visibles
// simultanément, avec pagination « Afficher 25 lignes de plus » et un choix de
// nature directement sur chaque ligne.
// Aucun calcul ici : la décision est écrite par pilot-nature-validation.ts.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NATURE_CHOICES,
  NATURE_LABELS,
  listLinesToValidate,
  setLineNature,
  type LineNature,
  type NatureLine,
} from "@/lib/pilot-nature-validation";

const NATURES: LineNature[] = NATURE_CHOICES;
const PAGE_SIZE = 25;
const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

export function NatureValidationTable({ rows }: { rows?: NatureLine[] } = {}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["nature-validation"],
    queryFn: () => listLinesToValidate(),
    enabled: rows === undefined,
  });
  const [done, setDone] = useState<string[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const all = useMemo(
    () => (rows ?? q.data ?? []).filter((r) => !done.includes(r.id)),
    [rows, q.data, done],
  );
  const shown = all.slice(0, visible);

  const m = useMutation({
    mutationFn: ({ row, nature }: { row: NatureLine; nature: LineNature }) =>
      setLineNature(row, nature),
    onSuccess: (_d, v) => {
      setDone((prev) => [...prev, v.row.id]);
      toast.success(`${NATURE_LABELS[v.nature]} enregistrée`);
      qc.invalidateQueries({ queryKey: ["fix", "charges"] });
      qc.invalidateQueries({ queryKey: ["fix-plan"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (rows === undefined && q.isLoading) return <Skeleton className="h-56 w-full" />;

  if (all.length === 0)
    return <p className="text-sm text-muted-foreground">Aucune donnée à valider.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Désignation</th>
              <th className="px-3 py-2">Emplacement</th>
              <th className="px-3 py-2">Période</th>
              <th className="px-3 py-2 text-right">Montant HT</th>
              <th className="px-3 py-2">Nature retenue</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} data-nature-row={row.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{row.designation}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.placement}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {String(row.month).padStart(2, "0")}/{row.year}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{euro(row.amount)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {NATURES.map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={n === "vente" ? "default" : "secondary"}
                        disabled={m.isPending}
                        onClick={() => m.mutate({ row, nature: n })}
                      >
                        {NATURE_LABELS[n]}
                      </Button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {shown.length} / {all.length} ligne(s) affichée(s)
        </span>
        {all.length > shown.length && (
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Afficher {PAGE_SIZE} lignes de plus
          </Button>
        )}
      </div>
    </div>
  );
}
