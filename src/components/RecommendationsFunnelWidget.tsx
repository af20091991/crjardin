import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { FUNNEL_STAGES, getRecommendationsFunnel, getRecommendationsFunnelInvoicedCa } from "@/lib/recommendations-funnel";
import { formatEuro } from "@/lib/garden";

export function RecommendationsFunnelWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["recommendations-funnel"],
    queryFn: getRecommendationsFunnel,
  });
  const invoicedCa = useQuery({
    queryKey: ["recommendations-funnel-ca"],
    queryFn: getRecommendationsFunnelInvoicedCa,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Entonnoir des recommandations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FUNNEL_STAGES.map((s) => (
              <Skeleton key={s.key} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FUNNEL_STAGES.map((s) => (
              <div
                key={s.key}
                className={`rounded-lg px-3 py-2.5 ${s.tone}`}
              >
                <p className="text-xs font-medium opacity-80">{s.label}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums">
                  {data[s.key]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">CA généré par recommandations</span>
            <span className="font-semibold text-primary tabular-nums">
              {invoicedCa.data != null ? formatEuro(invoicedCa.data) : "—"}
            </span>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}