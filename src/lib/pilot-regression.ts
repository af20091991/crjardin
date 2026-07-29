// Contrôle anti-régression : photographie des grands indicateurs et
// comparaison avec la photo précédente. Rien n'est corrigé automatiquement,
// seules les variations inattendues sont signalées.

import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };

export const METRIC_LABELS: Record<string, string> = {
  ca: "Chiffre d'affaires HT",
  charges: "Charges d'exploitation",
  resultat: "Bénéfice brut",
  margePct: "Marge (%)",
  heures: "Heures vendues",
  tauxHoraire: "Taux horaire vendu",
  clients: "Nombre de clients",
};

export type MetricSet = Record<string, number>;

export interface Snapshot {
  id: string;
  year: number;
  app_version: string | null;
  metrics: MetricSet;
  note: string | null;
  created_at: string;
}

export interface MetricDelta {
  key: string;
  label: string;
  before: number | null;
  after: number;
  deltaPct: number | null;
  /** Variation jugée inattendue (> 5 % sans action déclarée). */
  alert: boolean;
}

export async function listSnapshots(year: number, limit = 20): Promise<Snapshot[]> {
  const { data, error } = await db
    .from("pilot_metric_snapshots")
    .select("*")
    .eq("year", year)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: Snapshot) => ({ ...r, metrics: (r.metrics ?? {}) as MetricSet }));
}

export async function saveSnapshot(params: {
  year: number;
  metrics: MetricSet;
  appVersion?: string | null;
  note?: string | null;
}): Promise<void> {
  const { error } = await db.from("pilot_metric_snapshots").insert({
    year: params.year,
    metrics: params.metrics,
    app_version: params.appVersion ?? null,
    note: params.note?.trim() || null,
  });
  if (error) throw error;
}

export function compareMetrics(current: MetricSet, previous: MetricSet | null, threshold = 5): MetricDelta[] {
  return Object.keys(METRIC_LABELS).map((key) => {
    const after = Number(current[key] ?? 0);
    const before = previous ? Number(previous[key] ?? 0) : null;
    const deltaPct =
      before === null || before === 0 ? (before === 0 && after !== 0 ? 100 : null) : ((after - before) / Math.abs(before)) * 100;
    return {
      key,
      label: METRIC_LABELS[key],
      before,
      after,
      deltaPct,
      alert: deltaPct !== null && Math.abs(deltaPct) > threshold,
    };
  });
}