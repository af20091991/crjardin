// Nettoyage des fiches dupliquées (Chantier 4) : détection, comparaison des
// historiques, fusion MANUELLE uniquement, journal et annulation.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Merge, Undo2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { runReferentialAudit } from "@/lib/pilot-referential";
import { compareClients, listMergeLog, mergeClients, revertMerge } from "@/lib/client-merge";
import { formatEuro } from "@/lib/pilot";

const TABLE_LABELS: Record<string, string> = {
  pilot_ca_entries: "lignes CA",
  interventions: "interventions",
  ceev_contracts: "contrats CEEV",
  subcontractor_missions: "missions SST",
  recommendations: "recommandations",
  pilot_historic_hours: "heures historiques",
  pilot_client_notes: "notes",
  sites: "sites",
  contacts: "contacts",
  worksite_sheets: "fiches chantier",
};

export function DoublonsPanel() {
  const qc = useQueryClient();
  const audit = useQuery({ queryKey: ["pilot-referential-audit"], queryFn: runReferentialAudit });
  const log = useQuery({ queryKey: ["client-merge-log"], queryFn: () => listMergeLog(30) });
  const [pair, setPair] = useState<{ a: string; b: string; aName: string; bName: string } | null>(null);
  const [reason, setReason] = useState("");

  const pairs = useMemo(() => {
    const rows = audit.data?.rows ?? [];
    const seen = new Set<string>();
    const out: Array<{ aId: string; aName: string; bId: string; bName: string; reason: string; score: number }> = [];
    for (const r of rows) {
      for (const d of r.duplicateOf) {
        const key = [r.client_id, d.client_id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          aId: r.client_id, aName: r.name,
          bId: d.client_id, bName: d.name,
          reason: d.reason, score: d.score,
        });
      }
    }
    return out.sort((x, y) => y.score - x.score);
  }, [audit.data]);

  const comparison = useQuery({
    queryKey: ["client-merge-compare", pair?.a, pair?.b],
    queryFn: () => compareClients(pair!.a, pair!.b),
    enabled: !!pair,
  });

  const mergeMut = useMutation({
    mutationFn: (p: { sourceId: string; targetId: string }) =>
      mergeClients({ ...p, reason: reason.trim() || "Fusion manuelle validée par le dirigeant" }),
    onSuccess: (moved) => {
      const n = Object.values(moved).reduce((s, v) => s + v, 0);
      toast.success(`Fusion effectuée — ${n} élément(s) déplacé(s)`);
      setPair(null);
      setReason("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertMut = useMutation({
    mutationFn: (id: string) => revertMerge(id),
    onSuccess: () => {
      toast.success("Fusion annulée : la fiche est réactivée");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Copy className="h-4 w-4 text-primary" /> Doublons probables
            <Badge variant="outline" className="ml-auto text-[10px]">{pairs.length}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Aucune fusion automatique : la fiche absorbée est archivée (jamais supprimée), ses
            rattachements sont déplacés et la décision reste annulable.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {audit.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
            </div>
          ) : pairs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucun doublon probable détecté.</p>
          ) : (
            <ul className="divide-y text-sm">
              {pairs.slice(0, 40).map((p) => (
                <li key={`${p.aId}-${p.bId}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.aName} ↔ {p.bName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.reason} · score {(p.score * 100).toFixed(0)} %
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPair({ a: p.aId, b: p.bId, aName: p.aName, bName: p.bName });
                      setReason("");
                    }}
                  >
                    Comparer
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {pair && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Merge className="h-4 w-4 text-primary" /> Comparaison avant fusion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {comparison.isLoading || !comparison.data ? (
              <Skeleton className="h-24 w-full rounded-md" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { side: comparison.data.a, name: pair.aName, otherId: pair.b },
                  { side: comparison.data.b, name: pair.bName, otherId: pair.a },
                ].map(({ side, name, otherId }) => (
                  <div key={side.clientId} className="rounded-md border p-3">
                    <p className="font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      CA cumulé {formatEuro(side.caAmount)}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {Object.entries(side.counts)
                        .filter(([, n]) => (n as number) > 0)
                        .map(([t, n]) => (
                          <li key={t}>· {n} {TABLE_LABELS[t] ?? t}</li>
                        ))}
                    </ul>
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      disabled={mergeMut.isPending}
                      onClick={() =>
                        mergeMut.mutate({ sourceId: side.clientId, targetId: otherId })
                      }
                    >
                      Archiver cette fiche au profit de l'autre
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif de la fusion (conservé au journal)"
              />
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                La fiche choisie est archivée et son identifiant reste tracé : l'historique CA, les
                heures et les validations sont conservés.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPair(null)}>Fermer</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Journal des fusions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(log.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune fusion réalisée.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(log.data ?? []).map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <div className="truncate">
                      {l.source_client_name} → {l.target_client_name}
                      {l.reverted_at ? " (annulée)" : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("fr-FR")} ·{" "}
                      {Object.entries(l.moved ?? {})
                        .map(([t, n]) => `${n} ${TABLE_LABELS[t] ?? t}`)
                        .join(", ") || "aucun élément déplacé"}
                      {l.reason ? ` · ${l.reason}` : ""}
                    </div>
                  </div>
                  {!l.reverted_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={revertMut.isPending}
                      onClick={() => revertMut.mutate(l.id)}
                    >
                      <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Annuler
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
