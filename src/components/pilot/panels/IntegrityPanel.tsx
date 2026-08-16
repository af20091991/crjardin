// Contrôle d'intégrité des données — panneau de LECTURE SEULE.
// Aucune valeur métier n'est recalculée ni corrigée ici : le panneau affiche le
// résultat des contrôles centraux (existence, structure, complétude, cohérence
// temporelle, doublons, rattachement, arithmétique).
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, BadgeCheck, HelpCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { usePilotIntegrity } from "@/components/pilot/usePilotIntegrity";
import { INTEGRITY_LABEL, type IntegrityStatus } from "@/lib/pilot-integrity";
import { DIFF_KIND_LABEL } from "@/lib/pilot-reconciliation";

const TONE: Record<IntegrityStatus, string> = {
  certifie: "border-primary/30 bg-primary/5 text-primary",
  incomplet: "border-amber-300 bg-amber-50 text-amber-800",
  suspect: "border-orange-300 bg-orange-50 text-orange-800",
  indisponible: "border-destructive/40 bg-destructive/5 text-destructive",
};

function StatusIcon({ status }: { status: IntegrityStatus }) {
  if (status === "certifie") return <BadgeCheck className="h-3 w-3" aria-hidden />;
  if (status === "indisponible") return <AlertTriangle className="h-3 w-3" aria-hidden />;
  if (status === "suspect") return <ShieldAlert className="h-3 w-3" aria-hidden />;
  return <HelpCircle className="h-3 w-3" aria-hidden />;
}

function StatusBadge({ status }: { status: IntegrityStatus }) {
  return (
    <Badge variant="outline" className={`font-normal ${TONE[status]}`}>
      <StatusIcon status={status} />
      <span className="ml-1">{INTEGRITY_LABEL[status]}</span>
    </Badge>
  );
}

export function IntegrityPanel() {
  const { report, reconciliation } = usePilotIntegrity();

  return (
    <div className="space-y-4">
      <Card className={report.blocking ? TONE[report.status] : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Intégrité des données avant affichage
            <StatusBadge status={report.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-sm">{report.message}</p>
          <p className="text-xs opacity-80">Périmètre contrôlé : {report.periode}</p>
          {report.blocking && (
            <p className="text-xs font-medium">
              Aucun indicateur ne peut être présenté comme certifié tant qu'une source reste non
              certifiée.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {report.datasets.map((d) => (
          <Card key={d.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                {d.label}
                <StatusBadge status={d.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Sources : {d.sources.join(" · ")}</p>
              <ul className="space-y-1.5">
                {d.checks.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-start gap-2 text-xs">
                    <StatusBadge status={c.status} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{c.label}</span> — {c.message}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            Réconciliation des calculs
            <StatusBadge status={reconciliation.status} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{reconciliation.message}</p>
          <ul className="space-y-1.5">
            {reconciliation.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-2 text-xs">
                <StatusBadge status={r.status} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{r.label}</span> — {r.message}
                </span>
                <Badge variant="outline" className="font-normal">
                  {DIFF_KIND_LABEL[r.kind]}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}