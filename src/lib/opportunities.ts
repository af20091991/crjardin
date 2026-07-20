import { supabase } from "@/integrations/supabase/client";

export type OpportunityReason = "jamais_realise" | "hors_frequence";

export interface Opportunity {
  service_id: string;
  service_label: string;
  category_label: string | null;
  season_months: number[];
  reason: OpportunityReason;
  last_date: string | null;
  occurrences: number;
  frequency_label: string | null;
  expected_days: number | null;
  overdue_days: number | null;
  justification: string;
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function seasonLabel(months: number[]): string {
  if (months.length === 0) return "Toute l'année";
  if (months.length === 12) return "Toute l'année";
  // Détecter séquence contiguë
  const sorted = [...months].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const contiguous = sorted.every((m, i) => m === first + i);
  if (contiguous && sorted.length >= 2) {
    return `${MONTHS_FR[first - 1]} → ${MONTHS_FR[last - 1]}`;
  }
  return sorted.map((m) => MONTHS_FR[m - 1].slice(0, 3)).join(", ");
}

/** Convertit un libellé de fréquence FR en nombre de jours attendu entre deux passages. */
function frequencyToDays(freq: string | null | undefined): number | null {
  if (!freq) return null;
  const f = freq.toLowerCase().trim();
  if (/hebdo/.test(f)) return 7;
  if (/bimensuel|quinzaine|15 j/.test(f)) return 15;
  if (/mensuel/.test(f)) return 30;
  if (/bimestriel|2 mois/.test(f)) return 60;
  if (/trimestriel|3 mois/.test(f)) return 90;
  if (/semestriel|6 mois/.test(f)) return 182;
  if (/annuel|1 an|par an/.test(f)) return 365;
  if (/biannuel|2 fois/.test(f)) return 182;
  return null;
}

export async function listClientOpportunities(clientId: string): Promise<Opportunity[]> {
  // 1. Services jamais réalisés
  const { data: gaps, error: gErr } = await supabase
    .from("v_client_service_gaps")
    .select("service_id, service_label, category_id")
    .eq("client_id", clientId);
  if (gErr) throw gErr;

  // 2. Profil de services déjà réalisés
  const { data: profile, error: pErr } = await supabase
    .from("v_client_service_profile")
    .select("service_id, service_label, category_id, last_date, occurrences")
    .eq("client_id", clientId);
  if (pErr) throw pErr;

  // Regrouper les service_ids à enrichir
  const serviceIds = Array.from(new Set([
    ...(gaps ?? []).map((r) => r.service_id).filter((v): v is string => !!v),
    ...(profile ?? []).map((r) => r.service_id).filter((v): v is string => !!v),
  ]));
  const categoryIds = Array.from(new Set([
    ...(gaps ?? []).map((r) => r.category_id).filter((v): v is string => !!v),
    ...(profile ?? []).map((r) => r.category_id).filter((v): v is string => !!v),
  ]));

  if (serviceIds.length === 0) return [];

  // 3. Récupérer default_frequency + description depuis services
  const { data: services, error: sErr } = await supabase
    .from("services")
    .select("id, default_frequency")
    .in("id", serviceIds);
  if (sErr) throw sErr;
  const freqMap = new Map<string, string | null>();
  (services ?? []).forEach((s) => freqMap.set(s.id, s.default_frequency ?? null));

  // 4. Libellés catégories
  let catMap = new Map<string, string>();
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from("service_categories")
      .select("id, label")
      .in("id", categoryIds);
    (cats ?? []).forEach((c) => catMap.set(c.id, c.label));
  }

  // 5. Saisonnalité résolue (mois où intensity >= 1)
  const { data: seasons } = await supabase
    .from("v_service_seasonality_resolved")
    .select("service_id, month, intensity")
    .in("service_id", serviceIds);
  const seasonMap = new Map<string, number[]>();
  (seasons ?? []).forEach((row) => {
    if (!row.service_id || row.month == null) return;
    if ((row.intensity ?? 0) < 1) return;
    const arr = seasonMap.get(row.service_id) ?? [];
    arr.push(row.month);
    seasonMap.set(row.service_id, arr);
  });

  const now = Date.now();
  const out: Opportunity[] = [];

  // Jamais réalisés
  for (const g of gaps ?? []) {
    if (!g.service_id || !g.service_label) continue;
    const months = seasonMap.get(g.service_id) ?? [];
    out.push({
      service_id: g.service_id,
      service_label: g.service_label,
      category_label: g.category_id ? catMap.get(g.category_id) ?? null : null,
      season_months: months,
      reason: "jamais_realise",
      last_date: null,
      occurrences: 0,
      frequency_label: freqMap.get(g.service_id) ?? null,
      expected_days: frequencyToDays(freqMap.get(g.service_id)),
      overdue_days: null,
      justification: "Jamais proposé à ce client — piste de développement.",
    });
  }

  // Hors fréquence
  for (const p of profile ?? []) {
    if (!p.service_id || !p.service_label || !p.last_date) continue;
    const expected = frequencyToDays(freqMap.get(p.service_id));
    if (!expected) continue;
    const days = Math.floor((now - new Date(p.last_date).getTime()) / 86_400_000);
    if (days <= expected) continue;
    const overdue = days - expected;
    const months = seasonMap.get(p.service_id) ?? [];
    out.push({
      service_id: p.service_id,
      service_label: p.service_label,
      category_label: p.category_id ? catMap.get(p.category_id) ?? null : null,
      season_months: months,
      reason: "hors_frequence",
      last_date: p.last_date,
      occurrences: p.occurrences ?? 0,
      frequency_label: freqMap.get(p.service_id) ?? null,
      expected_days: expected,
      overdue_days: overdue,
      justification: `Dernier passage il y a ${days} j, fréquence recommandée : ${freqMap.get(p.service_id)} (+${overdue} j de retard).`,
    });
  }

  // Tri : hors_frequence d'abord (retard décroissant), puis jamais_realise
  return out.sort((a, b) => {
    if (a.reason !== b.reason) return a.reason === "hors_frequence" ? -1 : 1;
    if (a.reason === "hors_frequence") return (b.overdue_days ?? 0) - (a.overdue_days ?? 0);
    return a.service_label.localeCompare(b.service_label);
  });
}