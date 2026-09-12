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
import { Plus } from "lucide-react";
import {
  createEquipment,
  EQUIPMENT_CATEGORY_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentCategory,
  type EquipmentStatus,
} from "@/lib/parc-materiel";

export function AddEquipmentDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("autre");
  const [customCategory, setCustomCategory] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [amortizationYears, setAmortizationYears] = useState("");
  const [status, setStatus] = useState<EquipmentStatus>("en_service");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setCategory("autre");
    setCustomCategory("");
    setPurchaseDate("");
    setPurchaseCost("");
    setAmortizationYears("");
    setStatus("en_service");
    setNotes("");
    setError(null);
  }

  const m = useMutation({
    mutationFn: () =>
      createEquipment({
        name: name.trim(),
        category,
        custom_category: category === "autre" && customCategory.trim() ? customCategory.trim() : null,
        purchase_date: purchaseDate || null,
        purchase_cost: purchaseCost ? Number(purchaseCost.replace(",", ".")) : null,
        amortization_years: amortizationYears ? Number(amortizationYears.replace(",", ".")) : null,
        status,
        notes: notes.trim() || null,
      }),
    onSuccess: (row) => {
      toast.success(`Équipement « ${row.name} » ajouté au parc.`);
      onCreated();
      setOpen(false);
      reset();
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
        if (v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Ajouter un équipement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter un équipement</DialogTitle>
          <DialogDescription>
            Renseigne le prix d'achat et la durée d'amortissement pour que la valeur actuelle se
            calcule automatiquement.
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
            <Label htmlFor="eq-name">Nom *</Label>
            <Input
              id="eq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Camion Iveco"
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eq-category">Catégorie</Label>
              <select
                id="eq-category"
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
              <Label htmlFor="eq-status">Statut</Label>
              <select
                id="eq-status"
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
              <Label htmlFor="eq-custom-category">Nom de la catégorie personnalisée</Label>
              <Input
                id="eq-custom-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Ex. Outillage électroportatif"
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="eq-purchase-date">Date d'achat</Label>
              <Input
                id="eq-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-cost">Prix d'achat HT</Label>
              <Input
                id="eq-cost"
                inputMode="decimal"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-amortization">Amortissement (années)</Label>
              <Input
                id="eq-amortization"
                inputMode="decimal"
                value={amortizationYears}
                onChange={(e) => setAmortizationYears(e.target.value)}
                placeholder="Ex. 5"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-notes">Notes (facultatif)</Label>
            <Textarea id="eq-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
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
