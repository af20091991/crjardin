// Bloc CEEV de la fiche client 360° : contrats actifs, prochaines échéances et
// historique (périodes terminées / archivées). Source : ceev_agreements.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CEEV_FREQUENCY_META,
  CEEV_STATUS_META,
  ceevProgress,
  daysUntil,
  listCeevAgreementsForClient,
  type CeevAgreement,
} from "@/lib/ceev-agreements";
import { listAllInterventions, type Intervention } from "@/lib/interventions";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("fr-FR") : "—";
}

function Row({ a, interventions }: { a: CeevAgreement; interventions: Intervention[] }) {
  const meta = CEEV_STATUS_META[a.status];
  const dEnd = daysUntil(a.end_date);
  const p = ceevProgress(a, interventions);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="min-w-0">
        <Link
          to="/pilot/ceev-contrats/$agreementId"
          params={{ agreementId: a.id }}
          className="font-medium text-primary hover:underline"
        >
          {a.name?.trim() || "Contrat d'entretien"}
        </Link>
        <div className="text-xs text-muted-foreground">
          {fmt(a.start_date)} → {fmt(a.end_date)} · {CEEV_FREQUENCY_META[a.frequency].label}
          {a.next_intervention_date && ` · prochaine intervention ${fmt(a.next_intervention_date)}`}
        </div>
        {p.planned > 0 && (
          <div className="text-xs text-muted-foreground">
            Passages : {p.done} réalisé(s) / {p.planned} prévu(s)
            {p.remaining > 0 && ` · ${p.remaining} à planifier`}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {dEnd != null && dEnd >= 0 && dEnd <= 60 && (
          <span className="text-xs text-orange-600">échéance dans {dEnd} j</span>
        )}
        {dEnd != null && dEnd < 0 && a.status !== "termine" && (
          <span className="text-xs text-rose-600">échéance dépassée</span>
        )}
        <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
      </div>
    </div>
  );
}

export function CeevClientCard({ clientId }: { clientId: string }) {
  const q = useQuery({
    queryKey: ["fiche-ceev-agreements", clientId],
    queryFn: () => listCeevAgreementsForClient(clientId),
  });
  const iv = useQuery({ queryKey: ["interventions-all"], queryFn: listAllInterventions });
  const interventions = iv.data ?? [];
  const rows = q.data ?? [];
  const live = rows.filter((a) => a.status === "actif" || a.status === "a_renouveler" || a.status === "suspendu");
  const history = rows.filter((a) => !live.includes(a));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-4 w-4 text-primary" />Contrats d'entretien (CEEV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <Skeleton className="h-16" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun contrat d'entretien enregistré pour ce client.{" "}
            <Link to="/pilot/ceev-contrats" className="text-primary hover:underline">
              Créer un CEEV
            </Link>
          </p>
        ) : (
          <>
            {live.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  En cours ({live.length})
                </div>
                {live.map((a) => <Row key={a.id} a={a} interventions={interventions} />)}
              </div>
            )}
            {history.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Historique ({history.length})
                </div>
                {history.map((a) => <Row key={a.id} a={a} interventions={interventions} />)}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
