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
import { Check } from "lucide-react";
import { completeMaintenanceSchedule } from "@/lib/parc-materiel";

export function CompleteMaintenanceDialog({
  scheduleId,
  onCompleted,
}: {
  scheduleId: string;
  onCompleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState("");
  const [comment, setComment] = useState("");

  function reset() {
    setDate(new Date().toISOString().slice(0, 10));
    setCost("");
    setComment("");
  }

  const m = useMutation({
    mutationFn: () =>
      completeMaintenanceSchedule(
        scheduleId,
        date,
        cost ? Number(cost.replace(",", ".")) : null,
        comment,
      ),
    onSuccess: () => {
      toast.success("Entretien enregistré et prochaine échéance calculée.");
      onCompleted();
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    m.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={m.isPending}>
          <Check className="mr-1 h-3.5 w-3.5" />
          Effectué
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer l'entretien</DialogTitle>
          <DialogDescription>
            La date saisie sert de point de départ pour calculer la prochaine échéance.
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
            <Label htmlFor="completion-date">Date réelle *</Label>
            <Input
              id="completion-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="completion-cost">Coût</Label>
            <Input
              id="completion-cost"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="completion-comment">Commentaire</Label>
            <Input
              id="completion-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Facultatif"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
