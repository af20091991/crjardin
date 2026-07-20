import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, CalendarClock, Sprout, TrendingUp } from "lucide-react";
import { listClientOpportunities, seasonLabel } from "@/lib/opportunities";

export function ClientOpportunitiesWidget({ clientId }: { clientId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-opportunities", clientId],
    queryFn: () => listClientOpportunities(clientId),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }
  const items = data ?? [];
  if (items.length === 0) {
    return (
      <Card className="mt-3 border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <Sparkles className="h-7 w-7 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Aucune opportunité détectée : tout le catalogue applicable est à jour.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overdue = items.filter((o) => o.reason === "hors_frequence").length;
  const newOnes = items.length - overdue;

  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {overdue > 0 && (
          <Badge className="gap-1 bg-amber-100 text-amber-800">
            <CalendarClock className="h-3 w-3" /> {overdue} hors fréquence
          </Badge>
        )}
        {newOnes > 0 && (
          <Badge className="gap-1 bg-emerald-100 text-emerald-800">
            <Sprout className="h-3 w-3" /> {newOnes} jamais proposé{newOnes > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {items.map((o) => (
        <Card key={`${o.reason}-${o.service_id}`} className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{o.service_label}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {o.category_label && <Badge variant="secondary">{o.category_label}</Badge>}
                <Badge variant="outline" className="gap-1">
                  <Sprout className="h-3 w-3" /> {seasonLabel(o.season_months)}
                </Badge>
                {o.frequency_label && (
                  <Badge variant="outline" className="gap-1">
                    <CalendarClock className="h-3 w-3" /> {o.frequency_label}
                  </Badge>
                )}
              </div>
            </div>
            <Badge
              className={
                o.reason === "hors_frequence"
                  ? "shrink-0 gap-1 bg-amber-100 text-amber-800"
                  : "shrink-0 gap-1 bg-emerald-100 text-emerald-800"
              }
            >
              {o.reason === "hors_frequence" ? (
                <><CalendarClock className="h-3 w-3" /> Hors fréquence</>
              ) : (
                <><TrendingUp className="h-3 w-3" /> Jamais réalisé</>
              )}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{o.justification}</p>
        </Card>
      ))}
    </div>
  );
}