import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listQuotes, loadQuoteDetail, type StoredQuoteLine } from "@/lib/predevis-data";
import type { StoredLine } from "@/lib/predevis-lines";
import { storedPosteRecap } from "@/lib/predevis-recap";
import { PosteSection, type ViewRow } from "@/components/predevis/PosteSection";
import { eur } from "@/components/predevis/predevis-format";

const num = (v: unknown) => (v == null ? null : Number(v));

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

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Retour aux devis importés
        </Button>
        <div>
          <h2 className="font-display text-xl">{data.quote.title}</h2>
          <p className="text-sm text-muted-foreground">
            {data.quote.devis_number ? `Devis n° ${data.quote.devis_number} · ` : ""}
            Total HT déclaré {eur(num(data.quote.total_ht_declared))}
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
            pau: !isFourniture ? (
              <span className="text-muted-foreground">—</span>
            ) : l.pau_ht_applied != null ? (
              eur(num(l.pau_ht_applied))
            ) : (
              <span className="text-destructive">prix manquant</span>
            ),
            rattachement: !isFourniture ? (
              <span className="text-muted-foreground">—</span>
            ) : l.catalogue_product_id ? (
              <Badge variant="secondary">
                {productCode.get(l.catalogue_product_id) ?? "rattaché"}
              </Badge>
            ) : (
              <span className="text-destructive">absent du catalogue</span>
            ),
          };
        });
        return (
          <PosteSection
            key={poste.id}
            index={poste.position}
            title={poste.title}
            meta={
              <span className="text-sm text-muted-foreground">
                {lines.length} lignes · Sous-total {eur(num(poste.subtotal_ht))}
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
