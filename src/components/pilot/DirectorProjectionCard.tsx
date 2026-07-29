// « Où vais-je si je continue ainsi ? » — lecture directionnelle de la
// projection déjà calculée par le moteur pilot-projection.
import { PilotCard } from "@/components/pilot/PilotCard";
import { Badge } from "@/components/ui/badge";
import { Compass } from "lucide-react";
import { formatEuro } from "@/lib/pilot";
import type { ProjectionResult } from "@/lib/pilot-projection";

const CONFIDENCE_LABEL: Record<ProjectionResult["confidence"], string> = {
  haute: "Fiabilité élevée",
  moyenne: "Fiabilité moyenne",
  faible: "Fiabilité faible",
};

export function DirectorProjectionCard({
  projection,
  caPrevYear,
}: {
  projection: ProjectionResult;
  caPrevYear: number;
}) {
  const delta = caPrevYear > 0 ? ((projection.caProjete - caPrevYear) / caPrevYear) * 100 : null;
  const resultTone = projection.resultatProjete >= 0 ? "positive" : "negative";

  return (
    <PilotCard
      label={`Où vais-je si je continue ainsi ? (${projection.year})`}
      icon={Compass}
      value={formatEuro(projection.caProjete)}
      sub={
        delta != null
          ? `CA projeté au 31/12 · ${delta >= 0 ? "+" : ""}${delta.toFixed(0)} % vs ${projection.year - 1}`
          : "CA projeté au 31 décembre"
      }
      tone={resultTone}
      audit={{
        sources: ["pilot_ca_entries", "charges consolidées"],
        calcul:
          projection.method === "saisonnalite"
            ? "CA à date extrapolé selon la saisonnalité des exercices complets antérieurs"
            : "CA à date extrapolé selon la moyenne mensuelle observée",
        periode: `Exercice ${projection.year}`,
        fiabilite: CONFIDENCE_LABEL[projection.confidence],
      }}
      help="Projection stricte : aucune donnée n'est écrite, le réel et le projeté ne sont jamais additionnés."
      content={
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="CA réel à date" value={formatEuro(projection.caReel)} />
            <Stat label="Charges projetées" value={formatEuro(projection.chargesProjetees)} />
            <Stat label="Résultat projeté" value={formatEuro(projection.resultatProjete)} />
            <Stat label="Mois observés" value={`${projection.monthsObserved}/12`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{CONFIDENCE_LABEL[projection.confidence]}</Badge>
            <p className="text-xs text-muted-foreground">{projection.explanation}</p>
          </div>
        </div>
      }
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}