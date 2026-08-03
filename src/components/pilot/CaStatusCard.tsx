import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getCoverageSummary } from "@/lib/pilot-coverage";
import { CoverageBanner } from "@/components/pilot/CoverageBanner";
import { PilotCard } from "@/components/pilot/PilotCard";
import { formatEuro } from "@/lib/pilot";
import type { Comparison } from "@/lib/pilot-compare";
import { Skeleton } from "@/components/ui/skeleton";

/** Seuil au-delà duquel le CA de l'année est considéré consolidé. */
const CONSOLIDATED_PCT = 99;

/**
 * Affiche « CA à compléter » uniquement si le rapprochement de l'année est
 * incomplet. Dès que le CA est intégré et rapproché, le bloc devient une
 * carte PilotCard : CA consolidé comparé à la MÊME DATE de l'exercice
 * précédent (V2.2 — la comparaison à la fin de l'exercice précédent est
 * supprimée : elle opposait un exercice incomplet à un exercice complet).
 */
export function CaStatusCard({
  year,
  caYear,
  comparison,
}: {
  year: number;
  caYear: number;
  /** Cumul au jour J vs même date N-1 (moteur pilot-compare). */
  comparison: Comparison;
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

  return (
    <PilotCard
      label={`CA consolidé ${year}`}
      icon={CheckCircle2}
      to="/pilot/ca"
      tone="positive"
      help={`Toutes les lignes CA ${year} sont intégrées et rapprochées (${scope?.linesLinked}/${scope?.linesTotal} lignes) — aucune saisie requise. Comparaison à périmètre égal : ${comparison.label}. ${comparison.comment}`}
      value={formatEuro(caYear)}
      sub={
        comparison.deltaPct == null
          ? `Aucune référence à la même date en ${year - 1}`
          : `${comparison.deltaPct >= 0 ? "+" : ""}${comparison.deltaPct.toFixed(0)} % (${comparison.deltaEuro >= 0 ? "+" : ""}${formatEuro(comparison.deltaEuro)}) ${comparison.label}`
      }
    />
  );
}
