import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@/components/pilot/EmptyState";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  chooseSupplier,
  computePosteFinance,
  linePurchaseOptions,
  listQuotes,
  loadQuoteDetail,
  setPosteReview,
  moveLineToPoste,
  updateLineFields,
  type QuoteDetail,
  type StoredQuoteLine,
} from "@/lib/predevis-data";
import type { SupplierOption } from "@/lib/predevis-match";
import { unaffected } from "@/lib/predevis-moves";

const KEY = ["predevis"] as const;
const eur = (n: number | null) =>
  n == null ? "données insuffisantes" : `${n.toFixed(2).replace(".", ",")} €`;
const pct = (n: number | null) =>
  n == null ? "données insuffisantes" : `${n.toFixed(2).replace(".", ",")} %`;
const optKey = (o: SupplierOption) => o.supplier_id ?? "__non_precise__";

export function QuotesPanel({
  onOpen,
  onCreate,
}: {
  onOpen: (id: string) => void;
  onCreate?: () => void;
}) {
  const { data, isLoading, error } = useQuery({ queryKey: [...KEY, "list"], queryFn: listQuotes });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data || data.length === 0)
    return (
      <EmptyState
        title="Aucun pré-devis enregistré"
        description="Importez un devis détaillé Henrri pour commencer."
        action={onCreate ? { label: "Importer un devis", onClick: onCreate } : undefined}
      />
    );
  return (
    <ul className="divide-y rounded-md border">
      {data.map((q) => (
        <li key={q.id} className="flex items-center justify-between gap-2 p-3 text-sm">
          <span>
            {q.title}
            <span className="ml-2 text-muted-foreground">
              {q.total_ht_declared != null ? eur(q.total_ht_declared) + " HT" : ""}
            </span>
          </span>
          <Button size="sm" variant="outline" onClick={() => onOpen(q.id)}>
            Ouvrir
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function QuoteEditor({ quoteId, onClose }: { quoteId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: [...KEY, "detail", quoteId],
    queryFn: () => loadQuoteDetail(quoteId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const fail = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");

  const chooseMut = useMutation({
    mutationFn: (args: { line: StoredQuoteLine; option: SupplierOption; unit: string | null }) =>
      chooseSupplier(args.line, args.option, args.unit),
    onSuccess: refresh,
    onError: fail,
  });
  const patchMut = useMutation({
    mutationFn: (args: { quoteId: string; id: string; patch: Record<string, unknown> }) =>
      updateLineFields(args.quoteId, args.id, args.patch),
    onSuccess: refresh,
    onError: fail,
  });
  const reviewMut = useMutation({
    mutationFn: (args: { id: string; status: "a_verifier" | "valide" }) =>
      setPosteReview(args.id, args.status),
    onSuccess: refresh,
    onError: fail,
  });

  const moveMut = useMutation({
    mutationFn: (args: { lineId: string; posteId: string | null }) =>
      moveLineToPoste(quoteId, args.lineId, args.posteId),
    onSuccess: refresh,
    onError: fail,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error || !data)
    return (
      <p className="text-sm text-destructive">
        {(error as Error | undefined)?.message ?? "Introuvable."}
      </p>
    );

  const detail: QuoteDetail = data;
  const unitOf = (line: StoredQuoteLine) =>
    detail.products.find((p) => p.id === line.catalogue_product_id)?.unit ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{detail.quote.title}</h2>
        <Button size="sm" variant="outline" onClick={onClose}>
          Retour
        </Button>
      </div>

      {unaffected(detail.lines).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lignes non affectées ({unaffected(detail.lines).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Glisse une ligne dans un poste, ou utilise « Déplacer vers » pour l'affecter. Elles ne
            comptent dans aucun poste.
          </CardContent>
          <CardContent>
            <LineList
              lines={unaffected(detail.lines)}
              postes={detail.postes}
              onMove={(lineId, posteId) => moveMut.mutate({ lineId, posteId })}
            />
          </CardContent>
        </Card>
      )}

      {detail.postes.map((poste) => {
        const lines = detail.lines.filter((l) => l.poste_id === poste.id);
        const fin = computePosteFinance(lines);
        return (
          <Card
            key={poste.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const lineId = e.dataTransfer.getData("text/plain");
              if (lineId) moveMut.mutate({ lineId, posteId: poste.id });
            }}
          >
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {poste.position}. {poste.title}
                <Badge variant={poste.review_status === "valide" ? "secondary" : "outline"}>
                  {poste.review_status === "valide" ? "validé" : "à vérifier"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1">Réf.</th>
                      <th>Désignation</th>
                      <th className="text-right">Qté</th>
                      <th>Fournisseur / prix</th>
                      <th className="text-right">HT</th>
                      <th className="text-right">Coût HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const moveRow = (
                        <div className="mt-1">
                          <MoveSelect
                            postes={detail.postes}
                            current={line.poste_id}
                            onMove={(posteId) => moveMut.mutate({ lineId: line.id, posteId })}
                          />
                        </div>
                      );
                      const options = linePurchaseOptions(line, detail.offers);
                      const selected = options.find(
                        (o) => o.supplier_id === line.supplier_id && line.pau_ht_applied != null,
                      );
                      const cost =
                        line.kind === "fourniture" &&
                        line.cost_status === "connu" &&
                        line.unit_status === "ok" &&
                        line.pau_ht_applied != null &&
                        line.quantity != null &&
                        line.unit_multiplier != null
                          ? Math.round(
                              line.quantity * line.unit_multiplier * line.pau_ht_applied * 100,
                            ) / 100
                          : null;
                      return (
                        <tr
                          key={line.id}
                          className="border-t align-top"
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData("text/plain", line.id)}
                        >
                          <td className="py-2 pr-2">
                            <span
                              aria-hidden="true"
                              className="cursor-grab select-none text-muted-foreground"
                            >
                              ⠿
                            </span>{" "}
                            {line.source_ref ?? "—"}
                          </td>
                          <td className="pr-2">
                            {line.designation}
                            {moveRow}
                            {line.kind === "mo" && (
                              <Badge variant="outline" className="ml-2">
                                MO
                              </Badge>
                            )}
                            {line.match_status === "a_confirmer" && (
                              <Badge variant="outline" className="ml-2">
                                rattachement à confirmer
                              </Badge>
                            )}
                          </td>
                          <td className="text-right">{line.quantity ?? "—"}</td>
                          <td className="pr-2">
                            {line.kind === "fourniture" ? (
                              <div className="space-y-1">
                                {options.length > 0 && (
                                  <Select
                                    value={selected ? optKey(selected) : undefined}
                                    onValueChange={(v) => {
                                      const opt = options.find((o) => optKey(o) === v);
                                      if (opt)
                                        chooseMut.mutate({ line, option: opt, unit: unitOf(line) });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-56">
                                      <SelectValue placeholder="Choisir un fournisseur" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {options.map((o) => (
                                        <SelectItem key={optKey(o)} value={optKey(o)}>
                                          {(o.supplier_name ?? "Fournisseur non précisé") +
                                            " — " +
                                            (o.pau_ht == null ? "prix manquant" : eur(o.pau_ht))}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                                <ManualPau
                                  line={line}
                                  onSave={(v) =>
                                    patchMut.mutate({
                                      quoteId,
                                      id: line.id,
                                      patch: {
                                        pau_ht_applied: v,
                                        cost_status: v == null ? "manquant" : "manuel",
                                        supplier_id: null,
                                      },
                                    })
                                  }
                                />
                                <Input
                                  className="h-8 w-28"
                                  type="number"
                                  step="0.0001"
                                  placeholder="multiplicateur"
                                  defaultValue={line.unit_multiplier ?? ""}
                                  onBlur={(e) => {
                                    const v = e.target.value === "" ? null : Number(e.target.value);
                                    patchMut.mutate({
                                      quoteId,
                                      id: line.id,
                                      patch: {
                                        unit_multiplier: v,
                                        unit_status: v == null ? "non_verifiee" : "ok",
                                      },
                                    });
                                  }}
                                />
                              </div>
                            ) : (
                              <MoCost
                                line={line}
                                onSave={(v, reason) =>
                                  patchMut.mutate({
                                    quoteId,
                                    id: line.id,
                                    patch: {
                                      manual_cost_ht: v,
                                      cost_status: v == null ? "manquant" : "manuel",
                                      zero_cost_reason: reason,
                                    },
                                  })
                                }
                              />
                            )}
                          </td>
                          <td className="text-right">{eur(line.ht)}</td>
                          <td className="text-right">
                            {line.kind === "mo" ? eur(line.manual_cost_ht) : eur(cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
                <div>
                  Prix de vente TTC : <strong>{eur(fin.pvTtc)}</strong>
                </div>
                <div>
                  PV HT : <strong>{eur(fin.pvHt)}</strong>
                </div>
                <div>
                  Prix d'achat HT : <strong>{eur(fin.prixAchatHt)}</strong>
                </div>
                <div>
                  Marge HT : <strong>{eur(fin.margeHt)}</strong>
                </div>
                <div>
                  Taux de marge : <strong>{pct(fin.tauxMarge)}</strong>
                </div>
                <div>
                  Part main-d'œuvre : <strong>{pct(fin.partMo)}</strong>
                </div>
                <div>
                  Part fournitures : <strong>{pct(fin.partFournitures)}</strong>
                </div>
              </div>
              {fin.issues.length > 0 && (
                <ul className="list-disc pl-5 text-destructive">
                  {fin.issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}

              <div className="space-y-1">
                <p className="text-muted-foreground">
                  Bloc texte client (à coller dans le devis client, sans prix)
                </p>
                <Textarea
                  readOnly
                  rows={Math.max(3, (poste.client_block ?? "").split("\n").length)}
                  value={poste.client_block ?? ""}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!poste.client_block}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(poste.client_block ?? "");
                      toast.success("Bloc client copié.");
                    } catch {
                      toast.error("Copie impossible : sélectionne le texte et copie-le à la main.");
                    }
                  }}
                >
                  Copier le bloc client
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!poste.client_block}
                  onClick={() => {
                    const blob = new Blob([`${poste.title}\n\n${poste.client_block ?? ""}\n`], {
                      type: "text/plain;charset=utf-8",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${poste.title.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60)}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Télécharger le bloc (.txt)
                </Button>
                <Button
                  size="sm"
                  disabled={!fin.complete || poste.review_status === "valide"}
                  onClick={() => reviewMut.mutate({ id: poste.id, status: "valide" })}
                  title={fin.complete ? undefined : "Indicateurs incomplets : valider après saisie"}
                >
                  Valider le poste
                </Button>
                {poste.review_status === "valide" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewMut.mutate({ id: poste.id, status: "a_verifier" })}
                  >
                    Repasser à vérifier
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ManualPau({
  line,
  onSave,
}: {
  line: StoredQuoteLine;
  onSave: (v: number | null) => void;
}) {
  const [value, setValue] = useState<string>(
    line.pau_ht_applied == null ? "" : String(line.pau_ht_applied),
  );
  return (
    <div className="flex items-center gap-2">
      <Input
        className="h-8 w-28"
        type="number"
        step="0.0001"
        placeholder="PAU HT saisi"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value === "" ? null : Number(value))}
      />
      <span className="text-xs text-muted-foreground">prix saisi à la main</span>
    </div>
  );
}

function MoCost({
  line,
  onSave,
}: {
  line: StoredQuoteLine;
  onSave: (v: number | null, reason: "remise" | "sav" | null) => void;
}) {
  const [value, setValue] = useState<string>(
    line.manual_cost_ht == null ? "" : String(line.manual_cost_ht),
  );
  const [reason, setReason] = useState<"remise" | "sav" | "">(line.zero_cost_reason ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="h-8 w-28"
        type="number"
        step="0.01"
        placeholder="coût HT"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value === "" ? null : Number(value), reason === "" ? null : reason)}
      />
      <Select
        value={reason || undefined}
        onValueChange={(v) => {
          setReason(v as "remise" | "sav");
          onSave(value === "" ? null : Number(value), v as "remise" | "sav");
        }}
      >
        <SelectTrigger className="h-8 w-32">
          <SelectValue placeholder="0 € : motif" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="remise">Remise commerciale</SelectItem>
          <SelectItem value="sav">SAV</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function MoveSelect({
  postes,
  current,
  onMove,
}: {
  postes: Array<{ id: string; position: number; title: string }>;
  current: string | null;
  onMove: (posteId: string | null) => void;
}) {
  return (
    <Select
      value={current ?? "__none__"}
      onValueChange={(v) => onMove(v === "__none__" ? null : v)}
    >
      <SelectTrigger className="h-8 w-56" aria-label="Déplacer vers un poste">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Non affectée</SelectItem>
        {postes.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.position}. {p.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LineList({
  lines,
  postes,
  onMove,
}: {
  lines: StoredQuoteLine[];
  postes: Array<{ id: string; position: number; title: string }>;
  onMove: (lineId: string, posteId: string | null) => void;
}) {
  return (
    <ul className="divide-y text-sm">
      {lines.map((l) => (
        <li
          key={l.id}
          className="flex flex-wrap items-center justify-between gap-2 py-2"
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
        >
          <span>
            {l.source_ref ? `${l.source_ref} — ` : ""}
            {l.designation}
          </span>
          <MoveSelect postes={postes} current={null} onMove={(posteId) => onMove(l.id, posteId)} />
        </li>
      ))}
    </ul>
  );
}
