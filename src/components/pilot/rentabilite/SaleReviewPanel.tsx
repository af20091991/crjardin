// Lignes de vente à examiner (rentabilité clients) : résolution directe sur la ligne.
// Chaque action passe par le moteur existant (rattachement journalisé, désignation, ignorer).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAttachmentCertification } from "@/components/pilot/useAttachmentCertification";
import { listClients } from "@/lib/clients";
import {
  linkEntryToClient,
  ignoreEntry,
  buildDesignationIndex,
  listLinkedEntries,
  suggestClients,
  type Suggestion,
} from "@/lib/pilot-ca-matching";
import { updateCaEntry } from "@/lib/pilot-ca";
import { VERDICT_META, type SaleVerdict } from "@/lib/pilot-attachment-certification";
import { formatEuro } from "@/lib/pilot";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

export function SaleReviewPanel() {
  const { report, refetch } = useAttachmentCertification();
  const [showAll, setShowAll] = useState(false);
  const queryClient = useQueryClient();
  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const linkedQ = useQuery({ queryKey: ["pilot-ca-linked-desig"], queryFn: listLinkedEntries });

  const pending = useMemo(
    () => (report?.sales ?? []).filter((s) => VERDICT_META[s.verdict].status !== "certifie"),
    [report],
  );

  const designationIndex = useMemo(() => buildDesignationIndex(linkedQ.data ?? []), [linkedQ.data]);

  /** Suggestions pour les lignes sans client (jamais pour une ligne déjà rattachée). */
  const suggestionsBySale = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    const cl = clientsQ.data ?? [];
    if (cl.length === 0) return map;
    for (const s of pending) {
      if (s.clientId) continue;
      map.set(
        s.saleId,
        suggestClients({ designation: s.designation ?? "" }, cl, designationIndex, { limit: 3 }),
      );
    }
    return map;
  }, [pending, clientsQ.data, designationIndex]);

  /** Rattachement automatique : preuve formelle uniquement (nom identique ou alias validé). */
  const autoReady = useMemo(
    () =>
      pending.flatMap((s) => {
        const top = suggestionsBySale.get(s.saleId)?.[0];
        if (!top || top.confidence !== "haute") return [];
        if (top.reason !== "exact" && top.reason !== "historique") return [];
        return [{ saleId: s.saleId, top }];
      }),
    [pending, suggestionsBySale],
  );

  const autoMut = useMutation({
    mutationFn: async () => {
      for (const r of autoReady) {
        await linkEntryToClient({
          entryId: r.saleId,
          clientId: r.top.client.id,
          method: "bulk",
          score: r.top.score,
          note: `Rapprochement automatique (${r.top.reason}) — ${r.top.evidence.join(" ; ")}`,
        });
      }
      return autoReady.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} ligne(s) rattachée(s) automatiquement`);
      for (const key of [
        "certif-sales",
        "certif-clients",
        "pilot-entries",
        "pilot-ca-orphans",
        "pilot-ca-linked-desig",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      refetch();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Rattachement automatique impossible"),
  });

  if (pending.length === 0) return null;
  const visible = showAll ? pending : pending.slice(0, 15);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="font-medium">Lignes à examiner</h3>
          <Badge variant="outline">{pending.length}</Badge>
          <Button
            size="sm"
            className="ml-auto"
            disabled={autoReady.length === 0 || autoMut.isPending}
            onClick={() => autoMut.mutate()}
            title="Ne rattache que les correspondances exactes ou déjà validées"
          >
            {autoMut.isPending
              ? "Rattachement…"
              : `Rattacher automatiquement (${autoReady.length})`}
          </Button>
        </div>
        <div className="space-y-2">
          {visible.map((s) => (
            <SaleRow
              key={s.saleId}
              sale={s}
              clients={clientsQ.data ?? []}
              suggestion={suggestionsBySale.get(s.saleId)?.[0]}
              onChanged={() => refetch()}
            />
          ))}
        </div>
        {pending.length > 15 && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Réduire" : `Voir les ${pending.length} lignes`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SaleRow({
  sale,
  clients,
  suggestion,
  onChanged,
}: {
  sale: SaleVerdict;
  clients: Array<{ id: string; name: string }>;
  suggestion?: Suggestion;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [designation, setDesignation] = useState(sale.designation ?? "");
  const [busy, setBusy] = useState(false);

  const done = (message: string) => {
    toast.success(message);
    queryClient.invalidateQueries({ queryKey: ["certif-sales"] });
    queryClient.invalidateQueries({ queryKey: ["certif-clients"] });
    queryClient.invalidateQueries({ queryKey: ["pilot-entries"] });
    onChanged();
  };
  const run = async (action: () => Promise<void>, message: string) => {
    setBusy(true);
    try {
      await action();
      done(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const meta = VERDICT_META[sale.verdict];
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-normal">
          {meta.label}
        </Badge>
        <span className="font-medium">{sale.clientName ?? "Client absent"}</span>
        <span className="ml-auto text-muted-foreground">{formatEuro(sale.amountHt)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{sale.detail}</p>

      {!sale.clientId && suggestion && (
        <div className="flex flex-wrap items-center gap-2 rounded bg-muted/50 p-2 text-xs">
          <span className="text-muted-foreground">
            Suggestion ({suggestion.confidence}) :{" "}
            <span className="font-medium text-foreground">{suggestion.client.name}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  linkEntryToClient({
                    entryId: sale.saleId,
                    clientId: suggestion.client.id,
                    method: "suggestion",
                    score: suggestion.score,
                    note: suggestion.evidence.join(" ; ") || null,
                  }),
                "Ligne rattachée",
              )
            }
          >
            Confirmer ce client
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="Désignation"
          className="h-8 w-64"
          aria-label="Désignation de la ligne"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={busy || designation.trim() === (sale.designation ?? "")}
          onClick={() =>
            run(
              () => updateCaEntry(sale.saleId, { designation: designation.trim() || null }),
              "Désignation enregistrée",
            )
          }
        >
          Enregistrer la désignation
        </Button>
        <Select
          disabled={busy}
          onValueChange={(clientId) =>
            run(
              () => linkEntryToClient({ entryId: sale.saleId, clientId, method: "manual" }),
              "Ligne rattachée",
            )
          }
        >
          <SelectTrigger className="h-8 w-56" aria-label="Rattacher à une fiche">
            <SelectValue placeholder="Rattacher à une fiche…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            run(() => ignoreEntry({ entryId: sale.saleId }), "Ligne ignorée des analyses clients")
          }
        >
          Ignorer la ligne
        </Button>
      </div>
    </div>
  );
}
