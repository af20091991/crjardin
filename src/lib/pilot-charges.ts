import { supabase } from "@/integrations/supabase/client";

/** Nature d'une charge. `a_classer` = non reconnue automatiquement, jamais devinée. */
export type ChargeClass = "fixe" | "variable" | "a_classer";

export const CHARGE_CLASS_LABELS: Record<ChargeClass, string> = {
  fixe: "Charge fixe",
  variable: "Charge variable",
  a_classer: "À classer",
};

/** Catégories variables prioritaires suivies dans l'analyse. */
export const PRIORITY_VARIABLE_CATEGORIES = ["Alimentaire", "Carburant", "Déchèterie"] as const;

export interface ChargeCategory {
  id: string;
  user_id: string;
  label: string;
  charge_class: ChargeClass;
  keywords: string[];
  position: number;
  is_active: boolean;
}

export interface ChargeRow {
  id: string;
  year: number;
  month: number;
  designation: string | null;
  amount_ht: number;
  charge_class: ChargeClass;
  charge_category: string;
  /** Qualifiée comme investissement : suivie à part, hors charges mensuelles. */
  is_investment: boolean;
}

type RawRow = {
  id: string;
  year: number;
  month: number;
  kind: string;
  designation: string | null;
  amount_ht: number | null;
  charge_class: string | null;
  charge_category: string | null;
  is_investment?: boolean | null;
};

async function fetchAll(kind: "charge" | "vente"): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("pilot_ca_entries")
      .select("id,year,month,kind,designation,amount_ht,charge_class,charge_category,is_investment")
      .eq("kind", kind)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as RawRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function listChargeRows(): Promise<ChargeRow[]> {
  const raw = await fetchAll("charge");
  return raw.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    designation: r.designation,
    amount_ht: Number(r.amount_ht) || 0,
    charge_class: (r.charge_class as ChargeClass) ?? "a_classer",
    charge_category: r.charge_category ?? "À classer",
    is_investment: Boolean(r.is_investment),
  }));
}

/** Qualifie (ou déqualifie) une ligne de charge en investissement. */
export async function setChargeInvestment(id: string, isInvestment: boolean): Promise<void> {
  const { error } = await supabase
    .from("pilot_ca_entries")
    .update({ is_investment: isInvestment } as never)
    .eq("id", id);
  if (error) throw error;
}

/** Total des investissements par exercice (jamais compté dans les charges). */
export function investmentsByYear(rows: ChargeRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (!r.is_investment) continue;
    m.set(r.year, (m.get(r.year) ?? 0) + r.amount_ht);
  }
  return m;
}

/** CA HT (ventes) par année — sert au poids des charges dans le CA. */
export async function listSalesByYear(): Promise<Map<number, number>> {
  const raw = await fetchAll("vente");
  const m = new Map<number, number>();
  for (const r of raw) m.set(r.year, (m.get(r.year) ?? 0) + (Number(r.amount_ht) || 0));
  return m;
}

export async function listChargeCategories(): Promise<ChargeCategory[]> {
  const { data, error } = await supabase
    .from("pilot_charge_categories")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ChargeCategory[];
}

// ---------- Agrégations ----------

export interface YearCharges {
  year: number;
  fixe: number;
  variable: number;
  aClasser: number;
  total: number;
  /** Nombre de mois distincts observés dans les données de l'année. */
  monthsObserved: number;
  monthlyAverage: number;
  ca: number;
  weightPct: number | null;
}

export interface CategoryYear {
  year: number;
  total: number;
  monthlyAverage: number;
  /** Variation vs année précédente, en %. `null` si pas de N-1 exploitable. */
  evolutionPct: number | null;
}

export interface CategoryAnalysis {
  label: string;
  charge_class: ChargeClass;
  total: number;
  years: CategoryYear[];
}

export interface ChargesAnalysis {
  years: YearCharges[];
  categories: CategoryAnalysis[];
  unclassifiedCount: number;
  unclassifiedAmount: number;
  totals: { fixe: number; variable: number; aClasser: number; total: number };
  /** Investissements par exercice, suivis séparément des charges. */
  investments: Map<number, number>;
  investmentsTotal: number;
}

function monthsIn(rows: ChargeRow[]): number {
  return new Set(rows.map((r) => r.month)).size;
}

export function analyzeCharges(
  allRows: ChargeRow[],
  salesByYear: Map<number, number>,
  categoryLabels: string[],
): ChargesAnalysis {
  const rows = allRows.filter((r) => !r.is_investment);
  const investments = investmentsByYear(allRows);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);

  const yearStats: YearCharges[] = years.map((year) => {
    const yr = rows.filter((r) => r.year === year);
    const sum = (cls: ChargeClass) =>
      yr.filter((r) => r.charge_class === cls).reduce((s, r) => s + r.amount_ht, 0);
    const fixe = sum("fixe");
    const variable = sum("variable");
    const aClasser = sum("a_classer");
    const total = fixe + variable + aClasser;
    const months = monthsIn(yr);
    const ca = salesByYear.get(year) ?? 0;
    return {
      year,
      fixe,
      variable,
      aClasser,
      total,
      monthsObserved: months,
      monthlyAverage: months > 0 ? total / months : 0,
      ca,
      weightPct: ca > 0 ? (total / ca) * 100 : null,
    };
  });

  const labels = [...new Set([...categoryLabels, ...rows.map((r) => r.charge_category)])];
  const categories: CategoryAnalysis[] = labels.map((label) => {
    const cr = rows.filter((r) => r.charge_category === label);
    const cls = (cr[0]?.charge_class ?? "a_classer") as ChargeClass;
    const catYears: CategoryYear[] = years.map((year) => {
      const yr = cr.filter((r) => r.year === year);
      const total = yr.reduce((s, r) => s + r.amount_ht, 0);
      const months = monthsIn(yr);
      return { year, total, monthlyAverage: months > 0 ? total / months : 0, evolutionPct: null };
    });
    for (let i = 1; i < catYears.length; i++) {
      const prev = catYears[i - 1].total;
      if (prev > 0) catYears[i].evolutionPct = ((catYears[i].total - prev) / prev) * 100;
    }
    return {
      label,
      charge_class: cls,
      total: cr.reduce((s, r) => s + r.amount_ht, 0),
      years: catYears,
    };
  });

  const unclassified = rows.filter((r) => r.charge_class === "a_classer");

  return {
    years: yearStats,
    categories: categories.sort((a, b) => b.total - a.total),
    unclassifiedCount: unclassified.length,
    unclassifiedAmount: unclassified.reduce((s, r) => s + r.amount_ht, 0),
    totals: {
      fixe: yearStats.reduce((s, y) => s + y.fixe, 0),
      variable: yearStats.reduce((s, y) => s + y.variable, 0),
      aClasser: yearStats.reduce((s, y) => s + y.aClasser, 0),
      total: yearStats.reduce((s, y) => s + y.total, 0),
    },
    investments,
    investmentsTotal: [...investments.values()].reduce((s, v) => s + v, 0),
  };
}

/**
 * Base « réel à date » pour la future projection fin d'exercice.
 * Aucune extrapolation n'est faite ici : on expose seulement les agrégats bruts.
 */
export interface ProjectionBase {
  year: number;
  monthsObserved: number;
  fixeToDate: number;
  variableToDate: number;
  totalToDate: number;
  monthlyAverage: number;
  caToDate: number;
  margeDisponible: number;
  /** Investissements de l'exercice, hors charges d'exploitation. */
  investments: number;
  /** Résultat après investissements = marge disponible − investissements. */
  resultatApresInvestissements: number;
}

export function projectionBase(
  allRows: ChargeRow[],
  year: number,
  salesByYear: Map<number, number>,
): ProjectionBase {
  const yr = allRows.filter((r) => r.year === year && !r.is_investment);
  const invest = allRows
    .filter((r) => r.year === year && r.is_investment)
    .reduce((s, r) => s + r.amount_ht, 0);
  const sum = (cls: ChargeClass) =>
    yr.filter((r) => r.charge_class === cls).reduce((s, r) => s + r.amount_ht, 0);
  const fixe = sum("fixe");
  const variable = sum("variable");
  const aClasser = sum("a_classer");
  const months = monthsIn(yr);
  const total = fixe + variable + aClasser;
  const ca = salesByYear.get(year) ?? 0;
  return {
    year,
    monthsObserved: months,
    fixeToDate: fixe,
    variableToDate: variable,
    totalToDate: total,
    monthlyAverage: months > 0 ? total / months : 0,
    caToDate: ca,
    margeDisponible: ca - total,
    investments: invest,
    resultatApresInvestissements: ca - total - invest,
  };
}