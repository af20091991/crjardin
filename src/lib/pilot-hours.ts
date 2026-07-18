import { supabase } from "@/integrations/supabase/client";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export interface HoursRow {
  id: string;
  user_id: string;
  year: number;
  month: number;
  temps_terrain: number | null;
  jours_travailles: number | null;
  created_at: string;
  updated_at: string;
}

export interface TjmSettings {
  id: string;
  user_id: string;
  heures_gestion: number;
  objectif_remuneration: number;
  revenus_bruts: number;
  charges_fixes: number;
  charges_variables: number;
  conges: number;
  jours_off: number;
  weekend: number;
  feries: number;
  meteo: number;
  bureau: number;
  heures_jour: number;
}

export type TjmSettingsInput = Partial<Omit<TjmSettings, "id" | "user_id">>;

export async function listHours(year: number): Promise<HoursRow[]> {
  const { data, error } = await supabase
    .from("pilot_hours")
    .select("*")
    .eq("year", year)
    .order("month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HoursRow[];
}

export async function upsertHours(
  year: number,
  month: number,
  input: { temps_terrain?: number | null; jours_travailles?: number | null },
): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_hours")
    .upsert({ user_id, year, month, ...input } as never, { onConflict: "user_id,year,month" });
  if (error) throw error;
}

export async function getTjmSettings(): Promise<TjmSettings | null> {
  const { data, error } = await supabase.from("pilot_tjm_settings").select("*").maybeSingle();
  if (error) throw error;
  return (data as unknown as TjmSettings) ?? null;
}

export async function saveTjmSettings(input: TjmSettingsInput): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_tjm_settings")
    .upsert({ user_id, ...input } as never, { onConflict: "user_id" });
  if (error) throw error;
}

/** CA HT mensuel réel agrégé depuis les ventes saisies (pilot_ca_entries). */
export async function monthlyCa(year: number): Promise<number[]> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("month, amount_ht, kind")
    .eq("year", year)
    .eq("kind", "vente");
  if (error) throw error;
  const totals = Array(12).fill(0) as number[];
  for (const r of (data ?? []) as unknown as { month: number; amount_ht: number }[]) {
    if (r.month >= 1 && r.month <= 12) totals[r.month - 1] += Number(r.amount_ht) || 0;
  }
  return totals;
}

// ---------- Calculs ----------
export type MonthMetric = {
  month: number;
  temps_terrain: number | null;
  jours_travailles: number | null;
  ca: number;
  brut: number | null; // taux horaire terrain
  net: number | null; // terrain + gestion
  caJour: number | null;
};

export function computeMonths(
  ca: number[],
  hours: HoursRow[],
  gestion: number,
): MonthMetric[] {
  const byMonth = new Map(hours.map((h) => [h.month, h]));
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const h = byMonth.get(m);
    const terrain = h?.temps_terrain ?? null;
    const jours = h?.jours_travailles ?? null;
    const caM = ca[i] ?? 0;
    const brut = terrain && terrain > 0 ? caM / terrain : null;
    const net = terrain && terrain + gestion > 0 ? caM / (terrain + gestion) : null;
    const caJour = jours && jours > 0 ? caM / jours : null;
    return { month: m, temps_terrain: terrain, jours_travailles: jours, ca: caM, brut, net, caJour };
  });
}

export type TjmResult = {
  joursFacturables: number;
  totalOff: number;
  tauxJournalier: number;
  tauxHoraire: number;
  pointMort: number;
  tjmObjectif: number;
};

export function computeTjm(s: TjmSettings): TjmResult {
  const totalOff = s.conges + s.jours_off + s.weekend + s.feries + s.meteo + s.bureau;
  const joursFacturables = Math.max(365 - totalOff, 0);
  const pointMort = s.revenus_bruts + (s.charges_fixes + s.charges_variables) * 12;
  const tauxJournalier = joursFacturables > 0 ? s.revenus_bruts / joursFacturables : 0;
  const tauxHoraire = s.heures_jour > 0 ? tauxJournalier / s.heures_jour : 0;
  const tjmObjectif = joursFacturables > 0 ? (pointMort + s.objectif_remuneration * 12) / joursFacturables : 0;
  return { joursFacturables, totalOff, tauxJournalier, tauxHoraire, pointMort, tjmObjectif };
}
