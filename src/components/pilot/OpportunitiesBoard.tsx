// Opportunités commerciales : relances, contrats à renouveler, développement.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Handshake, RefreshCw, Sprout } from "lucide-react";
import { fetchClientActivityRows } from "@/lib/client-activity";
import { listCeevContracts } from "@/lib/ceev";
import { formatEuro } from "@/lib/pilot";
import {
  buildCommercialOpportunities,
  OPPORTUNITY_META,
  type CommercialOpportunity,
  type OpportunityCategory,
} from "@/lib/pilot-opportunities";

export type BoardOffer = {
  client_id: string;
  service_id: string;
  service_name: string;
  score_opportunity: number;
  estimated_value?: number | null;
};

const ICONS: Record<OpportunityCategory, typeof Handshake> = {
  relance: RefreshCw,
  renouvellement: Handshake,
  developpement: Sprout,
};

export function OpportunitiesBoard({
  year,
  offers,
  clientNameById,
}: {
  year: number;
  offers: BoardOffer[];
  clientNameById: Map<string, string>;
}) {
  const activityQ = useQuery({ queryKey: ["client-activity-rows"], queryFn: fetchClientActivityRows });
  const ceevQ = useQuery({ queryKey: ["ceev-contracts"], queryFn: listCeevContracts });

  const items = useMemo(
    () =>
      buildCommercialOpportunities({
        activity: activityQ.data ?? [],
        ceev: ceevQ.data ?? [],
        offers,
        clientNameById,
        year,
      }),
    [activityQ.data, ceevQ.data, offers, clientNameById, year],
  );

  if (activityQ.isLoading || ceevQ.isLoading) {
    return (
      <div className="grid gap-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    );
  }

  const categories: OpportunityCategory[] = ["relance", "renouvellement", "developpement"];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {categories.map((cat) => {
        const list = items.filter((o) => o.category === cat);
        const Icon = ICONS[cat];
        const total = list.reduce((s, o) => s + (o.amount ?? 0), 0);
        return (
          <Card key={cat} className="h-full">
            <CardContent className="space-y-2 pt-5">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <p className="flex-1 text-sm font-semibold">{OPPORTUNITY_META[cat].label}</p>
                <Badge variant="outline">{list.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{OPPORTUNITY_META[cat].question}</p>
              {list.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Rien à signaler.</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {list.map((o) => (
                      <OpportunityRow key={o.key} o={o} />
                    ))}
                  </ul>
                  {total > 0 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      Montant de référence : <span className="font-medium text-foreground">{formatEuro(total)}</span>
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function OpportunityRow({ o }: { o: CommercialOpportunity }) {
  const body = (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{o.title}</p>
        {o.amount != null && o.amount > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatEuro(o.amount)}</span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{o.why}</p>
      <p className="mt-1 text-xs text-foreground">
        <span className="font-medium">Action : </span>
        {o.action}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Source : {o.source}</p>
    </div>
  );
  if (!o.clientId) return <li>{body}</li>;
  return (
    <li>
      <Link
        to="/pilot/fiche/$clientId"
        params={{ clientId: o.clientId }}
        className="block transition-colors hover:bg-muted/40"
      >
        {body}
      </Link>
    </li>
  );
}