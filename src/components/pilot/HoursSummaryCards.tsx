import { Clock, Gauge, Scale, Timer, History } from "lucide-react";
import { PilotCard } from "@/components/pilot/PilotCard";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { formatHours } from "@/lib/pilot-hours-ledger";
import { PP_COLORS } from "@/lib/pilot-colors";
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
  const pie = d
    ? [
        { key: "vendues", label: "Heures vendues", value: Math.max(0, d.vendues), color: PP_COLORS.sales },
        { key: "realisees", label: "Heures réalisées", value: Math.max(0, d.hours), color: PP_COLORS.mid },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
        <PilotCard
          label={`Heures vendues ${year}`}
          value={d ? formatHours(d.vendues) : "—"}
          icon={Timer}
          to="/pilot/ca"
          help="Somme des heures déclarées sur les lignes de vente du suivi CA. Permet de vérifier la cohérence entre ce qui est vendu et ce qui est réalisé."
        />
        <PilotCard
          label="Heures réalisées"
          value={d ? formatHours(d.hours) : "—"}
          icon={Gauge}
          to="/pilot/rapprochement"
          help="Consolidation par client : interventions confirmées, sinon historique Excel, sinon heures CA identifiées. Aucun double comptage, aucune estimation. Sert à trancher un éventuel écart de facturation."
          sub={d && d.hours > 0 ? d.sourceLabel : "Aucune heure exploitable"}
        />
        <PilotCard
          label="Heures historiques"
          value={d ? formatHours(d.historiques) : "—"}
          icon={History}
          to="/pilot/rapprochement"
          help="Import Excel validé et rattaché au référentiel client. Permet de compléter les périodes sans intervention PP."
        />
        <PilotCard
          label="Écart vendu / réel"
          value={d && d.hours > 0 ? `${ecart >= 0 ? "+" : ""}${formatHours(ecart)}` : "—"}
          icon={Scale}
          to="/pilot/direction"
          help={d ? `Heures réelles retenues : ${d.sourceLabel} (${d.sourceDetail}). Un écart négatif signale un temps réel supérieur au vendu : décision de revoir le devis ou le taux horaire.` : "Nécessite des heures réelles confirmées."}
          sub={d && d.hours > 0 ? d.sourceLabel : "Aucune heure réelle disponible"}
          tone={d && d.hours > 0 && ecart < 0 ? "warning" : "default"}
        />
        {toFill > 0 && (
          <PilotCard
            label="Interventions sans aucune heure connue"
            value={String(toFill)}
            icon={Clock}
            to="/pilot/focus/heures-manquantes"
            help="Aucune heure disponible dans PP pour ces interventions (ni CA, ni historique). Décision : saisir les heures pour fiabiliser la rentabilité."
            tone="warning"
          />
        )}
      </div>

      <PilotCard
        label="Vendu vs réalisé"
        help="Comparaison des heures vendues (CA) et des heures réalisées (ledger consolidé) sur l'année. Un déséquilibre visuel indique où prioriser la vérification des heures."
        content={
          pie.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune heure exploitable</p>
          ) : (
            <>
              <ChartContainer config={{}} className="mx-auto h-[170px]">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={2}>
                    {pie.map((s) => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <ul className="space-y-1 text-xs">
                {pie.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-muted-foreground">{s.label}</span>
                    <span className="font-medium tabular-nums">{formatHours(s.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )
        }
      />
    </div>
  );
}
