import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PilotCard } from "@/components/pilot/PilotCard";
import { CHARGE_CLASS_LABELS, listChargeCategories, type ChargeClass } from "@/lib/pilot-charges";
import {
  listPendingValidation,
  setLineCategory,
  setValidation,
  setValidationNote,
  VALIDATION_REASON_LABELS,
  type PendingValidationLine,
  type ValidationReason,
} from "@/lib/pilot-validation";

export const Route = createFileRoute("/_authenticated/pilot/validation")({
  head: () => ({
    meta: [
      { title: "Validation analytique — Pilot Pro" },
      {
        name: "description",
        content:
          "Vérifiez et validez manuellement les lignes financières incertaines avant le calcul des indicateurs de rentabilité.",
      },
      { property: "og:title", content: "Validation analytique — Pilot Pro" },
      {
        property: "og:description",
        content: "Validation humaine des lignes financières incertaines de Pilot Pro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValidationPage,
});

const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function ValidationPage() {
  const qc = useQueryClient();
  const [reasonFilter, setReasonFilter] = useState<ValidationReason | "all">("all");
  const [search, setSearch] = useState("");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["pilot-validation"],
    queryFn: () => listPendingValidation(1000),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["pilot-charge-categories"],
    queryFn: listChargeCategories,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pilot-validation"] });

  const validate = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: "valide" | "a_revoir"; note?: string | null }) =>
      setValidation(id, status, note ?? null),
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(v.status === "valide" ? "Ligne validée" : "Ligne marquée à revoir");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNote = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => setValidationNote(id, note),
    onSuccess: () => {
      invalidate();
      toast.success("Note enregistrée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recategorize = useMutation({
    mutationFn: ({ id, cls, label }: { id: string; cls: ChargeClass; label: string }) =>
      setLineCategory(id, cls, label),
    onSuccess: () => {
      invalidate();
      toast.success("Catégorie modifiée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lines.filter((l) => {
      if (reasonFilter !== "all" && !l.reasons.includes(reasonFilter)) return false;
      if (!q) return true;
      return `${l.designation ?? ""} ${l.charge_category ?? ""}`.toLowerCase().includes(q);
    });
  }, [lines, reasonFilter, search]);

  const totals = useMemo(() => {
    const amount = filtered.reduce((s, l) => s + Math.abs(l.amount_ht), 0);
    const remu = lines.filter((l) => l.reasons.includes("remuneration_dirigeant"));
    return {
      count: filtered.length,
      amount,
      toReview: lines.filter((l) => l.validation_status === "a_revoir").length,
      remuCount: remu.length,
      remuAmount: remu.reduce((s, l) => s + Math.abs(l.amount_ht), 0),
    };
  }, [filtered, lines]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Validation analytique</h1>
        <p className="text-sm text-muted-foreground">
          Lignes financières en attente d'une décision humaine. Aucune donnée n'est classée
          automatiquement : montants, dates et libellés d'origine restent intacts.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <PilotCard storageId="valid-count" label="Lignes à traiter" value={String(totals.count)} sub="selon le filtre actif" />
        <PilotCard storageId="valid-amount" label="Montant concerné" value={euro(totals.amount)} sub="valeur absolue" />
        <PilotCard storageId="valid-review" label="Marquées à revoir" value={String(totals.toReview)} tone="negative" />
        <PilotCard
          storageId="valid-remu"
          label="Rémunération"
          value={euro(totals.remuAmount)}
          sub={`${totals.remuCount} ligne(s) — hors charges d'exploitation`}
          help="Les lignes de rémunération sont exclues du classement charges fixes / variables. Le coût entreprise se calcule sur le net saisi + 45 % de cotisations."
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lignes en attente</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Select value={reasonFilter} onValueChange={(v) => setReasonFilter(v as ValidationReason | "all")}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Motif" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les motifs</SelectItem>
                {Object.entries(VALIDATION_REASON_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="w-56"
              placeholder="Rechercher un libellé…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune ligne en attente pour ce filtre.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Libellé d'origine</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Catégorie actuelle</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 300).map((l) => (
                    <ValidationRow
                      key={l.id}
                      line={l}
                      categories={categories}
                      noteDraft={noteDraft[l.id] ?? l.validation_note ?? ""}
                      onNoteChange={(v) => setNoteDraft((s) => ({ ...s, [l.id]: v }))}
                      onValidate={() => validate.mutate({ id: l.id, status: "valide", note: noteDraft[l.id] ?? l.validation_note })}
                      onReview={() => validate.mutate({ id: l.id, status: "a_revoir", note: noteDraft[l.id] ?? l.validation_note })}
                      onSaveNote={() => saveNote.mutate({ id: l.id, note: noteDraft[l.id] ?? "" })}
                      onRecategorize={(cls, label) => recategorize.mutate({ id: l.id, cls, label })}
                    />
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 300 && (
                <p className="pt-2 text-xs text-muted-foreground">
                  Affichage limité aux 300 premières lignes ({filtered.length} au total).
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ValidationRow({
  line,
  categories,
  noteDraft,
  onNoteChange,
  onValidate,
  onReview,
  onSaveNote,
  onRecategorize,
}: {
  line: PendingValidationLine;
  categories: { label: string; charge_class: ChargeClass }[];
  noteDraft: string;
  onNoteChange: (v: string) => void;
  onValidate: () => void;
  onReview: () => void;
  onSaveNote: () => void;
  onRecategorize: (cls: ChargeClass, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isRemu = line.reasons.includes("remuneration_dirigeant");

  return (
    <>
      <TableRow className={line.validation_status === "a_revoir" ? "bg-destructive/5" : undefined}>
        <TableCell className="whitespace-nowrap text-sm">
          {String(line.month).padStart(2, "0")}/{line.year}
        </TableCell>
        <TableCell className="max-w-[280px] text-sm">{line.designation || "—"}</TableCell>
        <TableCell className="text-right tabular-nums">{euro(line.amount_ht)}</TableCell>
        <TableCell className="text-sm">
          {isRemu ? (
            <Badge variant="outline">Rémunération</Badge>
          ) : (
            <span>
              {line.charge_category || "À classer"}
              {line.charge_class ? (
                <span className="block text-xs text-muted-foreground">
                  {CHARGE_CLASS_LABELS[(line.charge_class as ChargeClass) ?? "a_classer"]}
                </span>
              ) : null}
            </span>
          )}
        </TableCell>
        <TableCell className="space-x-1">
          {line.reasons.map((r) => (
            <Badge key={r} variant="secondary" className="text-[11px]">
              {VALIDATION_REASON_LABELS[r]}
            </Badge>
          ))}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={onValidate} title="Valider">
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={onReview} title="Marquer à revoir">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} title="Note / catégorie">
              <StickyNote className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/40">
            <div className="flex flex-wrap items-center gap-2 py-2">
              <Input
                className="w-72"
                placeholder="Note de validation…"
                value={noteDraft}
                onChange={(e) => onNoteChange(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={onSaveNote}>
                Enregistrer la note
              </Button>
              {!isRemu && (
                <Select
                  onValueChange={(v) => {
                    const c = categories.find((x) => x.label === v);
                    if (c) onRecategorize(c.charge_class, c.label);
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Modifier la catégorie…" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.label} value={c.label}>
                        {c.label} — {CHARGE_CLASS_LABELS[c.charge_class]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isRemu && (
                <p className="text-xs text-muted-foreground">
                  Rémunération : exclue du classement charges. Coût entreprise = net + 45 % de cotisations.
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
