// File de traitement des natures : une ligne à la fois, un clic, ligne suivante.
// Aucun calcul ici : la décision est écrite par pilot-nature-validation.ts.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkipForward } from "lucide-react";
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

export function NatureValidationTable() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["nature-validation"], queryFn: () => listLinesToValidate() });
  const [done, setDone] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);

  const queue = useMemo(() => {
    const rows = (q.data ?? []).filter((r) => !done.includes(r.id));
    const pending = rows.filter((r) => !skipped.includes(r.id));
    const later = rows.filter((r) => skipped.includes(r.id));
    return [...pending, ...later];
  }, [q.data, done, skipped]);

  const current: NatureLine | undefined = queue[0];

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

  if (q.isLoading) return <Skeleton className="h-56 w-full" />;

  const total = q.data?.length ?? 0;
  if (total === 0)
    return <p className="text-sm text-muted-foreground">Aucune donnée à valider.</p>;

  if (!current)
    return (
      <p className="text-sm text-muted-foreground">Toutes les données en attente sont classées.</p>
    );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-lg font-semibold leading-tight">{current.designation}</h3>
          <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground">
            {current.placement}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 text-sm text-muted-foreground">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {euro(current.amount)}
          </span>
          <span>
            {String(current.month).padStart(2, "0")}/{current.year}
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {NATURES.map((n) => (
            <Button
              key={n}
              size="lg"
              variant={n === "vente" ? "default" : "secondary"}
              className="h-14 text-base font-semibold"
              disabled={m.isPending}
              onClick={() => m.mutate({ row: current, nature: n })}
            >
              {NATURE_LABELS[n]}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={m.isPending || queue.length < 2}
            onClick={() => setSkipped((prev) => [...new Set([...prev, current.id])])}
          >
            <SkipForward className="mr-1.5 h-4 w-4" /> Passer
          </Button>
          <span className="text-xs text-muted-foreground">{queue.length} ligne(s) restante(s)</span>
        </div>
      </div>
    </div>
  );
}
