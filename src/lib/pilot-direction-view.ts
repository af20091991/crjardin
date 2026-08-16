// ---------------------------------------------------------------------------
// Vue « Direction » — ASSEMBLAGE D'AFFICHAGE UNIQUEMENT.
//
// Ce module ne calcule AUCUN indicateur métier : il lit l'instantané déjà
// produit par le moteur analytique unique (`src/lib/pilot-engine.ts`), en
// reformate les valeurs pour l'écran (KPI, alertes courtes, décisions) et
// décrit les séries destinées au composant graphique partagé
// (`PilotFlexChart` / `pilot-flex-chart.ts`).
//
// Règles conservées telles quelles :
//  - le périmètre temporel (« à date » par défaut / exercice complet explicite)
//    est décidé en amont par `usePilotScope` puis appliqué par le moteur ;
//  - aucun KPI n'est présenté comme certifié si sa source ne l'est pas
//    (plafond appliqué par `pilot-kpi-reliability` puis relu ici).
// ---------------------------------------------------------------------------

import { formatKpi, type AnalyticsSnapshot, type Kpi, type KpiKey } from "@/lib/pilot-engine";
import type { FlexDataset } from "@/lib/pilot-flex-chart";
import type { KpiReadiness } from "@/lib/pilot-kpi-reliability";
import { PP_COLORS, PP_SERIES } from "@/lib/pilot-colors";

/** Nombre maximum d'éléments affichés dans chaque bloc de la page Direction. */
export const DIRECTION_MAX_KPIS = 6;
export const DIRECTION_MAX_ALERTS = 3;
export const DIRECTION_MAX_DECISIONS = 3;

export type DirectionTone = "positive" | "negative" | "neutral";

export interface DirectionKpi {
  key: KpiKey;
  label: string;
  /** Valeur déjà formatée par le moteur (`formatKpi`). */
  display: string;
  /** Unité lisible affichée sous la valeur. */
  unit: string;
  /** Période effectivement couverte par la valeur. */
  periodLabel: string;
  /** Variation lisible si elle existe réellement, sinon `null`. */
  variation: string | null;
  variationTone: DirectionTone;
  readiness: KpiReadiness;
  /** Explication courte affichée dès que le KPI n'est pas certifié. */
  explanation: string;
  /** Traçabilité (infobulle / détail dépliable). */
  audit: string;
  to?: string;
}

export interface DirectionAlert {
  id: string;
  tone: "danger" | "warn" | "info";
  text: string;
}

export interface DirectionDecision {
  id: string;
  text: string;
  to?: string;
}

const UNIT_LABEL: Record<Kpi["unit"], string> = {
  eur: "€ HT",
  eur_heure: "€/h",
  heures: "heures",
  pct: "%",
  nombre: "unités",
};

const KPI_ORDER: readonly { key: KpiKey; to?: string }[] = [
  { key: "ca_annuel", to: "/pilot/ca" },
  { key: "charges", to: "/pilot/charges" },
  { key: "benefice_brut", to: "/pilot/finance" },
  { key: "marge", to: "/pilot/finance" },
  { key: "heures_reelles", to: "/pilot/temps" },
  { key: "taux_horaire_reel", to: "/pilot/taux" },
];

export function periodLabel(period: string, year: number, now = new Date()): string {
  return period === "exercice_complet"
    ? `Exercice ${year} complet`
    : `Réalisé au ${now.toLocaleDateString("fr-FR")}`;
}

/** Variation N vs N-1 déjà produite par le moteur (jamais recalculée ici). */
function variationOf(
  key: KpiKey,
  snapshot: AnalyticsSnapshot,
): { text: string; tone: DirectionTone } | null {
  if (key === "ca_annuel") {
    const p = snapshot.ca.progressionPct;
    if (p == null || snapshot.ca.prevYtdHt <= 0) return null;
    return {
      text: `${p >= 0 ? "+" : ""}${p.toFixed(1)} % vs N-1`,
      tone: p >= 0 ? "positive" : "negative",
    };
  }
  if (key === "taux_horaire_reel") {
    const prev = snapshot.prevYear.hourlyRate;
    const cur = snapshot.rates.tauxHoraireReel;
    if (prev == null || prev <= 0 || cur == null || cur <= 0) return null;
    const p = ((cur - prev) / prev) * 100;
    return {
      text: `${p >= 0 ? "+" : ""}${p.toFixed(1)} % vs N-1`,
      tone: p >= 0 ? "positive" : "negative",
    };
  }
  return null;
}

export function buildDirectionKpis(input: {
  snapshot: AnalyticsSnapshot | null;
  /** Aptitude d'usage relue depuis `buildKpiReliability` (plafond de sources inclus). */
  readiness: Partial<Record<KpiKey, { readiness: KpiReadiness; explanation: string }>>;
  periodLabel: string;
}): DirectionKpi[] {
  const { snapshot, readiness } = input;
  if (!snapshot) return [];
  return KPI_ORDER.slice(0, DIRECTION_MAX_KPIS).map(({ key, to }) => {
    const kpi = snapshot.kpis[key];
    const r = readiness[key];
    // Un KPI non produit par le moteur ne peut jamais être « Certifié ».
    const resolved: KpiReadiness =
      kpi.value == null
        ? kpi.status === "en_attente_certification"
          ? "a_confirmer"
          : "non_exploitable"
        : (r?.readiness ?? "a_confirmer");
    const variation = kpi.value == null ? null : variationOf(key, snapshot);
    return {
      key,
      label: kpi.label,
      display: formatKpi(kpi),
      unit: UNIT_LABEL[kpi.unit],
      periodLabel: input.periodLabel,
      variation: variation?.text ?? null,
      variationTone: variation?.tone ?? "neutral",
      readiness: resolved,
      explanation:
        resolved === "certifie"
          ? ""
          : (kpi.reasons[0] ?? r?.explanation ?? "Fiabilité limitée par les sources."),
      audit: `${kpi.audit.sources.join(" · ")} — ${kpi.audit.calcul}`,
      to,
    };
  });
}

/** Trois alertes courtes maximum, uniquement issues d'états déjà calculés. */
export function buildDirectionAlerts(input: {
  snapshot: AnalyticsSnapshot | null;
  integrityMessage?: string | null;
  integrityDegraded?: boolean;
}): DirectionAlert[] {
  const out: DirectionAlert[] = [];
  const s = input.snapshot;
  if (input.integrityDegraded) {
    out.push({
      id: "integrite",
      tone: "warn",
      text: input.integrityMessage ?? "Contrôles de fiabilité des sources non passés.",
    });
  }
  for (const a of s?.financeAlerts ?? []) {
    out.push({ id: `finance-${out.length}`, tone: a.tone, text: a.text });
  }
  if (s && s.certification.unlinkedLines > 0) {
    out.push({
      id: "rattachement",
      tone: "warn",
      text: `${s.certification.unlinkedLines} ligne(s) de vente sans client identifié : rentabilité par client incomplète.`,
    });
  }
  if (s && s.charges.aClasser > 0) {
    out.push({
      id: "charges-a-classer",
      tone: "info",
      text: `Charges à classer : ${eur(s.charges.aClasser)} non ventilées entre fixe et variable.`,
    });
  }
  return out.slice(0, DIRECTION_MAX_ALERTS);
}

/** Trois décisions courtes maximum, adossées aux seules valeurs du moteur. */
export function buildDirectionDecisions(snapshot: AnalyticsSnapshot | null): DirectionDecision[] {
  if (!snapshot) return [];
  const out: DirectionDecision[] = [];
  const { rates, resultat, certification, charges } = snapshot;
  if (rates.cible > 0 && rates.tauxHoraireReel != null && rates.tauxHoraireReel < rates.cible) {
    out.push({
      id: "taux",
      text: `Taux horaire sous la cible (${eur(rates.cible - rates.tauxHoraireReel)}/h d'écart) : revoir les prix ou le temps passé.`,
      to: "/pilot/taux",
    });
  }
  if (resultat.margePct != null && resultat.margePct < 0) {
    out.push({
      id: "marge",
      text: "Marge négative sur la période : arbitrer les charges d'exploitation.",
      to: "/pilot/charges",
    });
  }
  if (certification.caCoveragePct != null && certification.caCoveragePct < 100) {
    out.push({
      id: "certification",
      text: `Certifier le référentiel client : ${certification.caCoveragePct.toFixed(0)} % du CA seulement est exploitable analytiquement.`,
      to: "/pilot/controle",
    });
  }
  if (charges.aClasser > 0) {
    out.push({
      id: "classer",
      text: "Classer les charges en attente pour fiabiliser la marge.",
      to: "/pilot/charges",
    });
  }
  if (out.length === 0 && snapshot.ca.yearHt > 0) {
    out.push({
      id: "ok",
      text: "Aucun écart bloquant détecté sur la période : poursuivre le suivi mensuel.",
      to: "/pilot/ca",
    });
  }
  return out.slice(0, DIRECTION_MAX_DECISIONS);
}

function eur(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Séries du tableau de pilotage. Chaque ligne reprend une valeur déjà publiée
 * par l'instantané (aucune agrégation refaite).
 */
export function buildDirectionDatasets(
  snapshot: AnalyticsSnapshot | null,
  periodNote: string,
): FlexDataset[] {
  if (!snapshot) return [];
  const year = snapshot.scope.year;
  const finance = snapshot.monthly.finance;
  const months = snapshot.monthly.rows;
  const kept = finance
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => f.CA !== 0 || f.Charges !== 0 || (months[i]?.temps_terrain ?? 0) !== 0);
  const note = (base: string) => `${base} ${periodNote}`;

  const monthly = (
    id: string,
    label: string,
    unit: FlexDataset["unit"],
    series: FlexDataset["series"],
    pick: (i: number) => Record<string, number>,
    source: string,
  ): FlexDataset => ({
    id,
    label,
    unit,
    categoryLabel: "Mois",
    series,
    rows: kept.map(({ f, i }) => ({ name: f.mois, ...pick(i) })),
    note: note(source),
  });

  const out: FlexDataset[] = [
    monthly(
      "ca-charges",
      "CA et charges",
      "euro",
      [
        { key: "ca", label: "CA HT", color: PP_COLORS.primary },
        { key: "charges", label: "Charges", color: PP_COLORS.charges },
      ],
      (i) => ({ ca: finance[i].CA, charges: finance[i].Charges }),
      "Série financière mensuelle du moteur analytique (CA HT des ventes, charges d'exploitation).",
    ),
    monthly(
      "ca",
      "CA réalisé",
      "euro",
      [{ key: "ca", label: "CA HT", color: PP_COLORS.primary }],
      (i) => ({ ca: finance[i].CA }),
      "CA HT des lignes de vente enregistrées (Chiffre d'affaires → Ventes).",
    ),
    monthly(
      "charges",
      "Charges d'exploitation",
      "euro",
      [{ key: "charges", label: "Charges", color: PP_COLORS.charges }],
      (i) => ({ charges: finance[i].Charges }),
      "Charges d'exploitation enregistrées (investissements et rémunération dirigeant exclus).",
    ),
    monthly(
      "resultat",
      "Résultat mensuel (CA − charges)",
      "euro",
      [{ key: "benefice", label: "Bénéfice", color: PP_COLORS.sales }],
      (i) => ({ benefice: finance[i]["Bénéfice"] }),
      "Bénéfice mensuel publié par le moteur (CA HT − charges d'exploitation).",
    ),
    monthly(
      "marge",
      "Marge mensuelle",
      "pourcent",
      [{ key: "marge", label: "Marge", color: PP_COLORS.mid }],
      (i) => ({ marge: finance[i].CA > 0 ? (finance[i]["Bénéfice"] / finance[i].CA) * 100 : 0 }),
      "Lecture en pourcentage du bénéfice mensuel déjà publié rapporté au CA du même mois.",
    ),
    monthly(
      "heures",
      "Heures d'intervention",
      "heure",
      [{ key: "heures", label: "Heures", color: PP_COLORS.business }],
      (i) => ({ heures: months[i]?.temps_terrain ?? 0 }),
      "Source unique des heures : colonne Vente → Temps des lignes de vente.",
    ),
    monthly(
      "taux",
      "Taux horaire mensuel",
      "euro",
      [{ key: "taux", label: "Taux horaire", color: PP_COLORS.special }],
      (i) => ({ taux: months[i]?.brut ?? 0 }),
      "Taux horaire mensuel du référentiel temps (CA du mois ÷ temps Vente → Temps).",
    ),
    {
      id: "compare",
      label: `Comparaison ${year} / ${year - 1}`,
      unit: "euro",
      categoryLabel: "Mois",
      series: [
        { key: "n", label: `CA ${year}`, color: PP_COLORS.primary },
        { key: "n1", label: `CA ${year - 1}`, color: PP_COLORS.neutral },
      ],
      rows: snapshot.monthly.caSeries.map((m) => ({ name: m.month, n: m.current, n1: m.previous })),
      note: note("CA HT mois par mois sur les deux exercices, à date équivalente."),
    },
  ];

  const familles = snapshot.families.filter((f) => f.value > 0);
  if (familles.length > 0) {
    out.push({
      id: "familles",
      label: "Répartition du CA par activité",
      unit: "euro",
      categoryLabel: "Activité",
      series: [{ key: "ca", label: "CA HT", color: PP_COLORS.primary }],
      rows: familles.map((f) => ({ name: f.label, ca: f.value })),
      note: note("Mix d'activité publié par le moteur (familles des lignes de vente)."),
    });
  }

  const exercices = snapshot.annual.filter((a) => a.caHt !== 0 || a.charges !== 0);
  if (exercices.length > 0) {
    out.push({
      id: "exercices",
      label: "CA, charges et bénéfice par exercice",
      unit: "euro",
      categoryLabel: "Exercice",
      series: [
        { key: "ca", label: "CA HT", color: PP_COLORS.primary },
        { key: "charges", label: "Charges", color: PP_COLORS.charges },
        { key: "benefice", label: "Bénéfice brut", color: PP_COLORS.sales },
      ],
      rows: [...exercices]
        .sort((a, b) => a.year - b.year)
        .map((a) => ({
          name: String(a.year),
          ca: a.caHt,
          charges: a.charges,
          benefice: a.beneficeBrut,
        })),
      note: note("Synthèse annuelle du moteur (`annualSummary`)."),
    });
  }

  // Objectif vs réalisé : uniquement si une cible existe réellement.
  if (snapshot.rates.cible > 0 && snapshot.rates.tauxHoraireVendu != null) {
    out.push({
      id: "objectif",
      label: "Objectif vs réalisé — taux horaire",
      unit: "euro",
      categoryLabel: "Indicateur",
      series: [
        { key: "realise", label: "Réalisé", color: PP_SERIES[0] },
        { key: "cible", label: "Cible", color: PP_SERIES[1] },
      ],
      rows: [
        {
          name: "Taux horaire (€/h)",
          realise: snapshot.rates.tauxHoraireVendu,
          cible: snapshot.rates.cible,
        },
      ],
      note: note("Taux horaire Vente → Temps comparé à la cible enregistrée dans les paramètres."),
    });
  }

  return out;
}
