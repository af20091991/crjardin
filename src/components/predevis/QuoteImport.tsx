import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  cascadeAmounts,
  missingFields,
  posteClientText,
  posteRecap,
  type AmountField,
  type ManualFields,
  type ManualHeader,
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
import { PosteSection, type ViewRow } from "@/components/predevis/PosteSection";
import { PredevisShell, SideCard, type PredevisStep } from "@/components/predevis/PredevisShell";
import { ChantierTotalsBar, PosteRow } from "@/components/predevis/PredevisPilotage";
import { detectThemes } from "@/lib/predevis-themes";
import { TARGET_MARGIN_PCT } from "@/lib/predevis-finance";
import { ChantierRecap } from "@/components/predevis/ChantierRecap";
import { chantierFinance, type PosteFinance } from "@/lib/predevis-finance";
import { AmountStepper } from "@/components/predevis/AmountStepper";
import { FilePicker } from "@/components/FilePicker";
import { eur } from "@/components/predevis/predevis-format";

const FIELD_LABEL: Record<keyof ManualFields, string> = {
  quantity: "Quantité",
  pau: "PAU HT (€)",
  multiplier: "Multiplicateur d'unité",
  cost: "Coût HT (€)",
  pu: "PU HT (€)",
  ht: "HT (€)",
  ttc: "TTC (€)",
};

/** Montant affiché dans un champ de saisie (vide si absent). */
const numText = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Vide = null (effacé) ; non numérique ou négatif = undefined (refusé). */
function parseAmountDraft(raw: string): number | null | undefined {
  if (raw.trim() === "") return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

type Ctx = Awaited<ReturnType<typeof loadMatchContext>>;
type ParsedPoste = QuoteParse["postes"][number];

export function QuoteImport({ onSaved }: { onSaved: (quoteId: string) => void }) {
  const [quote, setQuote] = useState<QuoteParse | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [choices, setChoices] = useState<MatchChoices>({});
  const [manual, setManual] = useState<ManualValues>({});
  const [fileName, setFileName] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [totalDraft, setTotalDraft] = useState<string>("");
  const [subDrafts, setSubDrafts] = useState<Record<number, string>>({});
  const [sstDrafts, setSstDrafts] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<File | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
      setSubDrafts({});
      setTitle(parsed.title ?? "");
      setTotalDraft(numText(parsed.totalHtDeclared));
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
        quantity: manual[quoteRowKey(p.index, r.position)]?.quantity ?? r.quantity,
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

  /** Saisie d'un montant ou de la quantité : les colonnes liées de la ligne se recalculent. */
  function editAmount(
    key: string,
    base: { quantity: number | null; pu: number | null; ht: number | null; ttc: number | null },
    field: AmountField,
    value: number | undefined,
  ) {
    setManual((cur) => ({ ...cur, [key]: cascadeAmounts(base, cur[key] ?? {}, field, value) }));
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setChoices((c) => ({ ...c, [key]: null }))}
          >
            Retirer
          </Button>
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
    const key = quoteRowKey(posteIndex, position);
    const m = effectiveMatch(posteIndex, position, ref, designation);
    const purchase = m?.productId
      ? uniqueSupplierPurchase(
          ctx.offersByProduct.get(m.productId) ?? [],
          ctx.unitById.get(m.productId) ?? null,
        )
      : null;
    const detected = purchase?.pau_ht_applied ?? null;
    const manualPau = manual[key]?.pau;
    if (manualPau == null && detected != null) return eur(detected);
    // Prix non détecté (ou saisi à la main) : saisie directe dans la ligne.
    return (
      <AmountStepper
        label={`PAU HT, ${designation}`}
        step={0.01}
        width="w-40"
        placeholder="À saisir"
        invalid={manualPau == null}
        value={manualPau}
        onChange={(v) => setManual((cur) => ({ ...cur, [key]: { ...(cur[key] ?? {}), pau: v } }))}
      />
    );
  }

  async function save() {
    if (!quote) return;
    if (!title.trim()) {
      toast.error("Donne un nom au devis.");
      return;
    }
    const totalHtDeclared = parseAmountDraft(totalDraft);
    const subtotals: Record<number, number | null> = {};
    for (const p of quote.postes) {
      const v = parseAmountDraft(subDrafts[p.index] ?? numText(p.subtotalHt));
      if (v === undefined) {
        toast.error(
          `Sous-total du poste ${p.index} invalide : saisis un nombre positif, ou laisse vide.`,
        );
        return;
      }
      subtotals[p.index] = v;
    }
    if (totalHtDeclared === undefined) {
      toast.error("Total HT déclaré invalide : saisis un nombre positif, ou laisse vide.");
      return;
    }
    const sst: Record<number, number | null> = {};
    for (const p of quote.postes) sst[p.index] = parseAmountDraft(sstDrafts[p.index] ?? "") ?? null;
    const header: ManualHeader = { title: title.trim(), totalHtDeclared, subtotals, sst };
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
        header,
      });
      await qc.invalidateQueries({ queryKey: ["predevis"] });
      toast.success(`Devis enregistré : ${res.posteCount} postes, ${res.lineCount} lignes.`);
      setQuote(null);
      setSelected(null);
      onSaved(res.quoteId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  // Indicateurs par poste, calculés une fois : bandeau, synthèse et liste s'en servent.
  const sstFor = (index: number) => parseAmountDraft(sstDrafts[index] ?? "") ?? null;
  const rowsByPoste = new Map(quote?.postes.map((p) => [p.index, buildRecapRows(p)]) ?? []);
  const finsByPoste = new Map<number, PosteFinance>(
    (quote?.postes ?? []).map((p) => [
      p.index,
      posteRecap(rowsByPoste.get(p.index) ?? [], manual, sstFor(p.index)),
    ]),
  );
  const finsChantier = (quote?.postes ?? []).map((p) => finsByPoste.get(p.index)!);
  // Éléments bloquants : tout ce qui manque pour calculer la rentabilité, avec son champ de saisie.
  const blockers = (quote?.postes ?? []).flatMap((p) => {
    const recapRows = rowsByPoste.get(p.index) ?? [];
    const missing = missingFields(recapRows, manual).map((m) => ({ ...m, poste: p.index }));
    const noQuantity = recapRows
      .filter((r) => r.quantity == null)
      .map((r) => ({ key: r.key, poste: p.index, designation: r.designation }));
    return { missing, noQuantity };
  });
  const missingAll = blockers.flatMap((b) => b.missing);
  const noQuantityAll = blockers.flatMap((b) => b.noQuantity);
  const blockingCount = missingAll.length + noQuantityAll.length + (title.trim() ? 0 : 1);
  const currentIndex = openIndex ?? quote?.postes[0]?.index ?? null;
  const openPoste = quote?.postes.find((p) => p.index === currentIndex) ?? null;
  const postesSousSeuil = finsChantier.filter(
    (f) => f.tauxMargeAvecSst != null && f.tauxMargeAvecSst < TARGET_MARGIN_PCT,
  ).length;

  const steps: PredevisStep[] = [
    {
      label: "Import et blocages",
      hint: blockingCount > 0 ? `${blockingCount} à lever` : "Tout est levé",
      state: quote ? (blockingCount > 0 ? "current" : "done") : "current",
    },
    {
      label: "Rentabilité",
      hint: "Marges et SST",
      state: quote ? (blockingCount > 0 ? "locked" : "current") : "locked",
    },
    { label: "Texte client", hint: "Puis enregistrement", state: "locked" },
  ];

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="font-display text-lg">Importer un devis Henrri détaillé</h2>
          <p className="text-sm text-muted-foreground">
            Les prix d'achat sont lus automatiquement depuis le catalogue importé.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilePicker
            id="predevis-quote-pdf"
            accept=".pdf"
            disabled={busy}
            fileName={selected?.name}
            label="Choisir le devis (PDF)"
            onFile={(file) => {
              setSelected(file);
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
          {busy && <span className="text-sm text-muted-foreground">Lecture…</span>}
        </div>
      </section>

      {quote && openPoste && (
        <PredevisShell
          crumbs={
            <>
              <span className="text-muted-foreground">Pré-devis</span>
              <span className="text-muted-foreground">›</span>
              <strong className="font-semibold">{title || "Nouveau devis"}</strong>
            </>
          }
          status="Brouillon"
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setQuote(null)}>
                Fermer
              </Button>
              <Button
                size="sm"
                disabled={busy || quote.postes.length === 0 || blockingCount > 0}
                onClick={save}
                title={blockingCount > 0 ? "Lève d'abord les éléments bloquants" : undefined}
              >
                Enregistrer dans Devis importés
              </Button>
            </>
          }
          totals={
            <ChantierTotalsBar
              f={chantierFinance(finsChantier)}
              postesSousSeuil={postesSousSeuil}
            />
          }
          steps={steps}
          aside={
            <>
              <SideCard title="À traiter">
                {blockingCount === 0 ? (
                  <p className="text-muted-foreground">
                    Rien à lever : la rentabilité est calculée.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {missingAll.map((m) => (
                      <li key={`${m.key}-${m.field}`}>
                        Poste {m.poste} · {m.label} : {FIELD_LABEL[m.field]}
                      </li>
                    ))}
                    {noQuantityAll.map((r) => (
                      <li key={r.key}>
                        Poste {r.poste} · quantité absente : {r.designation}
                      </li>
                    ))}
                  </ul>
                )}
              </SideCard>
              <SideCard title="Texte client">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {posteClientText(rowsByPoste.get(openPoste.index) ?? []) || "—"}
                </p>
              </SideCard>
            </>
          }
        >
          {quote.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {quote.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}

          {/* Étape 1 : identification et éléments bloquants */}
          <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-[1fr_auto] md:items-end">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Nom du devis</span>
              <Input
                className="h-9 font-medium"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Total HT déclaré (€)</span>
              <AmountStepper
                label="Total HT déclaré"
                step={0.01}
                width="w-44"
                value={parseAmountDraft(totalDraft) ?? undefined}
                onChange={(v) => setTotalDraft(v == null ? "" : String(v))}
              />
            </label>
            <p className="text-sm text-muted-foreground md:col-span-2">
              {fileName}
              {quote.devisNumber ? ` · devis n° ${quote.devisNumber}` : ""}
            </p>
          </section>

          {blockingCount > 0 && (
            <section className="space-y-3 rounded-xl border border-destructive/50 bg-card p-5">
              <h3 className="font-display text-lg">
                {blockingCount} élément{blockingCount > 1 ? "s" : ""} à lever avant la rentabilité
              </h3>
              <p className="text-sm text-muted-foreground">
                Ces montants sont saisis ici, sans passer par les postes.
              </p>
              {missingAll.map((m) => (
                <div
                  key={`${m.key}-${m.field}`}
                  className="flex flex-wrap items-center gap-3 border-t pt-3"
                >
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="text-muted-foreground">Poste {m.poste} · </span>
                    {m.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{FIELD_LABEL[m.field]}</span>
                  <AmountStepper
                    label={`${FIELD_LABEL[m.field]}, ${m.label}`}
                    step={0.01}
                    value={manual[m.key]?.[m.field]}
                    onChange={(v) =>
                      setManual((cur) => ({
                        ...cur,
                        [m.key]: { ...(cur[m.key] ?? {}), [m.field]: v },
                      }))
                    }
                  />
                </div>
              ))}
              {noQuantityAll.map((r) => (
                <p key={r.key} className="border-t pt-3 text-sm text-destructive">
                  Poste {r.poste} · quantité absente du devis : {r.designation}
                </p>
              ))}
            </section>
          )}

          {/* Étape 2 : rentabilité, verrouillée tant que des blocages restent */}
          {blockingCount === 0 ? (
            <>
              <section className="space-y-2 rounded-xl border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Postes du devis
                </p>
                <div className="divide-y">
                  {quote.postes.map((p) => {
                    const recap = rowsByPoste.get(p.index) ?? [];
                    const detected = detectThemes(
                      p.title ?? "",
                      recap.map((r) => r.designation),
                    ).main;
                    return (
                      <PosteRow
                        key={p.index}
                        index={p.index}
                        title={p.title ?? "sans titre (à nommer)"}
                        theme={detected}
                        fin={finsByPoste.get(p.index)!}
                        open={p.index === currentIndex}
                        onOpen={() => setOpenIndex(p.index)}
                        flag={p.status === "ok" ? null : "à vérifier"}
                      />
                    );
                  })}
                </div>
              </section>

              {(() => {
                const p = openPoste;
                const recapRows = rowsByPoste.get(p.index) ?? [];
                const fin = finsByPoste.get(p.index)!;
                const sstValue = sstFor(p.index);
                const rows: ViewRow[] = p.rows.map((r) => {
                  const key = quoteRowKey(p.index, r.position);
                  const base = { quantity: r.quantity, pu: r.pu, ht: r.ht, ttc: r.ttc };
                  const cur = manual[key] ?? {};
                  const shown = {
                    quantity: cur.quantity ?? r.quantity,
                    pu: cur.pu ?? r.pu,
                    ht: cur.ht ?? r.ht,
                    ttc: cur.ttc ?? r.ttc,
                  };
                  const amountCell = (f: "quantity" | "pu" | "ht" | "ttc") => (
                    <AmountStepper
                      label={`${FIELD_LABEL[f]}, ${r.designation}`}
                      step={f === "quantity" ? 1 : 0.01}
                      width={f === "quantity" ? "w-32" : "w-40"}
                      value={shown[f]}
                      onChange={(v) => editAmount(key, base, f, v)}
                    />
                  );
                  return {
                    key: String(r.position),
                    ref: r.ref,
                    designation: r.designation,
                    kind: r.kind,
                    continued: r.continued,
                    quantity: shown.quantity,
                    pu: shown.pu,
                    ht: shown.ht,
                    ttc: shown.ttc,
                    pau: renderPau(p.index, r.position, r.ref, r.designation, r.kind),
                    rattachement: renderMatch(p.index, r.position, r.ref, r.designation, r.kind),
                    editable: {
                      quantity: amountCell("quantity"),
                      pu: amountCell("pu"),
                      ht: amountCell("ht"),
                      ttc: amountCell("ttc"),
                    },
                  };
                });
                return (
                  <PosteSection
                    key={p.index}
                    index={p.index}
                    title={p.title ?? "sans titre (à nommer)"}
                    meta={
                      <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {p.rows.length} lignes · Sous-total
                        <AmountStepper
                          label={`Sous-total poste ${p.index}`}
                          step={0.01}
                          width="w-44"
                          value={
                            parseAmountDraft(subDrafts[p.index] ?? numText(p.subtotalHt)) ??
                            undefined
                          }
                          onChange={(v) =>
                            setSubDrafts((d) => ({ ...d, [p.index]: v == null ? "" : String(v) }))
                          }
                        />
                        · TTC {eur(p.sumTtc)}
                      </span>
                    }
                    rows={rows}
                    fin={fin}
                    sst={{
                      value: sstValue,
                      editor: (
                        <AmountStepper
                          label={`Coût SST poste ${p.index}`}
                          step={0.01}
                          width="w-40"
                          value={sstValue ?? undefined}
                          onChange={(v) =>
                            setSstDrafts((d) => ({ ...d, [p.index]: v == null ? "" : String(v) }))
                          }
                        />
                      ),
                    }}
                    clientText={posteClientText(recapRows)}
                  >
                    {fin.issues.length > 0 && (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {fin.issues.map((i) => (
                          <p key={i}>{i}</p>
                        ))}
                      </div>
                    )}
                  </PosteSection>
                );
              })()}

              {finsChantier.length > 0 && (
                <ChantierRecap
                  f={chantierFinance(finsChantier)}
                  postesSousSeuil={postesSousSeuil}
                />
              )}
            </>
          ) : (
            <section className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
              La rentabilité s'affiche dès que les éléments ci-dessus sont levés.
            </section>
          )}

          {quote.orphanText.length > 0 && (
            <section className="rounded-xl border bg-card p-6">
              <h3 className="font-display text-lg">Texte hors poste (non affecté)</h3>
              <p className="mt-2 text-sm text-muted-foreground">{quote.orphanText.join(" ")}</p>
            </section>
          )}
        </PredevisShell>
      )}
    </div>
  );
}
