import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createMaintenance } from "@/lib/parc-materiel";

export function AddMaintenanceDialog({
  equipmentId,
  onCreated,
}: {
  equipmentId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setCost("");
    setNextDue("");
    setError(null);
  }

  const m = useMutation({
    mutationFn: () =>
      createMaintenance({
        equipment_id: equipmentId,
        maintenance_date: date,
        description: description.trim(),
        cost: cost ? Number(cost.replace(",", ".")) : null,
        next_due_date: nextDue || null,
      }),
    onSuccess: () => {
      toast.success("Intervention enregistrée.");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    if (!description.trim()) {
      setError("La description de l'intervention est obligatoire.");
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
        if (v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Ajouter une intervention
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une intervention</DialogTitle>
          <DialogDescription>
            Renseigne la prochaine échéance pour que l'alerte d'entretien se déclenche
            automatiquement.
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
            <Label htmlFor="maint-description">Description *</Label>
            <Input
              id="maint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex. Vidange, contrôle technique…"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="maint-date">Date *</Label>
              <Input
                id="maint-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maint-cost">Coût</Label>
              <Input
                id="maint-cost"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maint-next-due">Prochaine échéance</Label>
              <Input
                id="maint-next-due"
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={m.isPending}
            >
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
