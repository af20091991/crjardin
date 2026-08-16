// Certification des rattachements CA → client.
// Lecture du moteur `src/lib/pilot-attachment-certification.ts` : chaque ligne
// de vente du périmètre reçoit un motif unique. Seule action possible :
// certifier une fiche dont TOUTES les lignes sont démontrables (journalisée).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAttachmentCertification } from "@/components/pilot/useAttachmentCertification";
import { INTEGRITY_LABEL, type IntegrityStatus } from "@/lib/pilot-integrity";
import { VERDICT_META } from "@/lib/pilot-attachment-certification";
import { setEntityStatusQuick, type EntityStatus } from "@/lib/pilot-referential";
import { formatEuro } from "@/lib/format-utils";

const TONE: Record<IntegrityStatus, string> = {
  certifie: "border-primary/30 bg-primary/5 text-primary",
  incomplet: "border-amber-300 bg-amber-50 text-amber-800",
  suspect: "border-orange-300 bg-orange-50 text-orange-800",
  indisponible: "border-destructive/40 bg-destructive/5 text-destructive",
};

export function AttachmentCertificationPanel() {
  const { report, isLoading, error, refetch } = useAttachmentCertification();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);

  const certify = useMutation({
    mutationFn: (row: { clientId: string; clientName: string; previousStatus: string | null }) =>
      setEntityStatusQuick({
        clientId: row.clientId,
        clientName: row.clientName,
        status: "certified_client",
        previousStatus: (row.previousStatus ?? "manual_review_required") as EntityStatus,
        reason:
          "Certification du rattachement : toutes les lignes de vente du périmètre sont rapprochées de manière unique et cohérente.",
      }),
    onSuccess: () => {
      toast.success("Fiche certifiée — rattachements pris en compte par les indicateurs.");
      void qc.invalidateQueries();
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clients = report ? (showAll ? report.clients : report.clients.slice(0, 25)) : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4" />
          Certification des rattachements CA → client
          {report && (
            <Badge variant="outline" className={`font-normal ${TONE[report.status]}`}>
              {INTEGRITY_LABEL[report.status]}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-xs text-muted-foreground">Lecture des ventes et du référentiel…</p>}
        {error && (
          <div className="space-y-2">
            <p className="text-xs text-destructive">{error}</p>
            <Button size="sm" variant="outline" onClick={refetch}>
              Réessayer
            </Button>
          </div>
        )}
        {report && (
          <>
            <p className="text-xs text-muted-foreground">Périmètre : {report.periode}</p>
            <p className="text-sm">{report.message}</p>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Certifié</p>
                <p className="text-sm font-medium">
                  {formatEuro(report.certifiedAmount)} · {report.certifiedLines} ligne(s)
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Certifiable en l'état</p>
                <p className="text-sm font-medium">
                  {formatEuro(report.certifiableAmount)} · {report.certifiableLines} ligne(s)
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Décision humaine requise</p>
                <p className="text-sm font-medium">
                  {formatEuro(report.blockedAmount)} · {report.blockedLines} ligne(s)
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium">Motifs constatés</p>
              <div className="flex flex-wrap gap-2">
                {report.byVerdict.map((b) => (
                  <Badge
                    key={b.verdict}
                    variant="outline"
                    className={`font-normal ${TONE[VERDICT_META[b.verdict].status]}`}
                    title={VERDICT_META[b.verdict].hint}
                  >
                    {VERDICT_META[b.verdict].label} · {b.lines} ligne(s) · {formatEuro(b.amount)}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Lignes</TableHead>
                    <TableHead className="text-right">CA HT</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead>Motif bloquant</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.clientId}>
                      <TableCell className="font-medium">{c.clientName}</TableCell>
                      <TableCell className="text-right">{c.lines}</TableCell>
                      <TableCell className="text-right">{formatEuro(c.amountHt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`font-normal ${TONE[c.status]}`}>
                          {INTEGRITY_LABEL[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[24rem] text-xs text-muted-foreground">
                        {c.blockers[0] ??
                          (c.entityStatus === "certified_client"
                            ? "Rattachements certifiés."
                            : "Rattachement démontrable — certification de la fiche à valider.")}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.certifiable && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={certify.isPending}
                            onClick={() =>
                              certify.mutate({
                                clientId: c.clientId,
                                clientName: c.clientName,
                                previousStatus: c.entityStatus,
                              })
                            }
                          >
                            <BadgeCheck className="mr-1 h-3.5 w-3.5" />
                            Certifier
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {report.clients.length > 25 && (
              <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Réduire" : `Voir les ${report.clients.length} fiches`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}