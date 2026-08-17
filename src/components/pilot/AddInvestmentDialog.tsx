import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { MONTH_NAMES } from "@/lib/pilot-ca";
import { createInvestment, validateInvestment } from "@/lib/pilot-charges";

/**
 * Saisie directe d'un investissement de l'exercice sélectionné.
 * Aucun calcul ici : la ligne est écrite dans la source unique et les moteurs
 * existants l'excluent des charges d'exploitation.
 */
export function AddInvestmentDialog({
  year,
  onCreated,
}: {
  year: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [designation, setDesignation] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [entryYear, setEntryYear] = useState(String(year));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDesignation("");
    setAmount("");
    setNote("");
    setError(null);
    setMonth(String(new Date().getMonth() + 1));
    setEntryYear(String(year));
  }

  const m = useMutation({
    mutationFn: () =>
      createInvestment({ designation, amountHt: amount, year: entryYear, month, note }),
    onSuccess: (row) => {
      toast.success(
        `Investissement ajouté à l'exercice ${row.year} — montant : ${row.amount_ht.toLocaleString("fr-FR")} € HT — mois : ${String(row.month).padStart(2, "0")}.`,
      );
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    const checked = validateInvestment({ designation, amountHt: amount, year: entryYear, month, note });
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setError(null);
    m.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setEntryYear(String(year));
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Ajouter un investissement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un investissement</DialogTitle>
          <DialogDescription>
            La ligne est créée dans le suivi financier, hors charges d'exploitation, et déduite
            uniquement du résultat après investissements.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="inv-designation">Désignation *</Label>
            <Input
              id="inv-designation"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Ex. Tondeuse autoportée"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-amount">Montant HT *</Label>
              <Input
                id="inv-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-year">Exercice *</Label>
              <Input
                id="inv-year"
                inputMode="numeric"
                value={entryYear}
                onChange={(e) => setEntryYear(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-month">Mois *</Label>
              <select
                id="inv-month"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {String(i + 1).padStart(2, "0")} — {name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-note">Commentaire (facultatif)</Label>
            <Textarea
              id="inv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
