// Rapprochement SST — panneau de LECTURE SEULE.
// Affiche le résultat ligne par ligne du moteur `src/lib/sst-reconciliation.ts` :
// aucune valeur n'est corrigée, aucun écart n'est absorbé.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeftRight } from "lucide-react";
import { useSstReconciliation } from "@/components/pilot/useSstReconciliation";
import { INTEGRITY_LABEL, type IntegrityStatus } from "@/lib/pilot-integrity";
import { formatEuro } from "@/lib/format-utils";

const TONE: Record<IntegrityStatus, string> = {
  certifie: "border-primary/30 bg-primary/5 text-primary",
  incomplet: "border-amber-300 bg-amber-50 text-amber-800",
  suspect: "border-orange-300 bg-orange-50 text-orange-800",
  indisponible: "border-destructive/40 bg-destructive/5 text-destructive",
};

export function SstReconciliationPanel({ year }: { year?: number }) {
  const { report, isLoading, error } = useSstReconciliation(year);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <ArrowLeftRight className="h-4 w-4" />
          Rapprochement SST — missions vs charges
          {report && (
            <Badge variant="outline" className={`font-normal ${TONE[report.status]}`}>
              {INTEGRITY_LABEL[report.status]}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-xs text-muted-foreground">Chargement des deux sources…</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {report && (
          <>
            <p className="text-xs text-muted-foreground">
              Périmètre : {report.periode} — {report.missionCount} mission(s) pour{" "}
              {formatEuro(report.missionTotal)} et {report.chargeCount} charge(s) de sous-traitance
              pour {formatEuro(report.chargeTotal)}.
            </p>
            <p className="text-sm">{report.message}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Rapproché (missions / charges)</p>
                <p className="text-sm font-medium">
                  {formatEuro(report.matchedMissionTotal)} / {formatEuro(report.matchedChargeTotal)}
                </p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Missions sans charge</p>
                <p className="text-sm font-medium">{formatEuro(report.unmatchedMissionTotal)}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="text-xs text-muted-foreground">Charges sans mission (+ doublons)</p>
                <p className="text-sm font-medium">{formatEuro(report.unmatchedChargeTotal)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
