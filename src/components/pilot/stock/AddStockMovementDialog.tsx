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
  createStockItem,
  createStockMovement,
  STOCK_MOVEMENT_TYPE_LABELS,
  type StockItem,
  type StockMovementType,
} from "@/lib/pilot-stock";

export function AddStockMovementDialog({
  items,
  onCreated,
}: {
  items: StockItem[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [itemId, setItemId] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [movementType, setMovementType] = useState<StockMovementType>("entree");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("existing");
    setItemId("");
    setNewName("");
    setNewCategory("");
    setNewUnit("");
    setMovementType("entree");
    setQuantity("");
    setUnitPrice("");
    setReason("");
    setError(null);
  }

  const m = useMutation({
    mutationFn: async () => {
      let targetItemId = itemId;
      if (mode === "new") {
        const created = await createStockItem({
          name: newName.trim(),
          category: newCategory.trim() || "Non catégorisé",
          unit: newUnit.trim() || null,
          unit_price_ht: unitPrice ? Number(unitPrice.replace(",", ".")) : 0,
        });
        targetItemId = created.id;
      }
      return createStockMovement({
        item_id: targetItemId,
        movement_type: movementType,
        quantity: Number(quantity.replace(",", ".")),
        unit_price_ht: unitPrice ? Number(unitPrice.replace(",", ".")) : null,
        reason: reason.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success("Mouvement enregistré.");
      onCreated();
      setOpen(false);
      reset();
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    if (mode === "existing" && !itemId) {
      setError("Sélectionne un article.");
      return;
    }
    if (mode === "new" && !newName.trim()) {
      setError("Le nom du nouvel article est obligatoire.");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!quantity || Number.isNaN(qty) || qty <= 0) {
      setError("La quantité doit être un nombre positif.");
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
          Nouveau mouvement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau mouvement de stock</DialogTitle>
          <DialogDescription>
            La quantité de l'article est mise à jour automatiquement à partir de ce mouvement.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              onClick={() => setMode("existing")}
            >
              Article existant
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              onClick={() => setMode("new")}
            >
              Nouvel article
            </Button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-1.5">
              <Label htmlFor="stk-item">Article *</Label>
              <select
                id="stk-item"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
              >
                <option value="">— Sélectionner —</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.category})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="stk-new-name">Nom *</Label>
                <Input
                  id="stk-new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex. Oya XL"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stk-new-category">Catégorie</Label>
                <Input
                  id="stk-new-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ex. Objets"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stk-new-unit">Unité</Label>
                <Input
                  id="stk-new-unit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="Ex. pièce"
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="stk-type">Type</Label>
              <select
                id="stk-type"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as StockMovementType)}
              >
                {Object.entries(STOCK_MOVEMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stk-quantity">Quantité *</Label>
              <Input
                id="stk-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex. 2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stk-price">Prix unitaire HT</Label>
              <Input
                id="stk-price"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stk-reason">Motif (facultatif)</Label>
            <Textarea
              id="stk-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. Achat fournisseur, chantier Ruiz…"
              rows={2}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
