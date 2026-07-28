import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getCoverageSummary } from "@/lib/pilot-coverage";
import { CoverageBanner } from "@/components/pilot/CoverageBanner";
import { PilotCard } from "@/components/pilot/PilotCard";
import { formatEuro } from "@/lib/pilot";
import { Skeleton } from "@/components/ui/skeleton";

/** Seuil au-delà duquel le CA de l'année est considéré consolidé. */
const CONSOLIDATED_PCT = 99;

/**
 * Affiche « CA à compléter » uniquement si le rapprochement de l'année est
 * incomplet. Dès que le CA est intégré et rapproché, le bloc devient une
 * carte PilotCard : CA consolidé (réalisé, objectif, évolution, projection).
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
    <PilotCard
      label={`CA consolidé ${year}`}
      icon={CheckCircle2}
      to="/pilot/ca"
      tone="positive"
      help={`Toutes les lignes CA ${year} sont intégrées et rapprochées (${scope?.linesLinked}/${scope?.linesTotal} lignes) — aucune saisie requise. Permet de considérer le CA de l'exercice comme fiable pour toute décision.`}
      value={formatEuro(caYear)}
      sub={
        evo == null
          ? `Objectif (${year - 1}) : ${caPrevYear > 0 ? formatEuro(caPrevYear) : "—"}`
          : `${evo >= 0 ? "+" : ""}${evo.toFixed(0)} % vs ${year - 1} · projection 31/12 : ${projection > 0 ? formatEuro(projection) : "—"}`
      }
    />
  );
}
