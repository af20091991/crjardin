import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/pilot";
import {
  listFixedCharges, createFixedCharge, updateFixedCharge, deleteFixedCharge,
  fixedChargesTotals,
} from "@/lib/pilot-fixed-charges";

const num = (v: string) => Number(v.replace(",", ".")) || 0;

/** Liste modifiable des charges fixes récurrentes de l'année (montants mensuels). */
export function FixedChargesPanel({ year }: { year: number }) {
  const qc = useQueryClient();
  const key = ["pilot-fixed-charges", year];
  const q = useQuery({ queryKey: key, queryFn: () => listFixedCharges(year) });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const onError = (e: Error) => toast.error(e.message);

  const add = useMutation({
    mutationFn: () =>
      createFixedCharge({
        year,
        label: "",
        monthly_amount: 0,
        position: (q.data?.length ?? 0),
      }),
    onSuccess: invalidate,
    onError,
  });
  const upd = useMutation({
    mutationFn: (p: { id: string; input: Parameters<typeof updateFixedCharge>[1] }) =>
      updateFixedCharge(p.id, p.input),
    onSuccess: invalidate,
    onError,
  });
  const del = useMutation({ mutationFn: deleteFixedCharge, onSuccess: invalidate, onError });

  const rows = q.data ?? [];
  const t = fixedChargesTotals(rows);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-primary" />
          Charges fixes {year}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => add.mutate()}>
          <Plus className="mr-1 h-4 w-4" />Poste
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {q.isLoading && <Skeleton className="h-40 w-full" />}
        {!q.isLoading && rows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucun poste fixe — ajoutez vos charges récurrentes.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              defaultValue={r.label}
              placeholder="Libellé du poste"
              className="h-8 flex-1"
              onBlur={(e) => {
                if (e.target.value !== r.label) upd.mutate({ id: r.id, input: { label: e.target.value } });
              }}
            />
            <Input
              defaultValue={r.monthly_amount || ""}
              type="number"
              inputMode="decimal"
              className="h-8 w-28 text-right"
              onBlur={(e) => {
                const v = num(e.target.value);
                if (v !== r.monthly_amount) upd.mutate({ id: r.id, input: { monthly_amount: v } });
              }}
            />
            <span className="w-10 text-xs text-muted-foreground">€/mois</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => del.mutate(r.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-2 text-sm">
          <span className="font-medium">{t.count} postes actifs</span>
          <span>
            <span className="text-muted-foreground">{formatEuro(t.monthly)} / mois · </span>
            <span className="font-semibold text-rose-600">{formatEuro(t.yearly)} / an</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}