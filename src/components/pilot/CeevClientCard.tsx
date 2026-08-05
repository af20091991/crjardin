// Bloc CEEV de la fiche client 360° : SYNTHÈSE uniquement (nombre de contrats
// en cours + prochaines échéances). La gestion complète des contrats se fait
// dans Pilotage → Contrats d'entretien (CEEV).
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Leaf, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { daysUntil, listCeevAgreementsForClient } from "@/lib/ceev-agreements";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("fr-FR") : "—";
}

export function CeevClientCard({ clientId }: { clientId: string }) {
  const q = useQuery({
    queryKey: ["fiche-ceev-agreements", clientId],
    queryFn: () => listCeevAgreementsForClient(clientId),
  });
  const rows = q.data ?? [];
  const live = rows.filter(
    (a) => a.status === "actif" || a.status === "a_renouveler" || a.status === "suspendu",
  );
  const nextVisit = live
    .map((a) => a.next_intervention_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null;
  const nextEnd = live
    .map((a) => a.end_date)
    .filter((d): d is string => Boolean(d))
    .sort()[0] ?? null;
  const endIn = daysUntil(nextEnd);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-4 w-4 text-primary" />Contrats d'entretien (CEEV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {q.isLoading ? (
          <Skeleton className="h-12" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun contrat d'entretien enregistré pour ce client.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <Badge variant="secondary">{live.length}</Badge>
              contrat{live.length > 1 ? "s" : ""} en cours
              {rows.length > live.length && (
                <span className="text-xs text-muted-foreground">
                  ({rows.length - live.length} terminé{rows.length - live.length > 1 ? "s" : ""})
                </span>
              )}
            </span>
            {nextVisit && (
              <span className="text-muted-foreground">Prochaine intervention : {fmt(nextVisit)}</span>
            )}
            {endIn != null && (
              <span className={endIn < 0 ? "text-rose-600" : endIn <= 60 ? "text-orange-600" : "text-muted-foreground"}>
                {endIn < 0 ? "Échéance dépassée" : `Échéance dans ${endIn} j`} ({fmt(nextEnd)})
              </span>
            )}
          </div>
        )}
        <Link
          to="/pilot/ceev-contrats"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Gérer les contrats dans Pilotage <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
