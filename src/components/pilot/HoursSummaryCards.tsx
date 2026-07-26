import { useQuery } from "@tanstack/react-query";
import { Clock, Gauge, Timer } from "lucide-react";
import { KpiCard } from "@/components/pilot/KpiCard";
import {
  countInterventionsToConfirm,
  fetchHoursLedger,
  formatHours,
} from "@/lib/pilot-hours-ledger";

/**
 * Bloc « Heures » du cockpit : vendues / réalisées sur la période, et heures
 * restant à confirmer. Aucune estimation n'entre dans ces totaux.
 */
export function HoursSummaryCards({ year, month }: { year: number; month?: number }) {
  const q = useQuery({
    queryKey: ["pilot-hours-summary", year, month ?? null],
    queryFn: async () => {
      const [entries, toConfirm] = await Promise.all([
        fetchHoursLedger(year),
        countInterventionsToConfirm(year),
      ]);
      const inPeriod = month == null ? entries : entries.filter((e) => e.month == null || e.month === month);
      const vendues = inPeriod.filter((e) => e.type === "vendue").reduce((s, e) => s + e.hours, 0);
      const realisees = inPeriod
        .filter((e) => e.type === "realisee" && !e.estimated)
        .reduce((s, e) => s + e.hours, 0);
      const venduesAn = entries.filter((e) => e.type === "vendue").reduce((s, e) => s + e.hours, 0);
      return { vendues, realisees, venduesAn, toConfirm };
    },
  });

  const d = q.data;
  const ecart = d ? d.vendues - d.realisees : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <KpiCard
        label="Heures vendues (période)"
        value={d ? formatHours(d.vendues) : "—"}
        icon={Timer}
        to="/pilot/ca"
        description="Heures déclarées sur les lignes de vente du suivi CA."
        sub={d ? `${formatHours(d.venduesAn)} sur ${year}` : undefined}
      />
      <KpiCard
        label="Heures réalisées (période)"
        value={d ? formatHours(d.realisees) : "—"}
        icon={Gauge}
        to="/pilot/rapprochement"
        description="Interventions terminées avec heures confirmées. Estimations exclues."
        sub={d && d.realisees > 0 ? `Écart ${ecart >= 0 ? "+" : ""}${formatHours(ecart)} vs vendues` : "Aucune heure confirmée"}
        tone={d && d.realisees > 0 && ecart < 0 ? "warning" : "default"}
      />
      <KpiCard
        label="Heures à confirmer"
        value={d ? String(d.toConfirm) : "—"}
        icon={Clock}
        to="/pilot/focus/heures-manquantes"
        description="Interventions terminées sans heures réelles confirmées (ou estimées)."
        tone={d && d.toConfirm > 0 ? "warning" : "positive"}
      />
    </div>
  );
}
