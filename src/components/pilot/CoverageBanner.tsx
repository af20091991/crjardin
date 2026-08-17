import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, ArrowRight } from "lucide-react";
import { getCoverageSummary } from "@/lib/pilot-coverage";
import { formatEuro } from "@/lib/pilot";
import {
  HISTORY_OUT_OF_SCOPE_MESSAGE,
  coverageScopeNote,
  isOutOfCertificationScope,
} from "@/lib/pilot-history-scope";

/**
 * Indicateur transverse "Couverture des données" : quelle part du CA est
 * rattachée à un client. MVP : les données non rattachées restent visibles
 * dans toutes les vues ; ce bandeau affiche seulement le taux de complétude
 * et guide vers l'écran de rapprochement.
 */
export function CoverageBanner({
  year,
  compact = false,
}: {
  /** Si fourni : couverture pour cette année. Sinon : couverture globale. */
  year?: number;
  compact?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["pilot-coverage"],
    queryFn: getCoverageSummary,
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return <Skeleton className={compact ? "h-14 rounded-lg" : "h-24 rounded-xl"} />;
  }

  const scope =
    year != null ? data.years.find((y) => y.year === year) : null;

  // Exercice antérieur à 2026 : aucune donnée n'existera jamais. On l'annonce
  // explicitement au lieu d'afficher une couverture dégradée.
  if (isOutOfCertificationScope(year)) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-3">
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Exercice {year} — non requis</p>
            <p className="text-xs text-muted-foreground">{HISTORY_OUT_OF_SCOPE_MESSAGE}</p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] font-normal">
            Hors périmètre
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Vue « toutes années » : la couverture lue est celle du périmètre
  // certifiable (≥ 2026). L'historique non requis est indiqué à part.
  const pct = scope ? scope.coverageAmountPct : data.certifiableAmountPct;
  const linked = scope ? scope.ventesLinkedHt : data.certifiableVentesLinkedHt;
  const total = scope ? scope.ventesHt : data.certifiableVentesHt;
  const missing = Math.max(0, total - linked);
  const linesLinked = scope ? scope.linesLinked : data.certifiableLinesLinked;
  const linesTotal = scope ? scope.linesTotal : data.certifiableLines;

  const tone =
    pct >= 80
      ? "text-emerald-600"
      : pct >= 40
        ? "text-amber-600"
        : "text-rose-600";

  return (
    <Card className="border-dashed">
      <CardContent className={compact ? "flex items-center gap-4 py-3" : "space-y-3 pt-5"}>
        <div className={compact ? "flex flex-1 items-center gap-3" : "flex items-center gap-2"}>
          <Database className="h-4 w-4 shrink-0 text-primary/70" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">
                Couverture des données{year != null ? ` ${year}` : " (toutes années)"}
              </span>
              <span className={`text-sm font-semibold tabular-nums ${tone}`}>
                {pct.toFixed(0)} %
              </span>
              <Badge variant="outline" className="text-[10px] font-normal">
                {linesLinked}/{linesTotal} lignes
              </Badge>
            </div>
            {!compact && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                CA rattaché : {formatEuro(linked)} · À compléter : {formatEuro(missing)}
              </p>
            )}
            {!compact && year == null && data.scope !== "certifiable" && (
              <p className="mt-0.5 text-xs text-muted-foreground">{coverageScopeNote(data.scope)}</p>
            )}
          </div>
        </div>
        {!compact && (
          <Progress value={pct} className="h-1.5" />
        )}
        <div className={compact ? "" : "flex items-center justify-between text-xs text-muted-foreground"}>
          {!compact && (
            <span>
              Les données non attribuées restent visibles partout — les rattachements
              se font par lots.
            </span>
          )}
          <Link
            to="/pilot/rapprochement"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            À compléter <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Petit résumé annuel : liste des années avec CA total + taux de couverture.
 * Toutes les années historiques restent visibles, même sans rattachement.
 */
export function CoverageHistoryCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["pilot-coverage"],
    queryFn: getCoverageSummary,
    staleTime: 60_000,
  });

  if (isLoading || !data) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary/70" />
          <h3 className="font-medium">CA historique par année</h3>
          <Badge variant="secondary" className="ml-auto text-[10px] font-normal">
            {formatEuro(data.totalVentesHt)}
          </Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Année</th>
                <th className="px-3 py-2 text-right">CA HT</th>
                <th className="px-3 py-2 text-right">Charges HT</th>
                <th className="px-3 py-2 text-right">Couverture</th>
              </tr>
            </thead>
            <tbody>
              {data.years.map((y) => {
                const tone =
                  y.coverageAmountPct >= 80
                    ? "text-emerald-600"
                    : y.coverageAmountPct >= 40
                      ? "text-amber-600"
                      : "text-rose-600";
                return (
                  <tr key={y.year} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{y.year}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatEuro(y.ventesHt)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {y.chargesHt > 0 ? formatEuro(y.chargesHt) : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-medium tabular-nums ${tone}`}>
                      {y.coverageAmountPct.toFixed(0)} %
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Les CA historiques non rattachés restent comptabilisés. Le rattachement
          client se fait progressivement dans « Rapprochement ».
        </p>
      </CardContent>
    </Card>
  );
}