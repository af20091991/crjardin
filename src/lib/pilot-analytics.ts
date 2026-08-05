// Point d'entrée unique côté interface : un composant n'obtient JAMAIS ses
// indicateurs autrement que par ce hook (périmètre partagé + moteur unique).
import { usePilotScope } from "@/lib/pilot-mode";
import { useAnalyticsSnapshot, type AnalyticsSnapshot, type Kpi, type KpiKey } from "@/lib/pilot-engine";

export type { AnalyticsSnapshot, Kpi, KpiKey };

export function useAnalytics() {
  const scope = usePilotScope();
  const query = useAnalyticsSnapshot(scope);
  return { ...query, scope, snapshot: query.data ?? null };
}

/** Récupère un indicateur certifié prêt à afficher. */
export function pickKpi(snapshot: AnalyticsSnapshot | null, key: KpiKey): Kpi | null {
  return snapshot ? snapshot.kpis[key] : null;
}
