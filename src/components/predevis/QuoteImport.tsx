import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  missingFields,
  posteClientText,
  posteRecap,
  type ManualFields,
  type ManualValues,
  type RecapRow,
} from "@/lib/predevis-recap";
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

/** Montant prêt à coller (sans symbole). */
const amount = (n: number | null) => (n == null ? null : n.toFixed(2).replace(".", ","));

const FIELD_LABEL: Record<keyof ManualFields, string> = {
  pau: "PAU HT (€)",
  multiplier: "Multiplicateur d'unité",
  cost: "Coût HT (€)",
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copié.`);
  } catch {
    toast.error("Copie impossible dans ce navigateur.");
  }
}

type Ctx = Awaited<ReturnType<typeof loadMatchContext>>;
type ParsedPoste = QuoteParse["postes"][number];

export function QuoteImport() {
  const [quote, setQuote] = useState<QuoteParse | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [choices, setChoices] = useState<MatchChoices>({});
  const [manual, setManual] = useState<ManualValues>({});
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
      setManual({});
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

  /** Lignes d'un poste telles qu'elles seront enregistrées (rattachement et achat détecté compris). */
  function buildRecapRows(p: ParsedPoste): RecapRow[] {
    return p.rows.map((r) => {
      const pid = effectiveMatch(p.index, r.position, r.ref, r.designation)?.productId ?? null;
      return {
        key: quoteRowKey(p.index, r.position),
        kind: r.kind,
        designation: r.designation,
        quantity: r.quantity,
        ht: r.ht,
        ttc: r.ttc,
        unit: pid && ctx ? (ctx.unitById.get(pid) ?? null) : null,
        purchase:
          pid && ctx
            ? uniqueSupplierPurchase(
                ctx.offersByProduct.get(pid) ?? [],
                ctx.unitById.get(pid) ?? null,
              )
            : null,
      };
    });
  }

  function setManualField(key: string, field: keyof ManualFields, raw: string) {
    const value = raw.trim() === "" ? NaN : Number(raw.replace(",", "."));
    setManual((cur) => {
      const next: ManualFields = { ...(cur[key] ?? {}) };
      if (Number.isNaN(value) || value < 0) delete next[field];
      else next[field] = value;
      return { ...cur, [key]: next };
    });
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

            {quote.postes.map((p) => {
              const rows = buildRecapRows(p);
              const fin = posteRecap(rows, manual);
              const missing = missingFields(rows, manual);
              const clientText = posteClientText(rows);
              const noQuantity = rows.filter((r) => r.quantity == null);
              return (
                <section key={p.index} className="space-y-3 rounded-md border p-3">
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
                  {p.reasons.length > 0 && (
                    <p className="text-destructive">{p.reasons.join(" ")}</p>
                  )}

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
                      <tfoot>
                        <tr className="border-t-2 font-medium">
                          <td className="py-1 pr-2" colSpan={4}>
                            Total poste {p.index}
                          </td>
                          <td className="text-right">{eur(fin.pvHt)}</td>
                          <td className="text-right">{eur(fin.pvTtc)}</td>
                          <td />
                          <td className="text-right">{eur(fin.achatFournituresHt)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="space-y-2 rounded-md bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">Texte client</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!clientText}
                        onClick={() => copyText(clientText, "Texte client")}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copier le texte
                      </Button>
                    </div>
                    <p className="whitespace-pre-line">{clientText || "—"}</p>
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <RecapLine label="PV HT" value={eur(fin.pvHt)} />
                    <RecapLine
                      label="PV TTC"
                      value={eur(fin.pvTtc)}
                      copy={amount(fin.pvTtc)}
                      copyLabel="PV TTC"
                    />
                    <RecapLine
                      label="PAU HT (fournitures)"
                      value={eur(fin.achatFournituresHt)}
                      copy={amount(fin.achatFournituresHt)}
                      copyLabel="PAU HT"
                    />
                    <RecapLine
                      label="Prix de revient HT (fournitures + MO)"
                      value={eur(fin.prixAchatHt)}
                    />
                    <RecapLine label="Marge nette HT" value={eur(fin.margeHt)} strong />
                    <RecapLine
                      label="Taux de marge"
                      value={
                        fin.tauxMarge == null
                          ? "données insuffisantes"
                          : `${fin.tauxMarge.toFixed(2).replace(".", ",")} %`
                      }
                      strong
                    />
                  </div>

                  {(missing.length > 0 || fin.issues.length > 0 || noQuantity.length > 0) && (
                    <div className="space-y-2 rounded-md border border-destructive/50 p-3">
                      <p className="font-medium text-destructive">
                        Informations manquantes : saisis-les ici, elles seront enregistrées avec le
                        pré-devis.
                      </p>
                      {missing.map((m) => (
                        <div
                          key={`${m.key}-${m.field}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="min-w-0 flex-1">{m.label}</span>
                          <span className="text-muted-foreground">{FIELD_LABEL[m.field]}</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            className="h-8 w-32"
                            value={manual[m.key]?.[m.field] ?? ""}
                            onChange={(e) => setManualField(m.key, m.field, e.target.value)}
                          />
                        </div>
                      ))}
                      {noQuantity.map((r) => (
                        <p key={r.key} className="text-destructive">
                          Quantité absente du devis : {r.designation}
                        </p>
                      ))}
                      {fin.issues.map((i) => (
                        <p key={i} className="text-destructive">
                          {i}
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

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
                    const res = await saveQuoteDraft({
                      parse: quote,
                      fileName,
                      userId,
                      choices,
                      manual,
                    });
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

function RecapLine({
  label,
  value,
  copy,
  copyLabel,
  strong,
}: {
  label: string;
  value: string;
  copy?: string | null;
  copyLabel?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-80 text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
      {copy != null && copyLabel && (
        <Button size="sm" variant="outline" onClick={() => copyText(copy, copyLabel)}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copier
        </Button>
      )}
    </div>
  );
}
