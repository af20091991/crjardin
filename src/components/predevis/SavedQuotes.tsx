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
  toStoredLine,
  type LineAmountPatch,
  type QuoteDetail,
  type StoredQuoteLine,
} from "@/lib/predevis-data";
import type { StoredLine } from "@/lib/predevis-lines";
import {
  cascadeAmounts,
  pauCompletionFields,
  storedPosteRecap,
  type AmountField,
} from "@/lib/predevis-recap";
import { PosteSection, type ViewRow } from "@/components/predevis/PosteSection";
import { AmountStepper } from "@/components/predevis/AmountStepper";
import { eur } from "@/components/predevis/predevis-format";
import { ChantierRecap } from "@/components/predevis/ChantierRecap";
import { PredevisShell, SideCard, type PredevisStep } from "@/components/predevis/PredevisShell";
import {
  ChantierTotalsBar,
  PosteRow,
  QuoteBlockers,
  ThemeBenchmark,
  ThemePicker,
} from "@/components/predevis/PredevisPilotage";
import { chantierFinance, TARGET_MARGIN_PCT, type PosteFinance } from "@/lib/predevis-finance";
import { detectThemes } from "@/lib/predevis-themes";

const num = (v: unknown) => (v == null ? null : Number(v));
const showNum = (n: number | null | undefined) => (n == null ? "" : String(Number(n)));

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
  for (const p of data.postes) {
    out[`p:${p.id}`] = show(num(p.subtotal_ht));
    out[`s:${p.id}`] = show(num(p.sst_cost_ht));
  }
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
  const [openPosteId, setOpenPosteId] = useState<string | null>(null);
  const versions = useQuery({ queryKey: ["predevis", "quotes"], queryFn: listQuotes });
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

  /** Quantité ou montant d'une ligne : les colonnes liées se recalculent (HT, TTC, PU). */
  function editLineAmount(line: StoredQuoteLine, f: AmountField, value: number | undefined) {
    const base = {
      quantity: num(line.quantity),
      pu: num(line.pu_ht),
      ht: num(line.ht),
      ttc: num(line.ttc),
    };
    setDrafts((d) => {
      const read = (name: string) => parseAmount(d[`l:${line.id}:${name}`] ?? "") ?? undefined;
      const next = cascadeAmounts(
        base,
        {
          quantity: read("quantity"),
          pu: read("pu_ht"),
          ht: read("ht"),
          ttc: read("ttc"),
        },
        f,
        value,
      );
      return {
        ...d,
        [`l:${line.id}:quantity`]: showNum(next.quantity),
        [`l:${line.id}:pu_ht`]: showNum(next.pu),
        [`l:${line.id}:ht`]: showNum(next.ht),
        [`l:${line.id}:ttc`]: showNum(next.ttc),
      };
    });
  }

  function startEdit() {
    setDrafts(initialDrafts(data as QuoteDetail));
    setEditing(true);
  }

  async function save() {
    const current = data as QuoteDetail;
    const init = initialDrafts(current);
    const lines: Record<string, LineAmountPatch> = {};
    const postes: Record<string, number | null> = {};
    const sst: Record<string, number | null> = {};
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
      } else if (key.startsWith("s:")) {
        sst[key.slice(2)] = value;
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
      await saveQuoteAmounts({ quoteId, lines, postes, sst, totalHtDeclared, title });
      await qc.invalidateQueries({ queryKey: ["predevis"] });
      toast.success("Montants enregistrés.");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  /** Montant saisi dans le brouillon : curseurs − / + et saisie au centime. */
  const stepper = (
    key: string,
    step: number,
    label: string,
    width = "w-40",
    onValue?: (v: number | undefined) => void,
  ) => (
    <AmountStepper
      label={label}
      step={step}
      width={width}
      value={parseAmount(drafts[key] ?? "") ?? undefined}
      onChange={onValue ?? ((v) => setDraft(key, showNum(v)))}
    />
  );

  // Indicateurs de chaque poste calculés une fois : le bandeau, les blocages et la synthèse s'en servent.
  const linesOf = (posteId: string) =>
    (data.lines ?? [])
      .filter((l) => l.poste_id === posteId)
      .sort((a, b) => a.position - b.position);
  // En modification, les indicateurs suivent les montants saisis (pas encore enregistrés).
  const liveLine = (l: StoredQuoteLine): StoredLine => {
    const s = toStoredLine(l);
    if (!editing) return s;
    const read = (name: string) => parseAmount(drafts[`l:${l.id}:${name}`] ?? "") ?? null;
    const pau = read("pau_ht_applied");
    return {
      ...s,
      quantity: read("quantity"),
      ht: read("ht"),
      ttc: read("ttc"),
      manual_cost_ht: read("manual_cost_ht"),
      pau_ht_applied: pau,
      cost_status: pau != null ? "connu" : s.cost_status,
      unit_status: pau != null ? "ok" : s.unit_status,
      unit_multiplier: pau != null ? (s.unit_multiplier ?? 1) : s.unit_multiplier,
    };
  };
  // Coût SST : saisi dans le brouillon en modification, sinon celui enregistré.
  const sstOf = (posteId: string) =>
    editing
      ? (parseAmount(drafts[`s:${posteId}`] ?? "") ?? null)
      : num(data.postes.find((p) => p.id === posteId)?.sst_cost_ht);
  const finsByPoste = new Map<string, PosteFinance>(
    data.postes.map((p) => [p.id, storedPosteRecap(linesOf(p.id).map(liveLine), sstOf(p.id))]),
  );
  const finsChantier: PosteFinance[] = data.postes.map((p) => finsByPoste.get(p.id)!);
  // Lignes de fourniture sans prix d'achat, ni motif « sans achat » : elles bloquent l'archivage.
  const manquantsOf = (posteId: string) =>
    linesOf(posteId).filter(
      (l) => l.line_kind === "fourniture" && l.zero_cost_reason == null && l.pau_ht_applied == null,
    ).length;
  const incomplets = data.postes
    .map((p) => ({ position: p.position, posteId: p.id, issues: manquantsOf(p.id) }))
    .filter((p) => p.issues > 0);
  const sansTheme = data.postes.filter((p) => p.theme == null).length;
  const postesSousSeuil = finsChantier.filter(
    (f) => f.tauxMargeAvecSst != null && f.tauxMargeAvecSst < TARGET_MARGIN_PCT,
  ).length;

  const openId = openPosteId ?? data.postes[0]?.id ?? null;
  const openPoste = data.postes.find((p) => p.id === openId) ?? null;
  const olderVersions = (versions.data ?? []).filter(
    (v) =>
      !!data.quote.devis_number &&
      v.devis_number === data.quote.devis_number &&
      v.id !== data.quote.id &&
      !v.superseded_at &&
      v.created_at < data.quote.created_at,
  ).length;
  const blockingCount = incomplets.length + sansTheme + (olderVersions > 0 ? 1 : 0);
  const steps: PredevisStep[] = [
    {
      label: "Éléments bloquants",
      hint: blockingCount > 0 ? `${blockingCount} à lever` : "Tout est levé",
      state: data.quote.archived_at ? "done" : blockingCount > 0 ? "current" : "done",
    },
    {
      label: "Rentabilité",
      hint: "Postes et marges",
      state: data.quote.archived_at ? "done" : "current",
    },
    {
      label: "Archivage",
      hint: data.quote.archived_at ? "Archivé" : "Après levée",
      state: data.quote.archived_at ? "done" : blockingCount > 0 ? "locked" : "current",
    },
  ];

  return (
    <PredevisShell
      crumbs={
        <>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Devis importés
          </Button>
          <span className="text-muted-foreground">›</span>
          <strong className="font-semibold">{data.quote.title}</strong>
        </>
      }
      status={data.quote.archived_at ? "Archivé" : "Brouillon"}
      actions={
        !editing ? (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Modifier les montants
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button size="sm" disabled={saving} onClick={save}>
              Enregistrer les montants
            </Button>
          </>
        )
      }
      totals={
        <ChantierTotalsBar f={chantierFinance(finsChantier)} postesSousSeuil={postesSousSeuil} />
      }
      steps={steps}
      aside={
        <>
          <SideCard title="Devis">
            <p>{data.quote.devis_number ? `N° ${data.quote.devis_number}` : "Sans numéro"}</p>
            <p className="text-muted-foreground">
              Total HT déclaré{" "}
              {editing
                ? stepper("q", 0.01, "Total HT déclaré")
                : eur(num(data.quote.total_ht_declared))}
            </p>
            <p className="text-muted-foreground">
              Enregistré le {new Date(data.quote.created_at).toLocaleDateString("fr-FR")}
            </p>
          </SideCard>
          {openPoste && (
            <SideCard title="Texte client">
              <p className="whitespace-pre-wrap text-muted-foreground">
                {openPoste.client_block || "—"}
              </p>
            </SideCard>
          )}
        </>
      }
    >
      {editing && (
        <section className="rounded-xl border bg-card p-5">
          <Input
            className="h-9 font-display text-xl"
            value={drafts.t ?? ""}
            onChange={(e) => setDraft("t", e.target.value)}
            aria-label="Nom du devis"
          />
        </section>
      )}

      <QuoteBlockers
        quote={data.quote}
        incomplets={incomplets}
        sansTheme={sansTheme}
        onEditCosts={startEdit}
      />

      <section className="space-y-2 rounded-xl border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Postes du devis
        </p>
        <div className="divide-y">
          {data.postes.map((poste) => {
            const lines = linesOf(poste.id);
            const detected = detectThemes(
              poste.title,
              lines.map((l) => l.designation),
            ).main;
            return (
              <PosteRow
                key={poste.id}
                index={poste.position}
                title={poste.title}
                theme={poste.theme ?? detected}
                fin={finsByPoste.get(poste.id)!}
                open={poste.id === openId}
                onOpen={() => setOpenPosteId(poste.id)}
                flag={poste.review_status === "valide" ? null : "à vérifier"}
              />
            );
          })}
        </div>
      </section>

      {data.postes.map((poste) => {
        const lines = linesOf(poste.id);
        const fin = finsByPoste.get(poste.id)!;
        const sstValue = sstOf(poste.id);
        if (poste.id !== openId) return null;
        const rows: ViewRow[] = lines.map((l) => {
          const isFourniture = l.line_kind === "fourniture";
          const pauCell = !isFourniture ? (
            editing ? (
              stepper(`l:${l.id}:manual_cost_ht`, 0.01, `Coût HT, ${l.designation}`)
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          ) : editing ? (
            stepper(`l:${l.id}:pau_ht_applied`, 0.01, `PAU HT, ${l.designation}`)
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
                  quantity: stepper(
                    `l:${l.id}:quantity`,
                    1,
                    `Quantité, ${l.designation}`,
                    "w-32",
                    (v) => editLineAmount(l, "quantity", v),
                  ),
                  pu: stepper(`l:${l.id}:pu_ht`, 0.01, `PU HT, ${l.designation}`, "w-40", (v) =>
                    editLineAmount(l, "pu", v),
                  ),
                  ht: stepper(`l:${l.id}:ht`, 0.01, `HT, ${l.designation}`, "w-40", (v) =>
                    editLineAmount(l, "ht", v),
                  ),
                  ttc: stepper(`l:${l.id}:ttc`, 0.01, `TTC, ${l.designation}`, "w-40", (v) =>
                    editLineAmount(l, "ttc", v),
                  ),
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
              <span className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {lines.length} lignes · Sous-total{" "}
                {editing
                  ? stepper(`p:${poste.id}`, 0.01, `Sous-total poste ${poste.position}`)
                  : eur(num(poste.subtotal_ht))}
                <ThemePicker poste={poste} lines={linesOf(poste.id)} />
              </span>
            }
            rows={rows}
            fin={fin}
            sst={{
              value: sstValue,
              editor: editing
                ? stepper(`s:${poste.id}`, 0.01, `Coût SST poste ${poste.position}`)
                : undefined,
            }}
            clientText={poste.client_block ?? ""}
          />
        );
      })}

      {finsChantier.length > 0 && (
        <ChantierRecap f={chantierFinance(finsChantier)} postesSousSeuil={postesSousSeuil} />
      )}
      {finsChantier.length > 0 && (
        <ThemeBenchmark
          postes={data.postes.map((p) => ({ theme: p.theme ?? null, fin: finsByPoste.get(p.id)! }))}
        />
      )}
    </PredevisShell>
  );
}
