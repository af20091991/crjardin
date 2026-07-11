import { supabase } from "@/integrations/supabase/client";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export type CaKind = "vente" | "charge" | "remuneration";

export interface CaEntry {
  id: string;
  user_id: string;
  year: number;
  month: number; // 1-12
  kind: CaKind;
  designation: string | null;
  amount_ht: number;
  hours: number | null;
  is_fixed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export type CaEntryInput = {
  year: number;
  month: number;
  kind: CaKind;
  designation?: string | null;
  amount_ht?: number;
  hours?: number | null;
  is_fixed?: boolean;
  position?: number;
};

export async function listCaEntries(year: number): Promise<CaEntry[]> {
  const { data, error } = await supabase
    .from("pilot_ca_entries" as never)
    .select("*")
    .eq("year", year)
    .order("month", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CaEntry[];
}

export async function createCaEntry(input: CaEntryInput): Promise<CaEntry> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("pilot_ca_entries" as never)
    .insert({ amount_ht: 0, ...input, user_id } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CaEntry;
}

export async function updateCaEntry(id: string, input: Partial<CaEntryInput>): Promise<void> {
  const { error } = await supabase.from("pilot_ca_entries" as never).update(input as never).eq("id", id);
  if (error) throw error;
}

export async function deleteCaEntry(id: string): Promise<void> {
  const { error } = await supabase.from("pilot_ca_entries" as never).delete().eq("id", id);
  if (error) throw error;
}

// ---------- Constantes fidèles au tableur ----------
export const TVA_RATE = 0.2;       // Coef TVA 1.2
export const COEF_ASAP = 1.07;     // Coef ASAP

export const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export const QUARTER_OF = (m: number) => Math.ceil(m / 3); // m 1-12

// ---------- Calculs mensuels ----------
export type MonthTotals = {
  month: number;
  ventesHt: number;
  ventesTtc: number;
  chargesHt: number;
  remuneration: number;
  benefice: number; // CA HT - charges HT
  hours: number;
  tauxHoraire: number;
};

export function monthTotals(entries: CaEntry[], month: number): MonthTotals {
  const rows = entries.filter((e) => e.month === month);
  const ventes = rows.filter((e) => e.kind === "vente");
  const charges = rows.filter((e) => e.kind === "charge");
  const remu = rows.filter((e) => e.kind === "remuneration");
  const ventesHt = ventes.reduce((s, e) => s + (e.amount_ht || 0), 0);
  const chargesHt = charges.reduce((s, e) => s + (e.amount_ht || 0), 0);
  const remuneration = remu.reduce((s, e) => s + (e.amount_ht || 0), 0);
  const hours = ventes.reduce((s, e) => s + (e.hours || 0), 0);
  return {
    month,
    ventesHt,
    ventesTtc: ventesHt * (1 + TVA_RATE),
    chargesHt,
    remuneration,
    benefice: ventesHt - chargesHt,
    hours,
    tauxHoraire: hours > 0 ? ventesHt / hours : 0,
  };
}

export type YearTotals = {
  ventesHt: number;
  ventesTtc: number;
  chargesHt: number;
  benefice: number;
  hours: number;
  months: MonthTotals[];
};

export function yearTotals(entries: CaEntry[]): YearTotals {
  const months = Array.from({ length: 12 }, (_, i) => monthTotals(entries, i + 1));
  return {
    ventesHt: months.reduce((s, m) => s + m.ventesHt, 0),
    ventesTtc: months.reduce((s, m) => s + m.ventesTtc, 0),
    chargesHt: months.reduce((s, m) => s + m.chargesHt, 0),
    benefice: months.reduce((s, m) => s + m.benefice, 0),
    hours: months.reduce((s, m) => s + m.hours, 0),
    months,
  };
}

// ---------- Calculateurs (convertisseurs du tableur) ----------
export function calcHtToTtc(ht: number) {
  return { ttc: ht * (1 + TVA_RATE), tva: ht * TVA_RATE };
}

export function calcTtcToHt(ttc: number) {
  return { ht: ttc / (1 + TVA_RATE), tva: ttc - ttc / (1 + TVA_RATE) };
}

export function calcDechetterie(kg: number, prixTonne: number) {
  return { cout: (kg / 1000) * prixTonne };
}

export function calcSap(ttcFacture: number) {
  const tva = ttcFacture - ttcFacture / (1 + TVA_RATE);
  const montantReverse = ttcFacture / COEF_ASAP;
  const htDeduit = (ttcFacture - tva) / COEF_ASAP;
  const htReverse = ttcFacture / COEF_ASAP / (1 + TVA_RATE);
  return { tva, montantReverse, htDeduit, htReverse };
}

export function calcRemise(initial: number, pct: number) {
  const remise = (initial * pct) / 100;
  return { remise, net: initial - remise };
}
