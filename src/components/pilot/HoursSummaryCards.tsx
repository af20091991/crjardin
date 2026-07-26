import { Clock, Gauge, Scale, Timer, History } from "lucide-react";
import { KpiCard } from "@/components/pilot/KpiCard";
import { formatHours } from "@/lib/pilot-hours-ledger";
import type { RealHoursResolution } from "@/lib/pilot-real-hours";

/**
 * Bloc « Répartition du temps » du cockpit : heures vendues, réalisées,
 * historiques et écart. Les heures proviennent du ledger consolidé ; aucune
 * estimation n'entre dans ces totaux et aucune saisie n'est demandée quand
 * l'information existe déjà.
 */
export function HoursSummaryCards({
  year,
  resolution,
  toFill,
}: {
  year: number;
  resolution?: RealHoursResolution;
  /** Interventions terminées dont les heures n'existent nulle part dans PP. */
  toFill: number;
}) {
  const d = resolution;
  const ecart = d ? d.ecart : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label={`Heures vendues ${year}`}
        value={d ? formatHours(d.vendues) : "—"}
        icon={Timer}
        to="/pilot/ca"
        description="Heures déclarées sur les lignes de vente du suivi CA."
      />
      <KpiCard
        label="Heures réalisées"
        value={d ? formatHours(d.realisees) : "—"}
        icon={Gauge}
        to="/pilot/rapprochement"
        description="Interventions terminées avec heures confirmées. Estimations exclues."
        sub={d && d.realisees > 0 ? "Interventions confirmées" : "Aucune heure confirmée"}
      />
      <KpiCard
        label="Heures historiques"
        value={d ? formatHours(d.historiques) : "—"}
        icon={History}
        to="/pilot/rapprochement"
        description="Import Excel validé et rattaché au référentiel client."
      />
      <KpiCard
        label="Écart vendu / réel"
        value={d && d.hours > 0 ? `${ecart >= 0 ? "+" : ""}${formatHours(ecart)}` : "—"}
        icon={Scale}
        to="/pilot/direction"
        description={d ? `Heures réelles retenues : ${d.sourceLabel} (${d.sourceDetail}).` : undefined}
        sub={d && d.hours > 0 ? d.sourceLabel : "Aucune heure réelle disponible"}
        tone={d && d.hours > 0 && ecart < 0 ? "warning" : "default"}
      />
      {toFill > 0 && (
        <KpiCard
          label="Interventions sans aucune heure connue"
          value={String(toFill)}
          icon={Clock}
          to="/pilot/focus/heures-manquantes"
          description="Aucune heure disponible dans PP pour ces interventions (ni CA, ni historique)."
          tone="warning"
        />
      )}
    </div>
  );
}
