import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, CalendarClock, Sprout, Gauge, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  listNextBestOffers,
  createRecommendationFromOffer,
  formatSeason,
  reasonLabel,
  explainOffer,
  type NextBestOffer,
} from "@/lib/next-best-offers";

function scoreTone(score: number): string {
  if (score >= 70) return "bg-emerald-100 text-emerald-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function ClientOpportunitiesWidget({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["client-next-best-offers", clientId],
    queryFn: () => listNextBestOffers(clientId),
  });

  const create = useMutation({
    mutationFn: (o: NextBestOffer) => createRecommendationFromOffer(o),
    onSuccess: () => {
      toast.success("Recommandation créée");
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      qc.invalidateQueries({ queryKey: ["recommendations-funnel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }
  const items = data ?? [];

  return (
    <div className="mt-3 space-y-3">
      <div>
        <h3 className="text-base font-semibold">Opportunités recommandées</h3>
        <p className="text-xs text-muted-foreground">
          Classement par score /100 basé sur historique, fréquence, saison et marge.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Sparkles className="h-7 w-7 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              Aucune opportunité détectée pour l'instant.
            </p>
          </CardContent>
        </Card>
      ) : (
        items.map((o) => (
          <Card key={`${o.reason}-${o.service_id}`} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{o.service_name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {o.category_name && <Badge variant="secondary">{o.category_name}</Badge>}
                  <Badge variant="outline" className="gap-1">
                    <Sprout className="h-3 w-3" /> {formatSeason(o.recommended_season)}
                  </Badge>
                  {o.default_frequency && (
                    <Badge variant="outline" className="gap-1">
                      <CalendarClock className="h-3 w-3" /> {o.default_frequency}
                    </Badge>
                  )}
                  <Badge variant="outline">{reasonLabel(o.reason)}</Badge>
                </div>
              </div>
              <Badge className={`shrink-0 gap-1 ${scoreTone(o.score_opportunity)}`}>
                <Gauge className="h-3 w-3" />
                {o.score_opportunity}/100
              </Badge>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">{explainOffer(o)}</p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Dernière réalisation :{" "}
                {o.last_performed_at
                  ? new Date(o.last_performed_at).toLocaleDateString("fr-FR")
                  : "jamais"}
              </span>
              {o.estimated_value != null && (
                <span>Valeur cat. : {Math.round(o.estimated_value)} €</span>
              )}
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                onClick={() => create.mutate(o)}
                disabled={create.isPending}
                className="gap-1"
              >
                {create.isSuccess && create.variables?.service_id === o.service_id ? (
                  <><Check className="h-3.5 w-3.5" /> Créée</>
                ) : (
                  <><Plus className="h-3.5 w-3.5" /> Créer une recommandation client</>
                )}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}