import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pdfFileToWords } from "@/lib/predevis-quote-pdf";
import { parseQuote, type QuoteParse } from "@/lib/predevis-quote-parse";
import {
  loadMatchContext,
  quoteRowKey,
  saveQuoteDraft,
  type MatchChoices,
} from "@/lib/predevis-data";
import { matchQuoteRow, type MatchResult } from "@/lib/predevis-match";
import { uniqueSupplierPurchase } from "@/lib/predevis-lines";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const eur = (n: number | null) =>
  n == null ? "données insuffisantes" : `${n.toFixed(2).replace(".", ",")} €`;

type Ctx = Awaited<ReturnType<typeof loadMatchContext>>;

export function QuoteImport() {
  const [quote, setQuote] = useState<QuoteParse | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [choices, setChoices] = useState<MatchChoices>({});
  const [fileName, setFileName] = useState<string>("");
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function analyse(file: File) {
    setBusy(true);
    try {
      const words = await pdfFileToWords(file);
      const parsed = parseQuote(words);
      setCtx(await loadMatchContext());
      setChoices({});
      if (parsed.postes.length === 0) {
        toast.error("Aucun poste lu dans ce PDF. Vérifie que c'est un devis détaillé Henrri.");
      }
      setQuote(parsed);
      setFileName(file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lecture du devis impossible.");
    } finally {
      setBusy(false);
    }
  }

  /** Rattachement effectif : le choix de l'utilisateur prime sur la détection automatique. */
  function effectiveMatch(
    posteIndex: number,
    position: number,
    ref: string | null,
    designation: string,
  ): MatchResult | null {
    if (!ctx) return null;
    const key = quoteRowKey(posteIndex, position);
    if (key in choices) {
      const id = choices[key];
      return {
        status: id ? "manuel" : "aucun",
        productId: id ?? null,
        candidates: [],
        reason: "",
      };
    }
    return matchQuoteRow({ ref, designation }, ctx.products);
  }

  function renderMatch(
    posteIndex: number,
    position: number,
    ref: string | null,
    designation: string,
    kind: string,
  ) {
    if (kind !== "fourniture" || !ctx) return <span className="text-muted-foreground">—</span>;
    const m = effectiveMatch(posteIndex, position, ref, designation);
    const key = quoteRowKey(posteIndex, position);
    if (m?.productId) {
      const prod = ctx.products.find((x) => x.id === m.productId);
      return (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{prod?.code ?? "rattaché"}</Badge>
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setChoices((c) => ({ ...c, [key]: null }))}
          >
            retirer
          </button>
        </div>
      );
    }
    const candidates = m?.candidates ?? [];
    if (candidates.length > 0) {
      return (
        <Select value="" onValueChange={(v) => setChoices((c) => ({ ...c, [key]: v }))}>
          <SelectTrigger className="h-8 w-64">
            <SelectValue placeholder="Choisir l'article du catalogue" />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.productId} value={c.productId}>
                {c.code} — {c.designation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return <span className="text-destructive">absent du catalogue</span>;
  }

  function renderPau(
    posteIndex: number,
    position: number,
    ref: string | null,
    designation: string,
    kind: string,
  ) {
    if (kind !== "fourniture" || !ctx) return <span className="text-muted-foreground">—</span>;
    const m = effectiveMatch(posteIndex, position, ref, designation);
    if (!m?.productId) return <span className="text-muted-foreground">—</span>;
    const purchase = uniqueSupplierPurchase(
      ctx.offersByProduct.get(m.productId) ?? [],
      ctx.unitById.get(m.productId) ?? null,
    );
    return purchase?.pau_ht_applied != null ? (
      eur(purchase.pau_ht_applied)
    ) : (
      <span className="text-destructive">prix manquant</span>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Devis détaillé Henrri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="predevis-quote-pdf"
            type="file"
            accept=".pdf"
            disabled={busy}
            onChange={(e) => {
              setSelected(e.target.files?.[0] ?? null);
              setQuote(null);
            }}
          />
          <Button
            size="sm"
            disabled={!selected || busy}
            onClick={() => selected && analyse(selected)}
          >
            Analyser le devis
          </Button>
          {busy && <span className="text-muted-foreground">Lecture…</span>}
        </div>

        {quote && (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {fileName}
              {quote.devisNumber ? ` · devis n° ${quote.devisNumber}` : ""}
              {quote.totalHtDeclared != null
                ? ` · total HT déclaré ${eur(quote.totalHtDeclared)}`
                : ""}
            </p>

            {quote.warnings.length > 0 && (
              <ul className="list-disc pl-5 text-destructive">
                {quote.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {quote.postes.map((p) => (
              <section key={p.index} className="space-y-2 rounded-md border p-3">
                <header className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">
                    Poste {p.index} — {p.title ?? "sans titre (à nommer)"}
                  </h3>
                  <Badge variant={p.status === "ok" ? "secondary" : "destructive"}>
                    {p.status === "ok" ? "contrôle OK" : "à vérifier"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {p.rows.length} lignes · Sous Total {eur(p.subtotalHt)} · TTC {eur(p.sumTtc)}
                  </span>
                </header>
                {p.reasons.length > 0 && <p className="text-destructive">{p.reasons.join(" ")}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1">Réf.</th>
                        <th>Désignation</th>
                        <th className="text-right">Qté</th>
                        <th className="text-right">PU HT</th>
                        <th className="text-right">HT</th>
                        <th className="text-right">TTC</th>
                        <th className="pl-3">Rattachement catalogue</th>
                        <th className="text-right">PAU HT détecté</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.rows.map((r) => (
                        <tr key={r.position} className="border-t">
                          <td className="py-1 pr-2">{r.ref ?? "—"}</td>
                          <td className="pr-2">
                            {r.designation}
                            {r.continued && (
                              <Badge variant="outline" className="ml-2">
                                suite
                              </Badge>
                            )}
                            {r.kind === "mo" && (
                              <Badge variant="outline" className="ml-2">
                                MO
                              </Badge>
                            )}
                          </td>
                          <td className="text-right">{r.quantity ?? "—"}</td>
                          <td className="text-right">{eur(r.pu)}</td>
                          <td className="text-right">{eur(r.ht)}</td>
                          <td className="text-right">{eur(r.ttc)}</td>
                          <td className="pl-3">
                            {renderMatch(p.index, r.position, r.ref, r.designation, r.kind)}
                          </td>
                          <td className="text-right">
                            {renderPau(p.index, r.position, r.ref, r.designation, r.kind)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            {quote.orphanText.length > 0 && (
              <section>
                <h3 className="font-medium">Texte hors poste (non affecté)</h3>
                <p className="text-muted-foreground">{quote.orphanText.join(" ")}</p>
              </section>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy || quote.postes.length === 0}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { data: auth } = await supabase.auth.getUser();
                    const userId = auth.user?.id;
                    if (!userId) throw new Error("Session expirée, reconnecte-toi.");
                    const res = await saveQuoteDraft({ parse: quote, fileName, userId, choices });
                    await qc.invalidateQueries({ queryKey: ["predevis"] });
                    toast.success(
                      `Pré-devis enregistré : ${res.posteCount} postes, ${res.lineCount} lignes.`,
                    );
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enregistrer le pré-devis (brouillon)
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuote(null)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
