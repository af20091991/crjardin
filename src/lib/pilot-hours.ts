import { supabase } from "@/integrations/supabase/client";
import { fetchAllCaRows } from "@/lib/pilot-ca-fetch";
import { keepRealizedYearMonth, type AsOfOptions } from "@/lib/pilot-realized";
import { hoursCounted, revenueCounted } from "@/lib/pilot-sale-accounting";

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
  /** Heures administratives / bureau / préparation / gestion d'entreprise. */
  temps_gestion: number | null;
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
  input: {
    temps_terrain?: number | null;
    temps_gestion?: number | null;
    jours_travailles?: number | null;
  },
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
export async function monthlyCa(year: number, options?: AsOfOptions): Promise<number[]> {
  // Lecture paginée : toutes les lignes de l'exercice, au-delà de 1 000.
  const data = await fetchAllCaRows<{
    month: number;
    amount_ht: number;
    sale_status?: string | null;
  }>("month, amount_ht, kind, sale_status", { kind: "vente", year });
  const totals = Array(12).fill(0) as number[];
  for (const r of data) {
    // Pas de date précise en base : borne au couple année/mois.
    if (!keepRealizedYearMonth({ year, month: r.month }, options)) continue;
    // CA comptabilisé à partir de 🟢 Réglé — sauf en « Exercice complet »,
    // où toutes les lignes saisies comptent (règle unique, cf. revenueCounted).
    if (!revenueCounted(r.sale_status, options)) continue;
    if (r.month >= 1 && r.month <= 12) totals[r.month - 1] += Number(r.amount_ht) || 0;
  }
  return totals;
}

/**
 * Heures terrain mensuelles récupérées automatiquement depuis les lignes de
 * vente du suivi CA. Jamais saisies manuellement : l'information existe déjà.
 */
export async function monthlyFieldHours(year: number, options?: AsOfOptions): Promise<number[]> {
  // Lecture paginée : toutes les lignes de vente de l'exercice.
  const data = await fetchAllCaRows<{
    month: number;
    hours: number | null;
    sale_status?: string | null;
  }>("month, hours, sale_status", { kind: "vente", year });
  const totals = Array(12).fill(0) as number[];
  for (const r of data) {
    if (!keepRealizedYearMonth({ year, month: r.month }, options)) continue;
    // Temps comptabilisé dès 🟠 Facturé.
    if (!hoursCounted(r.sale_status)) continue;
    if (r.month >= 1 && r.month <= 12) totals[r.month - 1] += Number(r.hours) || 0;
  }
  return totals;
}

// ---------- Calculs ----------
export type MonthMetric = {
  month: number;
  temps_terrain: number | null;
  /** Origine du temps terrain retenu. */
  terrainSource: "ca" | "saisie" | "aucune";
  temps_gestion: number | null;
  jours_travailles: number | null;
  ca: number;
  brut: number | null; // taux horaire terrain
  net: number | null; // terrain + gestion
  caJour: number | null;
  /** Part du temps consacrée au terrain (0-1). */
  partTerrain: number | null;
};

/**
 * Le temps terrain provient EXCLUSIVEMENT de Vente → Temps (`caHours`).
 * `pilot_hours.temps_terrain` est conservé en base mais n'alimente plus le calcul.
 * Le temps de gestion provient EXCLUSIVEMENT de Suivi mensuel → Temps gestion,
 * sans aucune valeur de repli (absence de saisie = 0 h).
 */
export function computeMonths(
  ca: number[],
  hours: HoursRow[],
  /** Heures terrain issues de Vente → Temps (source unique). */
  caHours: number[] = [],
): MonthMetric[] {
  const byMonth = new Map(hours.map((h) => [h.month, h]));
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const h = byMonth.get(m);
    const fromCa = Number(caHours[i]) || 0;
    const terrain = fromCa > 0 ? fromCa : null;
    const terrainSource: MonthMetric["terrainSource"] = fromCa > 0 ? "ca" : "aucune";
    const gestionSaisie = h?.temps_gestion == null ? null : Number(h.temps_gestion);
    // Aucun repli : sans saisie du Suivi mensuel, le temps de gestion vaut 0 h.
    const gestion = gestionSaisie ?? 0;
    const jours = h?.jours_travailles ?? null;
    const caM = ca[i] ?? 0;
    const brut = terrain && terrain > 0 ? caM / terrain : null;
    const net = terrain && terrain + gestion > 0 ? caM / (terrain + gestion) : null;
    const caJour = jours && jours > 0 ? caM / jours : null;
    const partTerrain = terrain && terrain + gestion > 0 ? terrain / (terrain + gestion) : null;
    return {
      month: m,
      temps_terrain: terrain,
      terrainSource,
      temps_gestion: gestionSaisie,
      jours_travailles: jours,
      ca: caM,
      brut,
      net,
      caJour,
      partTerrain,
    };
  });
}

/**
 * Mois écoulés de l'année pour lesquels le temps de gestion n'a jamais été
 * renseigné. Sert à demander la saisie — uniquement quand l'info manque.
 */
export function monthsMissingGestion(
  months: MonthMetric[],
  year: number,
  today = new Date(),
): number[] {
  const lastClosed = year < today.getFullYear() ? 12 : today.getMonth(); // mois écoulés
  return months
    .filter(
      (m) =>
        m.month <= lastClosed &&
        m.temps_gestion == null &&
        (m.ca > 0 || (m.temps_terrain ?? 0) > 0),
    )
    .map((m) => m.month);
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
  const tjmObjectif =
    joursFacturables > 0 ? (pointMort + s.objectif_remuneration * 12) / joursFacturables : 0;
  return { joursFacturables, totalOff, tauxJournalier, tauxHoraire, pointMort, tjmObjectif };
}

// ---------------------------------------------------------------------------
// Agrégations annuelles du référentiel temps — UNIQUE implémentation.
// Aucun écran ne recalcule ces totaux : ils sont consommés via le moteur
// analytique central (pilot-engine).
// ---------------------------------------------------------------------------

export interface MonthlyHoursTotals {
  /** CA des mois disposant d'heures terrain connues. */
  caWithTerrain: number;
  caTotal: number;
  totalTerrain: number;
  totalGestion: number;
  /** Terrain + gestion sur l'ensemble des 12 mois. */
  heuresTotales: number;
  totalJours: number;
  avgBrut: number;
  avgNet: number;
  avgCaJour: number;
}

export function monthlyTotals(months: MonthMetric[]): MonthlyHoursTotals {
  const withTerrain = months.filter((m) => (m.temps_terrain ?? 0) > 0);
  const caWithTerrain = withTerrain.reduce((s, m) => s + m.ca, 0);
  const totalTerrain = withTerrain.reduce((s, m) => s + (m.temps_terrain ?? 0), 0);
  const totalGestion = withTerrain.reduce((s, m) => s + (m.temps_gestion ?? 0), 0);
  const caTotal = months.reduce((s, m) => s + m.ca, 0);
  const totalJours = months.reduce((s, m) => s + (m.jours_travailles ?? 0), 0);
  const heuresTotales = months.reduce(
    (s, m) => s + (m.temps_terrain ?? 0) + (m.temps_gestion ?? 0),
    0,
  );
  return {
    caWithTerrain,
    caTotal,
    totalTerrain,
    totalGestion,
    heuresTotales,
    totalJours,
    avgBrut: totalTerrain > 0 ? caWithTerrain / totalTerrain : 0,
    avgNet: totalTerrain + totalGestion > 0 ? caWithTerrain / (totalTerrain + totalGestion) : 0,
    avgCaJour: totalJours > 0 ? caTotal / totalJours : 0,
  };
}
