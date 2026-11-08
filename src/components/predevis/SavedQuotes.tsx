import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listQuotes,
  loadQuoteDetail,
  saveQuoteAmounts,
  type LineAmountPatch,
  type QuoteDetail,
  type StoredQuoteLine,
} from "@/lib/predevis-data";
import type { StoredLine } from "@/lib/predevis-lines";
import { pauCompletionFields, storedPosteRecap } from "@/lib/predevis-recap";
import { PosteSection, type ViewRow } from "@/components/predevis/PosteSection";
import { eur } from "@/components/predevis/predevis-format";

const num = (v: unknown) => (v == null ? null : Number(v));

const LINE_FIELDS = ["quantity", "pu_ht", "ht", "ttc", "pau_ht_applied", "manual_cost_ht"] as const;
type LineField = (typeof LINE_FIELDS)[number];

/** Clés des champs modifiables : l:<ligne>:<champ>, p:<poste>, q (total HT déclaré du devis). */
function initialDrafts(data: QuoteDetail): Record<string, string> {
  const out: Record<string, string> = {};
  const show = (n: number | null | undefined) => (n == null ? "" : String(Number(n)));
  for (const l of data.lines) {
    out[`l:${l.id}:quantity`] = show(num(l.quantity));
    out[`l:${l.id}:pu_ht`] = show(num(l.pu_ht));
    out[`l:${l.id}:ht`] = show(num(l.ht));
    out[`l:${l.id}:ttc`] = show(num(l.ttc));
    out[`l:${l.id}:pau_ht_applied`] = show(num(l.pau_ht_applied));
    out[`l:${l.id}:manual_cost_ht`] = show(num(l.manual_cost_ht));
  }
  for (const p of data.postes) out[`p:${p.id}`] = show(num(p.subtotal_ht));
  out.q = show(num(data.quote.total_ht_declared));
  out.t = data.quote.title;
  return out;
}

/** Vide = null (effacé) ; négatif ou non numérique = undefined (refusé). */
function parseAmount(v: string): number | null | undefined {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function toStoredLine(l: StoredQuoteLine): StoredLine {
  return {
    kind: l.line_kind,
    quantity: num(l.quantity),
    ht: num(l.ht),
    ttc: num(l.ttc),
    pau_ht_applied: num(l.pau_ht_applied),
    cost_status: l.cost_status,
    unit_status: l.unit_status,
    unit_multiplier: num(l.unit_multiplier),
    manual_cost_ht: num(l.manual_cost_ht),
    zero_cost_reason: l.zero_cost_reason,
  };
}

/** Onglet « Devis importés » : liste des devis enregistrés, puis détail avec le même tableau que l'import. */
export function SavedQuotes({
  openId,
  onOpen,
  onBack,
}: {
  openId: string | null;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  if (openId) return <QuoteDetailView quoteId={openId} onBack={onBack} />;
  return <QuoteList onOpen={onOpen} />;
}

function QuoteList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["predevis", "quotes"],
    queryFn: listQuotes,
  });

  return (
    <section className="space-y-6 rounded-xl border bg-card p-6">
      <div>
        <h2 className="font-display text-lg">Devis importés</h2>
        <p className="text-sm text-muted-foreground">
          Les devis enregistrés depuis Nouveau devis, avec leurs postes, prix et marges.
        </p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && <p className="text-sm text-destructive">Lecture impossible : {String(error)}</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun devis importé. Importe un devis dans Nouveau devis.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">Devis</th>
                <th className="py-2 pr-4 text-right font-medium">Total HT déclaré</th>
                <th className="py-2 pr-4 text-left font-medium">Enregistré le</th>
                <th className="py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-3 pr-4 font-medium">{q.title}</td>
                  <td className="py-3 pr-4 text-right">{eur(num(q.total_ht_declared))}</td>
                  <td className="py-3 pr-4">
                    {new Date(q.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => onOpen(q.id)}>
                      Ouvrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function QuoteDetailView({ quoteId, onBack }: { quoteId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ["predevis", "quote", quoteId],
    queryFn: () => loadQuoteDetail(quoteId),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour
        </Button>
        <p className="text-sm text-destructive">Lecture du devis impossible.</p>
      </div>
    );
  }

  const productCode = new Map(data.products.map((p) => [p.id, p.code]));
  const setDraft = (key: string, value: string) => setDrafts((d) => ({ ...d, [key]: value }));

  function startEdit() {
    setDrafts(initialDrafts(data as QuoteDetail));
    setEditing(true);
  }

  async function save() {
    const current = data as QuoteDetail;
    const init = initialDrafts(current);
    const lines: Record<string, LineAmountPatch> = {};
    const postes: Record<string, number | null> = {};
    let totalHtDeclared: number | null | undefined;
    let title: string | undefined;
    for (const [key, raw] of Object.entries(drafts)) {
      if (raw === (init[key] ?? "")) continue; // inchangé : rien à écrire
      if (key === "t") {
        if (raw.trim() === "") {
          toast.error("Le nom du devis ne peut pas être vide.");
          return;
        }
        title = raw.trim();
        continue;
      }
      const value = parseAmount(raw);
      if (value === undefined) {
        toast.error("Montant invalide : saisis un nombre positif, ou laisse vide.");
        return;
      }
      if (key === "q") {
        totalHtDeclared = value;
      } else if (key.startsWith("p:")) {
        postes[key.slice(2)] = value;
      } else {
        const [, lineId, field] = key.split(":");
        if (!lineId || !LINE_FIELDS.includes(field as LineField)) continue;
        const f = field as LineField;
        lines[lineId] = { ...(lines[lineId] ?? {}), [f]: value };
      }
    }
    // Un PAU saisi complète l'unité de la ligne (multiplicateur 1 si aucun) : sinon le poste reste bloqué.
    for (const [lineId, patch] of Object.entries(lines)) {
      if (patch.pau_ht_applied == null) continue;
      const line = current.lines.find((l) => l.id === lineId);
      lines[lineId] = { ...patch, ...pauCompletionFields(num(line?.unit_multiplier)) };
    }
    setSaving(true);
    try {
      await saveQuoteAmounts({ quoteId, lines, postes, totalHtDeclared, title });
      await qc.invalidateQueries({ queryKey: ["predevis"] });
      toast.success("Montants enregistrés.");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: string, width = "w-28") => (
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      className={`h-8 ${width} text-right`}
      value={drafts[key] ?? ""}
      onChange={(e) => setDraft(key, e.target.value)}
    />
  );

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux devis importés
          </Button>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier les montants
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
              <Button size="sm" disabled={saving} onClick={save}>
                Enregistrer les montants
              </Button>
            </div>
          )}
        </div>
        <div>
          {editing ? (
            <Input
              className="h-9 max-w-2xl font-display text-xl"
              value={drafts.t ?? ""}
              onChange={(e) => setDraft("t", e.target.value)}
              aria-label="Nom du devis"
            />
          ) : (
            <h2 className="font-display text-xl">{data.quote.title}</h2>
          )}
          <p className="text-sm text-muted-foreground">
            {data.quote.devis_number ? `Devis n° ${data.quote.devis_number} · ` : ""}
            Total HT déclaré {editing ? field("q", "w-32") : eur(num(data.quote.total_ht_declared))}
          </p>
        </div>
      </div>

      {data.postes.map((poste) => {
        const lines = data.lines
          .filter((l) => l.poste_id === poste.id)
          .sort((a, b) => a.position - b.position);
        const fin = storedPosteRecap(lines.map(toStoredLine));
        const rows: ViewRow[] = lines.map((l) => {
          const isFourniture = l.line_kind === "fourniture";
          const pauCell = !isFourniture ? (
            editing ? (
              field(`l:${l.id}:manual_cost_ht`)
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          ) : editing ? (
            field(`l:${l.id}:pau_ht_applied`)
          ) : l.pau_ht_applied != null ? (
            eur(num(l.pau_ht_applied))
          ) : (
            <span className="text-destructive">prix manquant</span>
          );
          return {
            key: l.id,
            ref: l.source_ref,
            designation: l.designation,
            kind: l.line_kind,
            continued: l.continued,
            quantity: num(l.quantity),
            pu: num(l.pu_ht),
            ht: num(l.ht),
            ttc: num(l.ttc),
            pau: pauCell,
            rattachement: !isFourniture ? (
              <span className="text-muted-foreground">—</span>
            ) : l.catalogue_product_id ? (
              <Badge variant="secondary">
                {productCode.get(l.catalogue_product_id) ?? "rattaché"}
              </Badge>
            ) : (
              <span className="text-destructive">absent du catalogue</span>
            ),
            editable: editing
              ? {
                  quantity: field(`l:${l.id}:quantity`, "w-20"),
                  pu: field(`l:${l.id}:pu_ht`),
                  ht: field(`l:${l.id}:ht`),
                  ttc: field(`l:${l.id}:ttc`),
                }
              : undefined,
          };
        });
        return (
          <PosteSection
            key={poste.id}
            index={poste.position}
            title={poste.title}
            meta={
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {lines.length} lignes · Sous-total{" "}
                {editing ? field(`p:${poste.id}`, "w-32") : eur(num(poste.subtotal_ht))}
              </span>
            }
            rows={rows}
            fin={fin}
            clientText={poste.client_block ?? ""}
          />
        );
      })}
    </div>
  );
}
