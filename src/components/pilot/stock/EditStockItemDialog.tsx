import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateStockItem, type StockItem } from "@/lib/pilot-stock";

export function EditStockItemDialog({
  item,
  open,
  onOpenChange,
  onUpdated,
}: {
  item: StockItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit ?? "");
  const [unitPrice, setUnitPrice] = useState(String(item.unit_price_ht));
  const [isPerishable, setIsPerishable] = useState(item.is_perishable);
  const [error, setError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      updateStockItem(item.id, {
        name: name.trim(),
        category: category.trim() || "Non catégorisé",
        unit: unit.trim() || null,
        unit_price_ht: Number(unitPrice.replace(",", ".")) || 0,
        is_perishable: isPerishable,
      }),
    onSuccess: () => {
      toast.success("Article mis à jour.");
      onUpdated();
      onOpenChange(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    if (!name.trim()) {
      setError("Le nom est obligatoire.");
      return;
    }
    setError(null);
    m.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l'article</DialogTitle>
          <DialogDescription>
            La quantité ne se modifie pas ici : passe par un mouvement pour ajuster le stock.
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
            <Label htmlFor="edit-stk-name">Nom *</Label>
            <Input
              id="edit-stk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-stk-category">Catégorie</Label>
              <Input
                id="edit-stk-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-stk-unit">Unité</Label>
              <Input id="edit-stk-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-stk-price">Prix unitaire HT</Label>
            <Input
              id="edit-stk-price"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-stk-perishable"
              checked={isPerishable}
              onCheckedChange={(v) => setIsPerishable(v === true)}
            />
            <Label htmlFor="edit-stk-perishable" className="font-normal">
              Article périssable
            </Label>
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
              onClick={() => onOpenChange(false)}
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
