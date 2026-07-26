import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { getCoverageSummary } from "@/lib/pilot-coverage";
import { CoverageBanner } from "@/components/pilot/CoverageBanner";
import { formatEuro } from "@/lib/pilot";

/** Seuil au-delà duquel le CA de l'année est considéré consolidé. */
const CONSOLIDATED_PCT = 99;

/**
 * Affiche « CA à compléter » uniquement si le rapprochement de l'année est
 * incomplet. Dès que le CA est intégré et rapproché, le bloc devient un
 * indicateur utile : CA consolidé (réalisé, objectif, évolution, projection).
 */
export function CaStatusCard({
  year,
  caYear,
  caPrevYear,
  projection,
}: {
  year: number;
  caYear: number;
  caPrevYear: number;
  projection: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["pilot-coverage"],
    queryFn: getCoverageSummary,
    staleTime: 60_000,
  });

  if (isLoading || !data) return <Skeleton className="h-24 rounded-xl" />;

  const scope = data.years.find((y) => y.year === year);
  const pct = scope?.coverageAmountPct ?? 0;
  if (pct < CONSOLIDATED_PCT) return <CoverageBanner year={year} />;

  const evo = caPrevYear > 0 ? ((caYear - caPrevYear) / caPrevYear) * 100 : null;

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium">CA consolidé {year}</span>
            <Badge variant="outline" className="text-[10px] font-normal">
              {scope?.linesLinked}/{scope?.linesTotal} lignes rattachées
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toutes les lignes CA {year} sont intégrées et rapprochées — aucune saisie requise.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <Metric label="CA réalisé" value={formatEuro(caYear)} />
          <Metric label={`Objectif (${year - 1})`} value={caPrevYear > 0 ? formatEuro(caPrevYear) : "—"} />
          <Metric
            label="Évolution"
            value={evo == null ? "—" : `${evo >= 0 ? "+" : ""}${evo.toFixed(0)} %`}
            tone={evo == null ? undefined : evo >= 0 ? "text-emerald-700" : "text-orange-700"}
          />
          <Metric label="Projection 31/12" value={projection > 0 ? formatEuro(projection) : "—"} icon />
          <Link
            to="/pilot/ca"
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent/40"
          >
            Voir le CA <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${tone ?? ""}`}>
        {icon && <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}