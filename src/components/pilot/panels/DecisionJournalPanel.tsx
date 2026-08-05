// ---------------------------------------------------------------------------
// Journal des décisions de rapprochement (Chantier 1).
// Historise et permet d'annuler chaque décision humaine :
//  - rattachement / ignorance d'une ligne de CA (pilot_ca_match_log)
//  - fusion manuelle de fiches clients (client_merge_log)
// Aucune donnée n'est recalculée ici : le journal reflète l'état réel de la base.
// ---------------------------------------------------------------------------
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { listRecentDecisions, revertLastDecision, type MatchMethod } from "@/lib/pilot-ca-matching";
import { listMergeLog, revertMerge } from "@/lib/client-merge";
import { listClients } from "@/lib/clients";

const METHOD_LABEL: Record<MatchMethod, string> = {
  manual: "Client choisi manuellement",
  suggestion: "Suggestion validée",
  new_client: "Fiche client créée",
  refused: "Ligne ignorée",
  reverted: "Décision annulée",
  bulk: "Rapprochement en série",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DecisionJournalPanel() {
  const qc = useQueryClient();
  const decisions = useQuery({ queryKey: ["pilot-ca-decisions", 100], queryFn: () => listRecentDecisions(100) });
  const merges = useQuery({ queryKey: ["client-merge-log"], queryFn: () => listMergeLog(50) });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients.data ?? []) m.set(c.id, c.name);
    return m;
  }, [clients.data]);
  const label = (id: string | null) => (id ? (nameById.get(id) ?? "Client supprimé") : "Aucun client");

  const invalidate = () => {
    for (const key of [
      ["pilot-ca-decisions", 100],
      ["pilot-ca-orphans"],
      ["pilot-ca-orphan-count"],
      ["pilot-ca-non-applicable"],
      ["client-merge-log"],
      ["pilot-ca-entries"],
    ]) {
      qc.invalidateQueries({ queryKey: key as never });
    }
  };

  const revertCa = useMutation({
    mutationFn: (entryId: string) => revertLastDecision(entryId),
    onSuccess: () => {
      toast.success("Décision annulée : la ligne retrouve son état précédent");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revertMergeMut = useMutation({
    mutationFn: (id: string) => revertMerge(id),
    onSuccess: () => {
      toast.success("Fusion annulée : la fiche absorbée est réactivée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (decisions.isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const rows = decisions.data ?? [];
  const mergeRows = merges.data ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Décisions de rapprochement du chiffre d'affaires</CardTitle>
          <p className="text-xs text-muted-foreground">
            Chaque décision modifie réellement la donnée source et reste annulable. Annuler
            restaure l'affectation précédente et remet la ligne dans la file d'attente.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Ancienne valeur</TableHead>
                <TableHead>Nouvelle valeur</TableHead>
                <TableHead className="text-right">Annuler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDate(d.decided_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {METHOD_LABEL[d.method] ?? d.method}
                    {d.note ? <span className="block text-xs text-muted-foreground">{d.note}</span> : null}
                  </TableCell>
                  <TableCell className="text-sm">{label(d.previous_client_id)}</TableCell>
                  <TableCell className="text-sm font-medium">{label(d.new_client_id)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      disabled={d.method === "reverted" || revertCa.isPending}
                      onClick={() => revertCa.mutate(d.entry_id)}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Annuler
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Aucune décision enregistrée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fusions de fiches clients</CardTitle>
          <p className="text-xs text-muted-foreground">
            Fusions manuelles uniquement. La fiche absorbée est conservée et peut être réactivée.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Fiche absorbée</TableHead>
                <TableHead>Fiche conservée</TableHead>
                <TableHead>Éléments déplacés</TableHead>
                <TableHead className="text-right">Annuler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mergeRows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDate(m.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">{m.source_client_name}</TableCell>
                  <TableCell className="text-sm font-medium">{m.target_client_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {Object.entries(m.moved ?? {})
                      .filter(([, n]) => Number(n) > 0)
                      .map(([t, n]) => `${t} : ${n}`)
                      .join(" · ") || "aucun"}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.reverted_at ? (
                      <Badge variant="outline">Annulée</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={revertMergeMut.isPending}
                        onClick={() => revertMergeMut.mutate(m.id)}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Annuler
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {mergeRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Aucune fusion enregistrée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
