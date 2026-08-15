// ---------------------------------------------------------------------------
// MOTEUR ANALYTIQUE UNIQUE DE PILOT PRO
//
// Chaîne obligatoire, sans dérogation possible :
//
//   Données sources
//     ↓ validation des sources (pilot-realized : réel = date ≤ aujourd'hui)
//     ↓ normalisation (pilot.ts / pilot-charges / pilot-hours-ledger)
//     ↓ référentiel économique (clients.entity_status)
//     ↓ certification (pilot-entity-rules)
//     ↓ consolidation (ce module)
//     ↓ calcul des KPI (ce module)
//     ↓ affichage (composants React — AUCUN calcul métier)
//
// Règle absolue : la certification est appliquée AVANT tout calcul de KPI.
// Aucun composant, page, hook ou helper ne doit recalculer un CA, des heures,
// une marge, une rentabilité ou un classement : tout provient d'ici.
// ---------------------------------------------------------------------------

import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  FAMILIES,
  FAMILY_META,
  MONTHS,
  fetchConfirmedHoursByClient,
  getSettings,
  listEntries,
  monthlySeries,
  saleRateRowOf,
  type PilotEntry,
  type PilotSettings,
} from "@/lib/pilot";
import {
  analyzeCharges,
  categoryBreakdown,
  chargesEvolution,
  chargesWeightPct,
  investmentsForYear,
  listChargeCategories,
  listChargeRows,
  listSalesByYear,
  monthlyChargeTotals,
  operatingCharges,
  priorityCategories,
  priorityTrend,
  projectionBase,
  salesTotal,
  type ChargeRow,
  type ChargesAnalysis,
} from "@/lib/pilot-charges";
import {
  computeMonths,
  computeTjm,
  getTjmSettings,
  listHours,
  monthlyCa as monthlyCaTotals,
  monthlyFieldHours,
  monthlyTotals,
  monthsMissingGestion,
  type HoursRow,
  type MonthMetric,
  type MonthlyHoursTotals,
  type TjmResult,
  type TjmSettings,
} from "@/lib/pilot-hours";
import { projectYear, type ProjectionResult } from "@/lib/pilot-projection";
import { buildClientView, type ClientView, type ClientViewInput } from "@/lib/pilot-client-view";
import { fetchHoursLedger, type HoursLedgerEntry } from "@/lib/pilot-hours-ledger";
import { resolveRealHours, type RealHoursResolution } from "@/lib/pilot-real-hours";
import { annualSummary, type AnnualRow } from "@/lib/pilot-annual";
import { buildPortfolio, sortByProfitability, type PortfolioRow } from "@/lib/pilot-portfolio";
import { getClientEconomicScores, type ClientScore } from "@/lib/client-score";
import {
  canFeedAnalytics,
  fetchEntityStatuses,
  referentialCoverage,
  statusOf,
  type EntityStatusMap,
  type ReferentialCoverage,
} from "@/lib/pilot-entity-rules";
import { chargeRowsForMode, entriesForMode, type RealProjectionMode } from "@/lib/pilot-realized";
import type { KpiAudit } from "@/lib/pilot-kpi-audit";
import { employerCost } from "@/lib/pilot-remuneration";
import { saleRateScope } from "@/lib/pilot-sale-time";

export type EngineMode = RealProjectionMode;

export interface EngineScope {
  year: number;
  mode: EngineMode;
  /** Certification stricte : aucune analyse stratégique sur données non certifiées. */
  strict: boolean;
}

export interface EngineInputs {
  scope: EngineScope;
  entries: PilotEntry[];
  chargeRows: ChargeRow[];
  ledger: HoursLedgerEntry[];
  scores: ClientScore[];
  statuses: EntityStatusMap;
  salesByYear: Map<number, number>;
  settings: PilotSettings;
  /** Référentiel temps mensuel (pilot_hours) et sources CA mensuelles. */
  hoursRows: HoursRow[];
  monthlyCa: number[];
  monthlyFieldHours: number[];
  tjmSettings: TjmSettings | null;
  chargeCategories: string[];
  /** Heures confirmées de l'exercice précédent (comparatif direction). */
  prevConfirmedHours: Map<string, number>;
}

/** ÉTAPE 1-2 : lecture des sources officielles (une seule fois, pour tous les écrans). */
export async function loadEngineInputs(scope: EngineScope): Promise<EngineInputs> {
  const [
    entries,
    chargeRows,
    ledger,
    scores,
    statuses,
    salesByYear,
    settings,
    hoursRows,
    monthlyCa,
    fieldHours,
    tjmSettings,
    categories,
    prevConfirmedHours,
  ] = await Promise.all([
    listEntries(),
    listChargeRows(),
    fetchHoursLedger(undefined, { mode: scope.mode }),
    getClientEconomicScores(),
    fetchEntityStatuses(),
    listSalesByYear({ mode: scope.mode }),
    getSettings(),
    listHours(scope.year),
    monthlyCaTotals(scope.year, { mode: scope.mode }),
    monthlyFieldHours(scope.year, { mode: scope.mode }),
    getTjmSettings(),
    listChargeCategories(),
    fetchConfirmedHoursByClient(scope.year - 1, { mode: "reel" }),
  ]);
  return {
    scope,
    entries,
    chargeRows,
    ledger,
    scores,
    statuses,
    salesByYear,
    settings,
    hoursRows,
    monthlyCa,
    monthlyFieldHours: fieldHours,
    tjmSettings,
    chargeCategories: categories.map((c) => c.label),
    prevConfirmedHours,
  };
}

// ---------------------------------------------------------------------------
// Résultat du moteur
// ---------------------------------------------------------------------------

export type KpiKey =
  | "ca_annuel"
  | "ca_mois"
  | "ca_analytique"
  | "heures_vendues"
  | "heures_reelles"
  | "charges"
  | "benefice_brut"
  | "marge"
  | "resultat_apres_investissements"
  | "taux_horaire_vendu"
  | "taux_horaire_reel"
  | "classement_clients"
  | "score_client";

export interface Kpi {
  key: KpiKey;
  label: string;
  /** `null` = indicateur non produit (données absentes ou non certifiées). */
  value: number | null;
  unit: "eur" | "heures" | "pct" | "eur_heure" | "nombre";
  status: "ok" | "en_attente_certification" | "indisponible";
  /** Raisons affichables lorsque l'indicateur n'est pas produit. */
  reasons: string[];
  audit: KpiAudit;
}

export interface AnalyticsSnapshot {
  scope: EngineScope;
  /** Certification du référentiel appliquée avant tout calcul. */
  certification: ReferentialCoverage & {
    /** Part du CA de l'exercice porté par une entité exploitable. */
    caCoveragePct: number | null;
    /** Nombre de lignes CA non rattachées à une entité. */
    unlinkedLines: number;
  };
  ca: {
    /** CA comptable de l'exercice (toutes lignes, quelle que soit la certification). */
    yearHt: number;
    /** CA porté par des entités exploitables analytiquement (base des analyses). */
    yearAnalyticalHt: number;
    prevYearHt: number;
    monthHt: number;
    ytdHt: number;
    prevYtdHt: number;
    progressionPct: number | null;
    byMonth: { month: number; current: number; previous: number }[];
  };
  hours: {
    vendues: number;
    realisees: number;
    historiques: number;
    reelles: number;
    source: RealHoursResolution["source"];
    sourceLabel: string;
    byClient: Map<string, number>;
  };
  charges: {
    fixe: number;
    variable: number;
    aClasser: number;
    total: number;
    investissements: number;
    remunerationNette: number;
    remunerationCoutEmployeur: number;
    complete: boolean;
    analysis: ChargesAnalysis;
    /** Mois observés dans l'exercice (base du seuil mensuel). */
    monthsObserved: number;
    mensuelles: number;
    /** Charges de l'exercice mois par mois (hors rémunération dirigeant). */
    byMonth: number[];
    /** Vues d'affichage prêtes à l'emploi (aucun calcul dans les écrans). */
    weightPct: number | null;
    evolution: Array<{ annee: string; Fixes: number; Variables: number; Total: number }>;
    repartition: Array<{ name: string; value: number }>;
    priority: ChargesAnalysis["categories"];
    priorityTrend: Array<Record<string, string | number>>;
    projectionBase: ReturnType<typeof projectionBase>;
  };
  resultat: {
    beneficeBrut: number;
    margePct: number | null;
    resultatApresInvestissements: number;
  };
  /**
   * Vue « fin d'exercice » : identique à `resultat` en mode réel, extrapolée en
   * mode projection. Les écrans n'ont plus aucun arbitrage à faire.
   */
  outlook: {
    caHt: number;
    charges: number;
    beneficeBrut: number;
    margePct: number;
    investissements: number;
    resultatApresInvestissements: number;
    projected: boolean;
    explanation: string;
  };
  rates: {
    tauxHoraireVendu: number | null;
    tauxHoraireReel: number | null;
    cible: number;
    /** Coût horaire de structure = charges / heures travaillées (terrain + gestion). */
    coutHoraireStructure: number | null;
    /** Seuil de rentabilité mensuel = charges mensuelles moyennes. */
    seuilMensuel: number;
  };
  /** Référentiel temps mensuel consolidé (taux horaire, jours, gestion). */
  monthly: {
    rows: MonthMetric[];
    totals: MonthlyHoursTotals;
    gestionDefaut: number;
    missingGestion: number[];
    /** Série financière mensuelle (mode réel ou projection selon le périmètre). */
    finance: Array<{
      mois: string;
      CA: number;
      Charges: number;
      Bénéfice: number;
      projete: boolean;
      tauxNet: number | null;
    }>;
    /** Série CA N vs N-1. */
    caSeries: Array<{ month: string; current: number; previous: number }>;
  };
  tjm: { settings: TjmSettings | null; result: TjmResult | null; tauxCible: number | null };
  projection: ProjectionResult;
  /** Mix d'activité par famille de prestation. */
  families: Array<{ family: string; label: string; color: string; value: number; pct: number }>;
  familyConcentrationPct: number;
  /** Exercice précédent (comparatifs direction). */
  prevYear: { caHt: number; hoursConfirmed: number; hourlyRate: number | null };
  /** Alertes financières dérivées des seuls indicateurs certifiés. */
  financeAlerts: Array<{ tone: "danger" | "warn"; text: string }>;
  clients: {
    /** Toutes les fiches consolidées (certification incluse dans chaque ligne). */
    all: PortfolioRow[];
    /** Classement stratégique — seules les entités éligibles, ordre unique. */
    ranking: PortfolioRow[];
    /** Fiches écartées du classement, avec le motif. */
    excluded: PortfolioRow[];
  };
  annual: AnnualRow[];
  kpis: Record<KpiKey, Kpi>;
  /**
   * Données brutes déjà chargées, exposées pour les tableaux de détail et les
   * formulaires. Aucune agrégation ne doit être refaite à partir d'elles.
   */
  sources: {
    chargeRows: ChargeRow[];
    chargeCategories: string[];
    entries: PilotEntry[];
    settings: PilotSettings;
  };
}

const MONTH_COUNT = 12;

function ytdLimit(scope: EngineScope, now: Date): number {
  if (scope.mode === "projection") return 12;
  if (scope.year < now.getFullYear()) return 12;
  if (scope.year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

const yearOf = (iso: string) => Number(iso.slice(0, 4));
const monthOf = (iso: string) => Number(iso.slice(5, 7));

/**
 * ÉTAPES 3 à 7 : normalisation → référentiel → certification → consolidation →
 * KPI. Fonction PURE : mêmes entrées ⇒ mêmes sorties, dans tous les modules.
 */
export function buildAnalytics(inputs: EngineInputs, now = new Date()): AnalyticsSnapshot {
  const { scope, statuses } = inputs;
  const { year, mode, strict } = scope;

  // --- validation des sources (réel = date comptable ≤ aujourd'hui) ---
  const entries = entriesForMode(inputs.entries, mode, now);
  const chargeAll = chargeRowsForMode(inputs.chargeRows, mode, now);

  // --- certification AVANT calcul ---
  const eligible = (clientId: string | null) =>
    clientId ? canFeedAnalytics(statusOf(statuses, clientId)) : false;

  const yearEntries = entries.filter((e) => yearOf(e.entry_date) === year);
  const prevEntries = entries.filter((e) => yearOf(e.entry_date) === year - 1);
  const analyticalEntries = yearEntries.filter((e) => eligible(e.client_id));

  const sum = (rows: PilotEntry[]) => rows.reduce((s, e) => s + (Number(e.amount_ht) || 0), 0);

  const limit = ytdLimit(scope, now);
  const yearHt = sum(yearEntries);
  const prevYearHt = sum(prevEntries);
  const ytdHt = sum(yearEntries.filter((e) => monthOf(e.entry_date) <= limit));
  // N-1 borné à la MÊME date calendaire (jour inclus) pour une comparaison
  // strictement à date équivalente.
  const prevCutoffDay = year === now.getFullYear() ? now.getDate() : 31;
  const prevYtdHt = sum(
    prevEntries.filter((e) => {
      const m = monthOf(e.entry_date);
      if (m < limit) return true;
      if (m > limit) return false;
      return new Date(e.entry_date).getDate() <= prevCutoffDay;
    }),
  );
  const monthHt = sum(yearEntries.filter((e) => monthOf(e.entry_date) === Math.max(limit, 1)));

  const byMonth = Array.from({ length: MONTH_COUNT }, (_, i) => ({
    month: i + 1,
    current: sum(yearEntries.filter((e) => monthOf(e.entry_date) === i + 1)),
    previous: sum(prevEntries.filter((e) => monthOf(e.entry_date) === i + 1)),
  }));

  // --- heures consolidées (source unique : ledger) ---
  const ledger = inputs.ledger.filter((l) => !strict || l.clientId == null || eligible(l.clientId));
  const hoursRes = resolveRealHours(ledger, year);

  // --- charges (source unique : pilot-charges) ---
  const analysis = analyzeCharges(chargeAll, inputs.salesByYear, inputs.chargeCategories, {
    mode,
    now,
  });
  const yearCharges = analysis.years.find((y) => y.year === year);
  const operatingYear = operatingCharges(chargeAll).filter(
    (c) => c.year === year && !c.is_investment,
  );
  const chargesTotal = operatingYear.reduce((s, c) => s + c.amount_ht, 0);
  const investissements = analysis.investments.get(year) ?? 0;
  const remu = analysis.remuneration.byYear.get(year) ?? { net: 0, employerCost: 0 };

  const beneficeBrut = yearHt - chargesTotal;
  const chargesComplete = chargesTotal > 0;
  const margePct = yearHt > 0 && chargesComplete ? (beneficeBrut / yearHt) * 100 : null;

  // Taux horaire : CA des lignes de vente retenues (Temps documenté, 0 h SST
  // inclus) ÷ Temps de CES MÊMES lignes. Aucune autre source de temps.
  const ratedAll = saleRateScope(yearEntries.map(saleRateRowOf));
  const ratedAnalytical = saleRateScope(
    (strict ? analyticalEntries : yearEntries).map(saleRateRowOf),
  );
  const tauxHoraireVendu = ratedAll.rate;
  const tauxHoraireReel = ratedAnalytical.rate;

  // --- portefeuille & classement (une seule implémentation) ---
  const allRows = buildPortfolio({
    entries,
    ledger,
    scores: inputs.scores,
    year,
    statuses,
  });
  const rankable = allRows.filter((r) =>
    strict ? r.entityStatus === "certified_client" : r.rankable,
  );
  const ranking = sortByProfitability(rankable);
  const excluded = allRows.filter((r) => !rankable.includes(r));

  // --- couverture référentielle ---
  const coverage = referentialCoverage(
    allRows.map((r) => ({ entityStatus: r.entityStatus, caTotal: r.caYear })),
  );
  const analyticalCa = sum(analyticalEntries);
  const certification = {
    ...coverage,
    caCoveragePct: yearHt > 0 ? (analyticalCa / yearHt) * 100 : null,
    unlinkedLines: yearEntries.filter((e) => !e.client_id).length,
  };

  const annual = annualSummary(inputs.entries, inputs.chargeRows, { mode, now });

  // --- référentiel temps mensuel (taux horaire, jours, gestion) ---
  const gestionDefaut = inputs.tjmSettings?.heures_gestion ?? 60;
  const monthRows = computeMonths(
    inputs.monthlyCa,
    inputs.hoursRows,
    gestionDefaut,
    inputs.monthlyFieldHours,
  );
  const monthTotals = monthlyTotals(monthRows, gestionDefaut);
  const tjmResult = inputs.tjmSettings ? computeTjm(inputs.tjmSettings) : null;

  // --- projection d'exercice (mode projection) ---
  const projection = projectYear({
    entries: inputs.entries,
    charges: inputs.chargeRows.filter((r) => !r.is_investment),
    year,
    now,
  });
  const isProjection = mode === "projection";

  // --- séries financières mensuelles ---
  const chargesByMonth = monthlyChargeTotals(inputs.chargeRows, year, { mode, now });
  const financeMonths = monthRows.map((m, i) => {
    const ca = Math.round(isProjection ? projection.monthly[i].ca : m.ca);
    const ch = Math.round(isProjection ? projection.monthly[i].charges : chargesByMonth[i]);
    return {
      mois: MONTHS[m.month - 1],
      CA: ca,
      Charges: ch,
      Bénéfice: ca - ch,
      projete: isProjection ? projection.monthly[i].projected : false,
      tauxNet: m.net,
    };
  });

  const monthsObserved = yearCharges?.monthsObserved ?? 0;
  const currentAnnualRow = annual.find((a) => a.year === year);
  const outlookCa = isProjection ? projection.caProjete : (currentAnnualRow?.caHt ?? yearHt);
  const outlookCharges = isProjection ? projection.chargesProjetees : (currentAnnualRow?.charges ?? chargesTotal);
  const outlookBenefice = isProjection
    ? outlookCa - outlookCharges
    : (currentAnnualRow?.beneficeBrut ?? beneficeBrut);
  const chargesMensuelles = monthsObserved > 0 ? chargesTotal / monthsObserved : 0;
  const coutHoraireStructure =
    monthTotals.heuresTotales > 0 ? chargesTotal / monthTotals.heuresTotales : null;

  // --- mix d'activité par famille ---
  const families = FAMILIES.map((f) => {
    const value = sum(yearEntries.filter((e) => e.family === f));
    return {
      family: f as string,
      label: FAMILY_META[f].short,
      color: FAMILY_META[f].color,
      value,
      pct: yearHt > 0 ? (value / yearHt) * 100 : 0,
    };
  });
  const familyTotal = families.reduce((s, f) => s + f.value, 0);
  const familiesRanked = [...families].filter((f) => f.value > 0).sort((a, b) => b.value - a.value);
  const familyConcentrationPct =
    familiesRanked[0] && familyTotal > 0 ? (familiesRanked[0].value / familyTotal) * 100 : 0;

  // --- exercice précédent (comparatif) ---
  // Taux horaire N-1 : mêmes lignes de vente au numérateur et au dénominateur.
  const ratedPrev = saleRateScope(prevEntries.map(saleRateRowOf));
  const prevHours = ratedPrev.hours;
  const prevYearRow = annual.find((a) => a.year === year - 1);
  const prevYearCa = prevYearRow?.caHt ?? prevYearHt;

  // --- alertes financières (dérivées des seuls indicateurs du moteur) ---
  const financeAlerts: AnalyticsSnapshot["financeAlerts"] = [];
  if (margePct != null && margePct < 15 && yearHt > 0)
    financeAlerts.push({
      tone: "danger",
      text: `Marge de ${margePct.toFixed(0)} % : en dessous du seuil de sécurité de 15 %.`,
    });
  if (prevYearRow && prevYearRow.charges > 0) {
    const evo = ((chargesTotal - prevYearRow.charges) / prevYearRow.charges) * 100;
    if (evo > 15)
      financeAlerts.push({ tone: "warn", text: `Charges en hausse de ${evo.toFixed(0)} % vs ${year - 1}.` });
  }
  const negMonths = financeMonths.filter((m) => m.CA > 0 && m.Bénéfice < 0);
  if (negMonths.length > 0)
    financeAlerts.push({
      tone: "warn",
      text: `${negMonths.length} mois à bénéfice négatif : ${negMonths.map((m) => m.mois).join(", ")}.`,
    });
  if (analysis.unclassifiedCount > 0)
    financeAlerts.push({
      tone: "warn",
      text: `${analysis.unclassifiedCount} charge(s) non classées faussent l'analyse.`,
    });

  const periode =
    mode === "reel"
      ? `Exercice ${year} — réel à date (mois ≤ ${limit || 0})`
      : `Exercice ${year} — projection (12 mois)`;

  const strictPending = (reasons: string[]): Kpi["status"] =>
    strict && reasons.length > 0 ? "en_attente_certification" : "ok";

  const certifReasons: string[] = [];
  if (certification.caCoveragePct != null && certification.caCoveragePct < 100) {
    certifReasons.push(
      `${(100 - certification.caCoveragePct).toFixed(1)} % du CA de l'exercice provient d'entités non certifiées.`,
    );
  }
  if (certification.unlinkedLines > 0) {
    certifReasons.push(`${certification.unlinkedLines} ligne(s) CA sans entité économique rattachée.`);
  }
  if (coverage.toValidate > 0) {
    certifReasons.push(`${coverage.toValidate} fiche(s) en attente de certification.`);
  }

  const kpi = (
    key: KpiKey,
    label: string,
    value: number | null,
    unit: Kpi["unit"],
    audit: KpiAudit,
    reasons: string[] = [],
  ): Kpi => {
    const status: Kpi["status"] =
      value == null ? "indisponible" : strictPending(reasons);
    return {
      key,
      label,
      value: status === "en_attente_certification" ? null : value,
      unit,
      status,
      reasons: status === "ok" ? [] : reasons,
      audit,
    };
  };

  const kpis: Record<KpiKey, Kpi> = {
    ca_annuel: kpi("ca_annuel", "CA HT de l'exercice", yearHt, "eur", {
      sources: ["pilot_ca_entries (kind = vente)"],
      calcul: "Somme des montants HT des lignes de vente de l'exercice.",
      periode,
    }),
    ca_mois: kpi("ca_mois", "CA HT du mois", monthHt, "eur", {
      sources: ["pilot_ca_entries (kind = vente)"],
      calcul: "Somme des montants HT du dernier mois réalisé.",
      periode,
    }),
    ca_analytique: kpi("ca_analytique", "CA HT certifié", analyticalCa, "eur", {
      sources: ["pilot_ca_entries", "clients.entity_status"],
      calcul: "CA porté par des entités économiques exploitables (certification appliquée avant agrégation).",
      periode,
      fiabilite:
        certification.caCoveragePct != null
          ? `${certification.caCoveragePct.toFixed(1)} % du CA certifié`
          : undefined,
    }),
    heures_vendues: kpi("heures_vendues", "Heures d'intervention (Vente → Temps)", hoursRes.vendues, "heures", {
      sources: ["pilot_ca_entries.hours"],
      calcul: "Somme de la colonne Temps des lignes de vente — source unique des heures.",
      periode,
    }),
    heures_reelles: kpi(
      "heures_reelles",
      "Heures d'intervention retenues",
      hoursRes.hours > 0 ? hoursRes.hours : null,
      "heures",
      {
        sources: ["pilot_ca_entries.hours (Vente → Temps)"],
        calcul:
          "Somme de la colonne Vente → Temps. Aucune autre source d'heures n'entre dans les calculs.",
        periode,
        fiabilite: hoursRes.sourceLabel,
      },
    ),
    charges: kpi("charges", "Charges d'exploitation", chargesTotal, "eur", {
      sources: ["pilot_ca_entries (kind = charge)"],
      calcul:
        "Charges d'exploitation de l'exercice, hors investissements et hors rémunération dirigeant.",
      periode,
    }),
    benefice_brut: kpi(
      "benefice_brut",
      "Bénéfice brut",
      chargesComplete ? beneficeBrut : null,
      "eur",
      {
        sources: ["pilot_ca_entries"],
        calcul: "CA HT − charges d'exploitation de l'exercice.",
        periode,
        fiabilite: chargesComplete ? undefined : "Aucune charge enregistrée : bénéfice non calculable.",
      },
    ),
    marge: kpi("marge", "Marge brute", margePct, "pct", {
      sources: ["pilot_ca_entries"],
      calcul: "Bénéfice brut / CA HT.",
      periode,
    }),
    resultat_apres_investissements: kpi(
      "resultat_apres_investissements",
      "Résultat après investissements",
      chargesComplete ? beneficeBrut - investissements : null,
      "eur",
      {
        sources: ["pilot_ca_entries", "pilot_ca_entries.is_investment"],
        calcul: "Bénéfice brut − investissements qualifiés de l'exercice.",
        periode,
      },
    ),
    taux_horaire_vendu: kpi(
      "taux_horaire_vendu",
      "Taux horaire vendu",
      tauxHoraireVendu,
      "eur_heure",
      {
        sources: ["pilot_ca_entries"],
        calcul: "CA HT / heures vendues.",
        periode,
      },
    ),
    taux_horaire_reel: kpi(
      "taux_horaire_reel",
      "Taux horaire réel",
      tauxHoraireReel,
      "eur_heure",
      {
        sources: ["pilot_ca_entries", "pilot_ca_entries.hours (Vente → Temps)"],
        calcul: "CA HT / heures d'intervention (Vente → Temps).",
        periode,
        fiabilite: hoursRes.sourceLabel,
      },
      certifReasons,
    ),
    classement_clients: kpi(
      "classement_clients",
      "Classement clients",
      ranking.length,
      "nombre",
      {
        sources: ["pilot_ca_entries", "clients.entity_status", "ledger heures"],
        calcul:
          "Entités certifiées uniquement, triées par rentabilité (CA / heures réelles) via le moteur unique.",
        periode,
      },
      certifReasons,
    ),
    score_client: kpi("score_client", "Scores économiques", inputs.scores.length, "nombre", {
      sources: ["clients", "pilot_ca_entries", "interventions"],
      calcul: "Score économique calculé après certification du référentiel.",
      periode,
    }, certifReasons),
  };

  return {
    scope,
    certification,
    ca: {
      yearHt,
      yearAnalyticalHt: analyticalCa,
      prevYearHt,
      monthHt,
      ytdHt,
      prevYtdHt,
      progressionPct: prevYtdHt > 0 ? ((ytdHt - prevYtdHt) / prevYtdHt) * 100 : null,
      byMonth,
    },
    hours: {
      vendues: hoursRes.vendues,
      realisees: hoursRes.realisees,
      historiques: hoursRes.historiques,
      reelles: hoursRes.hours,
      source: hoursRes.source,
      sourceLabel: hoursRes.sourceLabel,
      byClient: hoursRes.byClient,
    },
    charges: {
      fixe: yearCharges?.fixe ?? 0,
      variable: yearCharges?.variable ?? 0,
      aClasser: yearCharges?.aClasser ?? 0,
      total: chargesTotal,
      investissements,
      remunerationNette: remu.net,
      remunerationCoutEmployeur: remu.employerCost || employerCost(remu.net),
      complete: chargesComplete,
      analysis,
      monthsObserved,
      mensuelles: chargesMensuelles,
      byMonth: chargesByMonth,
      weightPct: chargesWeightPct(analysis, salesTotal(inputs.salesByYear)),
      evolution: chargesEvolution(analysis),
      repartition: categoryBreakdown(analysis),
      priority: priorityCategories(analysis),
      priorityTrend: priorityTrend(analysis),
      projectionBase: projectionBase(inputs.chargeRows, year, inputs.salesByYear, { now }),
    },
    resultat: {
      beneficeBrut,
      margePct,
      resultatApresInvestissements: beneficeBrut - investissements,
    },
    outlook: {
      caHt: outlookCa,
      charges: outlookCharges,
      beneficeBrut: outlookBenefice,
      margePct: outlookCa > 0 ? (outlookBenefice / outlookCa) * 100 : 0,
      investissements,
      resultatApresInvestissements: outlookBenefice - investissements,
      projected: isProjection,
      explanation: isProjection
        ? projection.explanation
        : "Mode réel : uniquement le CA facturé et les charges constatées à date.",
    },
    rates: {
      tauxHoraireVendu,
      tauxHoraireReel,
      cible: inputs.settings.target_hourly_rate ?? 0,
      coutHoraireStructure,
      seuilMensuel: chargesMensuelles,
    },
    monthly: {
      rows: monthRows,
      totals: monthTotals,
      gestionDefaut,
      missingGestion: monthsMissingGestion(monthRows, year, now),
      finance: financeMonths,
      caSeries: monthlySeries(inputs.entries, year, { mode, now }),
    },
    tjm: {
      settings: inputs.tjmSettings,
      result: tjmResult,
      tauxCible: tjmResult ? Number(tjmResult.tauxHoraire.toFixed(1)) : null,
    },
    projection,
    families,
    familyConcentrationPct,
    prevYear: {
      caHt: prevYearCa,
      hoursConfirmed: prevHours,
      hourlyRate: ratedPrev.rate,
    },
    financeAlerts,
    clients: { all: allRows, ranking, excluded },
    sources: {
      chargeRows: inputs.chargeRows,
      chargeCategories: inputs.chargeCategories,
      entries: inputs.entries,
      settings: inputs.settings,
    },
    annual,
    kpis,
  };
}

// ---------------------------------------------------------------------------
// Point d'entrée unique côté interface
// ---------------------------------------------------------------------------

export const ANALYTICS_QUERY_ROOT = "pilot-analytics";

export function analyticsQueryOptions(scope: EngineScope) {
  return queryOptions({
    queryKey: [ANALYTICS_QUERY_ROOT, scope.year, scope.mode, scope.strict],
    queryFn: async () => buildAnalytics(await loadEngineInputs(scope)),
    staleTime: 30_000,
  });
}

/** Seule façon autorisée d'obtenir un indicateur dans un composant React. */
export function useAnalyticsSnapshot(scope: EngineScope) {
  return useQuery(analyticsQueryOptions(scope));
}

export function formatKpi(k: Kpi): string {
  if (k.value == null) {
    return k.status === "en_attente_certification" ? "En attente de certification" : "—";
  }
  switch (k.unit) {
    case "eur":
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(k.value);
    case "eur_heure":
      return `${k.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} €/h`;
    case "heures":
      return `${k.value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
    case "pct":
      return `${k.value.toFixed(1)} %`;
    default:
      return k.value.toLocaleString("fr-FR");
  }
}

// ---------------------------------------------------------------------------
// Sélecteurs — seule façon d'obtenir une valeur dérivée dans un écran.
// ---------------------------------------------------------------------------

export type { ClientView, ClientViewInput };

/** Consolidation d'une fiche client 360° (aucun calcul dans la page). */
export function clientView(input: ClientViewInput): ClientView {
  return buildClientView(input);
}

/** Total d'une carte d'heures par client (jamais recalculé dans un écran). */
export function sumHoursMap(map: Map<string, number> | undefined): number {
  let s = 0;
  for (const v of map?.values() ?? []) s += v;
  return s;
}
