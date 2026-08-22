// Outil unique de validation de la nature des lignes financières.
// Tableau simple : Désignation · Emplacement · Montant · un clic pour décider.
// Aucun calcul ici : la décision est écrite par pilot-nature-validation.ts.
import { useState } from "react";
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
const euro = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

function NatureRow({ row, onDone }: { row: NatureLine; onDone: () => void }) {
  const m = useMutation({
    mutationFn: (nature: LineNature) => setLineNature(row, nature),
    onSuccess: () => {
      toast.success("Nature enregistrée — décision historisée");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <tr className="border-t border-border align-middle">
      <td className="py-2 pr-3">
        <span className="text-sm font-medium">{row.designation}</span>
        <span className="ml-2 text-xs text-muted-foreground">
          {String(row.month).padStart(2, "0")}/{row.year}
        </span>
      </td>
      <td className="py-2 pr-3">
        <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
          {row.placement}
        </span>
      </td>
      <td className="py-2 pr-3 text-right text-sm font-semibold tabular-nums">{euro(row.amount)}</td>
      <td className="py-2">
        <div className="flex flex-wrap justify-end gap-1.5">
          {NATURES.map((n) => (
            <Button
              key={n}
              size="sm"
              variant={n === "vente" ? "secondary" : "outline"}
              className="h-7 px-2 text-xs"
              disabled={m.isPending}
              onClick={() => m.mutate(n)}
            >
              {NATURE_LABELS[n]}
            </Button>
          ))}
        </div>
      </td>
    </tr>
  );
}

export function NatureValidationTable() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["nature-validation"], queryFn: () => listLinesToValidate() });
  const [limit, setLimit] = useState(25);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["nature-validation"] });
    qc.invalidateQueries({ queryKey: ["fix", "charges"] });
    qc.invalidateQueries({ queryKey: ["fix-plan"] });
  };
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = q.data ?? [];
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Aucune ligne en attente : toutes les natures sont validées.
      </p>
    );
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} ligne(s) à qualifier, soit {euro(total)}. Un clic suffit : le montant, la date
        et le libellé d'origine ne sont jamais modifiés, et chaque décision est historisée.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[40rem] text-left">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Désignation</th>
              <th className="px-3 py-2 font-medium">Emplacement actuel</th>
              <th className="px-3 py-2 text-right font-medium">Montant HT</th>
              <th className="px-3 py-2 text-right font-medium">Choix</th>
            </tr>
          </thead>
          <tbody className="[&_td:first-child]:pl-3 [&_td:last-child]:pr-3">
            {rows.slice(0, limit).map((r) => (
              <NatureRow key={r.id} row={r} onDone={refresh} />
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit(limit + 25)}>
          Afficher 25 lignes de plus
        </Button>
      )}
    </div>
  );
}
