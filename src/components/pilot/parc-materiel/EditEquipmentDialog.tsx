import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Pencil } from "lucide-react";
import {
  updateEquipment,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type Equipment,
  type EquipmentCategory,
  type EquipmentStatus,
} from "@/lib/parc-materiel";

export function EditEquipmentDialog({
  equipment,
  onUpdated,
}: {
  equipment: Equipment;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(equipment.name);
  const [category, setCategory] = useState<EquipmentCategory>(equipment.category);
  const [customCategory, setCustomCategory] = useState(equipment.custom_category ?? "");
  const [purchaseDate, setPurchaseDate] = useState(equipment.purchase_date ?? "");
  const [purchaseCost, setPurchaseCost] = useState(
    equipment.purchase_cost != null ? String(equipment.purchase_cost) : "",
  );
  const [amortizationYears, setAmortizationYears] = useState(
    equipment.amortization_years != null ? String(equipment.amortization_years) : "",
  );
  const [status, setStatus] = useState<EquipmentStatus>(equipment.status);
  const [notes, setNotes] = useState(equipment.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function resetToEquipment() {
    setName(equipment.name);
    setCategory(equipment.category);
    setCustomCategory(equipment.custom_category ?? "");
    setPurchaseDate(equipment.purchase_date ?? "");
    setPurchaseCost(equipment.purchase_cost != null ? String(equipment.purchase_cost) : "");
    setAmortizationYears(
      equipment.amortization_years != null ? String(equipment.amortization_years) : "",
    );
    setStatus(equipment.status);
    setNotes(equipment.notes ?? "");
    setError(null);
  }

  const m = useMutation({
    mutationFn: () =>
      updateEquipment(equipment.id, {
        name: name.trim(),
        category,
        custom_category:
          category === "autre" && customCategory.trim() ? customCategory.trim() : null,
        purchase_date: purchaseDate || null,
        purchase_cost: purchaseCost ? Number(purchaseCost.replace(",", ".")) : null,
        amortization_years: amortizationYears ? Number(amortizationYears.replace(",", ".")) : null,
        status,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Équipement mis à jour.");
      onUpdated();
      setOpen(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    if (!name.trim()) {
      setError("Le nom de l'équipement est obligatoire.");
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
        if (v) resetToEquipment();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l'équipement</DialogTitle>
          <DialogDescription>Les modifications s'appliquent immédiatement.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="edit-eq-name">Nom *</Label>
            <Input
              id="edit-eq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-eq-category">Catégorie</Label>
              <select
                id="edit-eq-category"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
              >
                {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-eq-status">Statut</Label>
              <select
                id="edit-eq-status"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
              >
                {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {category === "autre" && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-eq-custom-category">Nom de la catégorie personnalisée</Label>
              <Input
                id="edit-eq-custom-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Ex. Outillage électroportatif"
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-eq-purchase-date">Date d'achat</Label>
              <Input
                id="edit-eq-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-eq-cost">Prix d'achat HT</Label>
              <Input
                id="edit-eq-cost"
                inputMode="decimal"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-eq-amortization">Amortissement (années)</Label>
              <Input
                id="edit-eq-amortization"
                inputMode="decimal"
                value={amortizationYears}
                onChange={(e) => setAmortizationYears(e.target.value)}
                placeholder="Ex. 5"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-eq-notes">Notes (facultatif)</Label>
            <Textarea
              id="edit-eq-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
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
