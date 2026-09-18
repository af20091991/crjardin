import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ListPlus, Plus, Trash2 } from "lucide-react";
import {
  createStockItemsBulk,
  parseStockBulkPaste,
  type StockBulkItemInput,
} from "@/lib/pilot-stock";

interface BulkRow {
  key: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: string;
  quantity: string;
  perishable: boolean;
}

let rowCounter = 0;
function emptyRow(): BulkRow {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    name: "",
    category: "",
    unit: "",
    unitPrice: "",
    quantity: "",
    perishable: false,
  };
}

function rowsFromParsed(inputs: StockBulkItemInput[]): BulkRow[] {
  return inputs.map((input) => {
    rowCounter += 1;
    return {
      key: `row-${rowCounter}`,
      name: input.name,
      category: input.category === "Non catégorisé" ? "" : input.category,
      unit: input.unit ?? "",
      unitPrice: input.unit_price_ht ? String(input.unit_price_ht) : "",
      quantity: input.initialQuantity ? String(input.initialQuantity) : "",
      perishable: input.is_perishable ?? false,
    };
  });
}

export function BulkAddStockItemsDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<BulkRow[]>(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPasteText("");
    setRows([emptyRow(), emptyRow(), emptyRow()]);
    setParseErrors([]);
    setError(null);
  }

  function applyPaste() {
    if (!pasteText.trim()) return;
    const { rows: parsed, errors } = parseStockBulkPaste(pasteText);
    setParseErrors(errors);
    if (parsed.length > 0) {
      setRows(rowsFromParsed(parsed));
    }
  }

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  const m = useMutation({
    mutationFn: async () => {
      const inputs: StockBulkItemInput[] = rows
        .filter((r) => r.name.trim().length > 0)
        .map((r) => ({
          name: r.name.trim(),
          category: r.category.trim() || "Non catégorisé",
          unit: r.unit.trim() || null,
          unit_price_ht: r.unitPrice ? Number(r.unitPrice.replace(",", ".")) : 0,
          is_perishable: r.perishable,
          initialQuantity: r.quantity ? Number(r.quantity.replace(",", ".")) : 0,
        }));
      return createStockItemsBulk(inputs);
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.status === "ok");
      const failed = results.filter((r) => r.status === "error");
      if (failed.length === 0) {
        toast.success(
          `${ok.length} article${ok.length > 1 ? "s" : ""} créé${ok.length > 1 ? "s" : ""}.`,
        );
        onCreated();
        setOpen(false);
        reset();
      } else {
        onCreated();
        toast.warning(
          `${ok.length} créé(s), ${failed.length} échec(s) : ${failed
            .map((f) => `${f.name} (${f.message ?? "erreur"})`)
            .join(", ")}`,
        );
        // On ne garde que les lignes en échec pour correction, le reste a été créé.
        setRows((prev) => prev.filter((r) => failed.some((f) => f.name === r.name.trim())));
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit() {
    const validRows = rows.filter((r) => r.name.trim().length > 0);
    if (validRows.length === 0) {
      setError("Ajoute au moins un article avec un nom.");
      return;
    }
    const names = validRows.map((r) => r.name.trim().toLowerCase());
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup) {
      setError(`Le nom « ${dup} » apparaît plusieurs fois dans la liste.`);
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
        else reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ListPlus className="mr-1 h-3.5 w-3.5" />
          Ajouter plusieurs articles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajouter plusieurs articles</DialogTitle>
          <DialogDescription>
            Colle une liste depuis un tableur ou saisis les articles ligne par ligne. Un mouvement
            d'entrée est créé automatiquement pour toute quantité initiale renseignée.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="stk-bulk-paste">
            Coller depuis Excel/tableur (colonnes : Nom, Catégorie, Unité, Prix HT, Quantité,
            Périssable)
          </Label>
          <Textarea
            id="stk-bulk-paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={
              "Oya XL\tObjets\tpièce\t12,50\t4\toui\nGant jardinage\tConsommables\tpaire\t3\t10\tnon"
            }
            rows={3}
            className="font-mono text-xs"
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={applyPaste}>
              Analyser et remplir le tableau
            </Button>
          </div>
          {parseErrors.length > 0 && (
            <ul className="list-disc space-y-0.5 rounded-md bg-amber-50 px-4 py-2 text-xs text-amber-800">
              {parseErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-32">Nom *</TableHead>
                <TableHead className="min-w-28">Catégorie</TableHead>
                <TableHead className="w-20">Unité</TableHead>
                <TableHead className="w-24">Prix HT</TableHead>
                <TableHead className="w-24">Quantité</TableHead>
                <TableHead className="w-16">Périssable</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <Input
                      value={r.name}
                      onChange={(e) => updateRow(r.key, { name: e.target.value })}
                      placeholder="Ex. Oya XL"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.category}
                      onChange={(e) => updateRow(r.key, { category: e.target.value })}
                      placeholder="Non catégorisé"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.unit}
                      onChange={(e) => updateRow(r.key, { unit: e.target.value })}
                      placeholder="pièce"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      value={r.unitPrice}
                      onChange={(e) => updateRow(r.key, { unitPrice: e.target.value })}
                      placeholder="0,00"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      inputMode="decimal"
                      value={r.quantity}
                      onChange={(e) => updateRow(r.key, { quantity: e.target.value })}
                      placeholder="0"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={r.perishable}
                      onCheckedChange={(v) => updateRow(r.key, { perishable: v === true })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(r.key)}
                      aria-label="Supprimer la ligne"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="button" size="sm" variant="ghost" onClick={addRow}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Ajouter une ligne
          </Button>
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
          <Button type="button" onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Création…" : "Créer les articles"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
