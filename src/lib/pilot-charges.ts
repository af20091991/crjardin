import { supabase } from "@/integrations/supabase/client";
import { isRealizedMonth } from "@/lib/pilot-realized";
import { employerCost, splitRemuneration } from "@/lib/pilot-remuneration";

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
  /** Type en base : `charge` (exploitation) ou `remuneration` (dirigeant). */
  kind: "charge" | "remuneration";
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

async function fetchAll(kinds: string[]): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("pilot_ca_entries")
      .select("id,year,month,kind,designation,amount_ht,charge_class,charge_category,is_investment")
      .in("kind", kinds)
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
  // Charges d'exploitation ET rémunération dirigeant : une seule lecture,
  // une seule source. La séparation se fait ensuite via `splitRemuneration`.
  const raw = await fetchAll(["charge", "remuneration"]);
  return raw.map((r) => ({
    id: r.id,
    year: r.year,
    month: r.month,
    designation: r.designation,
    amount_ht: Number(r.amount_ht) || 0,
    charge_class: (r.charge_class as ChargeClass) ?? "a_classer",
    charge_category: r.charge_category ?? "À classer",
    kind: r.kind === "remuneration" ? "remuneration" : "charge",
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
export function operatingCharges(rows: ChargeRow[]): ChargeRow[] {
  // Charges d'exploitation seules : la rémunération dirigeant est suivie à part
  // (module Charges) et n'entre jamais dans le bénéfice brut.
  return rows.filter((r) => r.kind !== "remuneration");
}

export function investmentsByYear(rows: ChargeRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (!r.is_investment) continue;
    m.set(r.year, (m.get(r.year) ?? 0) + r.amount_ht);
  }
  return m;
}

/** CA HT (ventes) par année — sert au poids des charges dans le CA. */
export async function listSalesByYear(options?: { mode?: "reel" | "projection" }): Promise<Map<number, number>> {
  const raw = await fetchAll(["vente"]);
  const m = new Map<number, number>();
  for (const r of raw) {
    if (options?.mode !== "projection" && !isRealizedMonth(r.year, r.month)) continue;
    m.set(r.year, (m.get(r.year) ?? 0) + (Number(r.amount_ht) || 0));
  }
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
  /** Rémunération dirigeant repérée dans les charges — suivie à part. */
  remuneration: {
    lines: number;
    net: number;
    /** Coût entreprise = net + cotisations (règle +45 %). */
    employerCost: number;
    byYear: Map<number, { net: number; employerCost: number }>;
  };
}

function monthsIn(rows: ChargeRow[]): number {
  return new Set(rows.map((r) => r.month)).size;
}

/**
 * PÉRIMÈTRE UNIQUE DES CHARGES D'UN EXERCICE.
 * Toute page qui a besoin des charges d'un exercice passe par ici :
 *  - exercice strict (`year`) : jamais d'autre année agrégée implicitement ;
 *  - mode Réel = mois déjà réalisés uniquement, Projection = exercice complet ;
 *  - hors investissements qualifiés (suivis à part) ;
 *  - hors rémunération dirigeant (règle net + 45 %, module dédié).
 * La classification fixe / variable / à classer n'est jamais modifiée ici :
 * une charge « à classer » reste « à classer ».
 */
export function operatingChargesForYear(
  rows: ChargeRow[],
  year: number,
  options?: { mode?: "reel" | "projection" },
): ChargeRow[] {
  const scoped = options?.mode === "projection" ? rows : rows.filter((r) => isRealizedMonth(r.year, r.month));
  return splitRemuneration(scoped.filter((r) => r.year === year && !r.is_investment)).charges;
}

/** Total des charges d'exploitation d'un exercice (même périmètre unique). */
export function chargesTotalForYear(
  rows: ChargeRow[],
  year: number,
  options?: { mode?: "reel" | "projection" },
): number {
  return operatingChargesForYear(rows, year, options).reduce((s, r) => s + r.amount_ht, 0);
}

export function analyzeCharges(
  allRows: ChargeRow[],
  salesByYear: Map<number, number>,
  categoryLabels: string[],
  options?: { mode?: "reel" | "projection" },
): ChargesAnalysis {
  const scopedRows = options?.mode === "projection" ? allRows : allRows.filter((r) => isRealizedMonth(r.year, r.month));
  const nonInvest = scopedRows.filter((r) => !r.is_investment);
  // La rémunération dirigeant sort du classement charges fixes / variables.
  const { charges: rows, remuneration: remuRows } = splitRemuneration(nonInvest);
  const investments = investmentsByYear(scopedRows);
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

  const remuByYear = new Map<number, { net: number; employerCost: number }>();
  for (const r of remuRows) {
    const cur = remuByYear.get(r.year) ?? { net: 0, employerCost: 0 };
    cur.net += r.amount_ht;
    cur.employerCost += employerCost(r.amount_ht);
    remuByYear.set(r.year, cur);
  }

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
    remuneration: {
      lines: remuRows.length,
      net: remuRows.reduce((s, r) => s + r.amount_ht, 0),
      employerCost: remuRows.reduce((s, r) => s + employerCost(r.amount_ht), 0),
      byYear: remuByYear,
    },
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
  const yr = operatingChargesForYear(allRows, year);
  const invest = allRows
    .filter((r) => r.year === year && r.is_investment && isRealizedMonth(r.year, r.month))
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
// ---------------------------------------------------------------------------
// Vues d'affichage des charges — UNIQUE implémentation.
// Les écrans ne regroupent, ne trient et ne totalisent plus rien eux-mêmes :
// tout passe par ces fonctions, exposées via le moteur analytique central.
// ---------------------------------------------------------------------------

export function salesTotal(salesByYear: Map<number, number>): number {
  let s = 0;
  for (const v of salesByYear.values()) s += v;
  return s;
}

/** Poids des charges dans le CA (toutes années confondues). */
export function chargesWeightPct(analysis: ChargesAnalysis, caTotal: number): number | null {
  return caTotal > 0 ? (analysis.totals.total / caTotal) * 100 : null;
}

/** Répartition par catégorie : top N + regroupement « Autres ». */
export function categoryBreakdown(
  analysis: ChargesAnalysis,
  topN = 8,
): Array<{ name: string; value: number }> {
  const sorted = analysis.categories.filter((c) => c.total > 0);
  const autres = sorted.slice(topN).reduce((s, c) => s + c.total, 0);
  return [
    ...sorted.slice(0, topN).map((c) => ({ name: c.label, value: Math.round(c.total) })),
    ...(autres > 0 ? [{ name: "Autres", value: Math.round(autres) }] : []),
  ];
}

/** Évolution annuelle fixes / variables / total. */
export function chargesEvolution(
  analysis: ChargesAnalysis,
): Array<{ annee: string; Fixes: number; Variables: number; Total: number }> {
  return analysis.years.map((y) => ({
    annee: String(y.year),
    Fixes: Math.round(y.fixe),
    Variables: Math.round(y.variable),
    Total: Math.round(y.total),
  }));
}

export function priorityCategories(analysis: ChargesAnalysis): CategoryAnalysis[] {
  return analysis.categories.filter((c) =>
    (PRIORITY_VARIABLE_CATEGORIES as readonly string[]).includes(c.label),
  );
}

/** Historique annuel des charges variables prioritaires. */
export function priorityTrend(analysis: ChargesAnalysis): Array<Record<string, string | number>> {
  const priority = priorityCategories(analysis);
  return analysis.years.map((y) => {
    const row: Record<string, string | number> = { annee: String(y.year) };
    for (const c of priority) {
      row[c.label] = Math.round(c.years.find((cy) => cy.year === y.year)?.total ?? 0);
    }
    return row;
  });
}

/** Charges réelles mois par mois d'un exercice (hors rémunération dirigeant). */
export function monthlyChargeTotals(
  rows: ChargeRow[],
  year: number,
  options?: { mode?: "reel" | "projection" },
): number[] {
  const arr = Array(12).fill(0) as number[];
  for (const r of operatingChargesForYear(rows, year, options)) {
    if (r.month >= 1 && r.month <= 12) arr[r.month - 1] += r.amount_ht;
  }
  return arr;
}

/** Investissements qualifiés d'un exercice, selon le mode d'analyse. */
export function investmentsForYear(
  rows: ChargeRow[],
  year: number,
  options?: { mode?: "reel" | "projection" },
): number {
  const scoped = options?.mode === "projection" ? rows : rows.filter((r) => isRealizedMonth(r.year, r.month));
  return scoped
    .filter((r) => r.year === year && r.is_investment)
    .reduce((s, r) => s + r.amount_ht, 0);
}
