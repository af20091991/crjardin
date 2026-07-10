import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePilotData } from "@/components/pilot/usePilotData";
import {
  upsertObjective, deleteObjective, formatEuro, formatPct, MONTHS, FAMILIES, FAMILY_META,
  computeKpis, sum, DEFAULT_SETTINGS, type PilotFamily,
} from "@/lib/pilot";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pilot/objectifs")({
  component: ObjectivesPage,
});

function ObjectivesPage() {
  const qc = useQueryClient();
  const { entries, charges, objectives, settings } = usePilotData();
  const now = new Date();
  const year = now.getFullYear();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"annuel" | "mensuel" | "activite">("annuel");
  const [month, setMonth] = useState("0");
  const [family, setFamily] = useState<PilotFamily>("amenagement");
  const [amount, setAmount] = useState("");

  const set = settings.data ?? { user_id: "", ...DEFAULT_SETTINGS };
  const k = useMemo(
    () => computeKpis({ entries: entries.data ?? [], charges: charges.data ?? [], objectives: objectives.data ?? [], settings: set, year, month: now.getMonth() }),
    [entries.data, charges.data, objectives.data, set, year],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-objectives"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      await upsertObjective({
        year,
        month: scope === "mensuel" ? Number(month) : null,
        family: scope === "activite" ? family : null,
        target_amount: Number(amount) || 0,
      });
    },
    onSuccess: () => { invalidate(); setOpen(false); setAmount(""); toast.success("Objectif enregistré"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: deleteObjective,
    onSuccess: () => { invalidate(); toast.success("Objectif supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const yearObjs = (objectives.data ?? []).filter((o) => o.year === year);
  const yearEntries = (entries.data ?? []).filter((e) => new Date(e.entry_date).getFullYear() === year);

  const realizedFor = (o: { month: number | null; family: PilotFamily | null }) => {
    let list = yearEntries;
    if (o.month != null) list = list.filter((e) => new Date(e.entry_date).getMonth() === o.month);
    if (o.family != null) list = list.filter((e) => e.family === o.family);
    return sum(list.map((e) => e.amount_ht));
  };

  const label = (o: { month: number | null; family: PilotFamily | null }) =>
    o.month != null ? `Mensuel — ${MONTHS[o.month]}` : o.family != null ? `Activité — ${FAMILY_META[o.family].short}` : "Objectif annuel global";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5 text-primary" />Objectifs {year}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Ajouter</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nouvel objectif</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annuel">Annuel global</SelectItem>
                    <SelectItem value="mensuel">Mensuel</SelectItem>
                    <SelectItem value="activite">Par activité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === "mensuel" && (
                <div className="space-y-1"><Label>Mois</Label>
                  <Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((mo, i) => <SelectItem key={i} value={String(i)}>{mo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {scope === "activite" && (
                <div className="space-y-1"><Label>Activité</Label>
                  <Select value={family} onValueChange={(v) => setFamily(v as PilotFamily)}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FAMILIES.map((f) => <SelectItem key={f} value={f}>{FAMILY_META[f].short}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1"><Label>Montant cible (€ HT)</Label>
                <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {yearObjs.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aucun objectif défini pour {year}. Définissez un objectif annuel pour suivre votre progression.
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {yearObjs.map((o) => {
          const realized = realizedFor(o);
          const pct = o.target_amount > 0 ? (realized / o.target_amount) * 100 : 0;
          const gap = realized - o.target_amount;
          const proj = o.month == null && o.family == null ? k.projection : null;
          const probability = o.target_amount > 0 ? Math.max(0, Math.min(100, ((proj ?? realized) / o.target_amount) * 100)) : 0;
          return (
            <Card key={o.id}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{label(o)}</p>
                    <p className="text-xs text-muted-foreground">Cible {formatEuro(o.target_amount)}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => delMut.mutate(o.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">{formatEuro(realized)} <span className="text-muted-foreground">réalisé ({pct.toFixed(0)} %)</span></span>
                  <span className={gap >= 0 ? "text-emerald-600" : "text-amber-600"}>{gap >= 0 ? "Avance " : "Écart "}{formatEuro(Math.abs(gap))}</span>
                </div>
                {proj != null && (
                  <p className="text-xs text-muted-foreground">Projection fin d'année : <span className="font-medium text-foreground">{formatEuro(proj)}</span> — probabilité d'atteinte {probability.toFixed(0)} %</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}