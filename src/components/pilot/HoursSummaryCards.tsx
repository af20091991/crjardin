import { Clock, Gauge, Scale, Timer, History } from "lucide-react";
import { KpiCard } from "@/components/pilot/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
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
  const pie = d
    ? [
        { key: "vendues", label: "Heures vendues", value: Math.max(0, d.vendues), color: "#4F8E33" },
        { key: "realisees", label: "Heures réalisées", value: Math.max(0, d.hours), color: "#EE8627" },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
      <KpiCard
        label={`Heures vendues ${year}`}
        value={d ? formatHours(d.vendues) : "—"}
        icon={Timer}
        to="/pilot/ca"
        description="Heures déclarées sur les lignes de vente du suivi CA."
      />
      <KpiCard
        label="Heures réalisées"
        value={d ? formatHours(d.hours) : "—"}
        icon={Gauge}
        to="/pilot/rapprochement"
        description="Consolidation par client : interventions confirmées, sinon historique Excel, sinon heures CA identifiées. Aucun double comptage, aucune estimation."
        sub={d && d.hours > 0 ? d.sourceLabel : "Aucune heure exploitable"}
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

      <Card>
        <CardContent className="pt-5">
          <h4 className="text-sm font-medium">Vendu vs réalisé</h4>
          {pie.length === 0 ? (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
