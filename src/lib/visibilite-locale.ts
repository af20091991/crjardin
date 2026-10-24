/**
 * Radar Visibilité locale — moteur de score prestation × commune (phase 1).
 * Fonctions pures : aucune donnée n'est écrite, tout est recalculé depuis la Search Console et les ventes PP.
 * Cadre : cahier des charges du 23/10/2026 (zone 15 min depuis Vendargues, pondérations validées).
 */

export const PRESTATIONS_SCORED = ["AP", "Conseil", "Remise en état", "SAP"] as const;
export type ScoredPrestation = (typeof PRESTATIONS_SCORED)[number];

/** Prestations promues par défaut : visite conseil et création de jardin (AP). L'entretien (SAP/CEEV) n'est pas promu. */
export const DEFAULT_PROMOTED: ScoredPrestation[] = ["AP", "Conseil"];

export const PRESTATION_LABEL: Record<ScoredPrestation, string> = {
  AP: "Création / aménagement (AP)",
  Conseil: "Visite conseil",
  "Remise en état": "Remise en état",
  SAP: "Entretien (SAP / CEEV)",
};

export interface TargetCommune {
  name: string;
  /** Formes à reconnaître dans une requête (sans accent, sans tiret). */
  aliases: string[];
}

export const TARGET_COMMUNES: TargetCommune[] = [
  { name: "Saint-Aunès", aliases: ["saint aunes", "st aunes"] },
  { name: "Castries", aliases: ["castries"] },
  { name: "Vendargues", aliases: ["vendargues"] },
  { name: "Baillargues", aliases: ["baillargues"] },
  { name: "Jacou", aliases: ["jacou"] },
  { name: "Clapiers", aliases: ["clapiers"] },
  { name: "Castelnau-le-Lez", aliases: ["castelnau le lez", "castelnau"] },
  { name: "Le Crès", aliases: ["le cres", "cres"] },
];

/** Communes exclues (« à l'ouest de Montpellier » au cahier des charges, liste à valider) : toute requête qui les cite est ignorée. */
export const EXCLUDED_ALIASES = [
  "saint jean de vedas",
  "st jean de vedas",
  "juvignac",
  "laverune",
  "grabels",
  "pignan",
  "fabregues",
  "saint georges d orques",
];

/** Zone de chalandise : temps de trajet maximum depuis Vendargues. */
export const MAX_TRAVEL_MINUTES = 15;

export const WEIGHTS = {
  demande: 0.3,
  marge: 0.3,
  progression: 0.2,
  proximite: 0.1,
  saisonnalite: 0.1,
} as const;

export type CriterionKey = keyof typeof WEIGHTS;

export const CRITERION_LABEL: Record<CriterionKey, string> = {
  demande: "Demande",
  marge: "Marge par heure",
  progression: "Marge de progression",
  proximite: "Proximité",
  saisonnalite: "Saisonnalité",
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasWord(text: string, alias: string): boolean {
  return new RegExp(`(^| )${alias}( |$)`).test(text);
}

export function detectCommune(query: string): TargetCommune | null {
  const text = normalizeText(query);
  if (EXCLUDED_ALIASES.some((alias) => hasWord(text, alias))) return null;
  // Alias les plus longs d'abord : « castelnau le lez » avant « castelnau ».
  let best: { commune: TargetCommune; length: number } | null = null;
  for (const commune of TARGET_COMMUNES) {
    for (const alias of commune.aliases) {
      if (hasWord(text, alias) && (!best || alias.length > best.length)) {
        best = { commune, length: alias.length };
      }
    }
  }
  return best?.commune ?? null;
}

const RULES: Array<{ prestation: ScoredPrestation; pattern: RegExp }> = [
  {
    prestation: "Remise en état",
    pattern: /remise en etat|debroussaill|defrichage|jardin abandonne/,
  },
  { prestation: "Conseil", pattern: /conseil|diagnostic|visite|audit|accompagnement|expertise/ },
  {
    prestation: "AP",
    pattern:
      /creation|amenagement|paysagiste|paysager|mediterraneen|plantation|terrasse|cloture|gazon|arrosage|paillage|conception|concepteur|allee|bassin|muret|massif|rocaille|xeriscape|jardin sec|paysage/,
  },
  {
    prestation: "SAP",
    pattern: /tonte|taille|haie|elagage|entretien|jardinier|desherbage|pelouse|tondeuse/,
  },
];

export function detectPrestation(query: string): ScoredPrestation | null {
  const text = normalizeText(query);
  for (const rule of RULES) if (rule.pattern.test(text)) return rule.prestation;
  return null;
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface Opportunity {
  key: string;
  prestation: ScoredPrestation;
  commune: string;
  impressions: number;
  clicks: number;
  /** Position moyenne pondérée par les impressions. */
  position: number;
  topQueries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
  /** Clics supplémentaires estimés si le site atteignait la position 3 (estimation). */
  potentialClicks: number;
}

export function groupQueries(rows: QueryRow[]): {
  opportunities: Opportunity[];
  unattached: number;
  ignoredExcluded: number;
} {
  const groups = new Map<
    string,
    { prestation: ScoredPrestation; commune: string; rows: QueryRow[] }
  >();
  let unattached = 0;
  let ignoredExcluded = 0;
  for (const row of rows) {
    if (!row.query || row.impressions <= 0) continue;
    const text = normalizeText(row.query);
    const commune = detectCommune(row.query);
    if (!commune) {
      if (EXCLUDED_ALIASES.some((alias) => hasWord(text, alias))) ignoredExcluded += 1;
      continue;
    }
    const prestation = detectPrestation(row.query);
    if (!prestation) {
      unattached += 1;
      continue;
    }
    const key = `${prestation}|${commune.name}`;
    const group = groups.get(key) ?? { prestation, commune: commune.name, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  const opportunities: Opportunity[] = [];
  for (const [key, group] of groups) {
    const impressions = group.rows.reduce((s, r) => s + r.impressions, 0);
    const clicks = group.rows.reduce((s, r) => s + r.clicks, 0);
    const position =
      group.rows.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(1, impressions);
    const topQueries = [...group.rows]
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5)
      .map((r) => ({
        query: r.query,
        impressions: r.impressions,
        clicks: r.clicks,
        position: r.position,
      }));
    opportunities.push({
      key,
      prestation: group.prestation,
      commune: group.commune,
      impressions,
      clicks,
      position,
      topQueries,
      potentialClicks: potentialExtraClicks(impressions, clicks, position),
    });
  }
  return { opportunities, unattached, ignoredExcluded };
}

/** Courbe de clic moyenne par position Google (ordre de grandeur, utilisée pour une estimation seulement). */
export function ctrAtPosition(position: number): number {
  if (position <= 1) return 0.27;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 4) return 0.08;
  if (position <= 5) return 0.06;
  if (position <= 10) return 0.03;
  return 0.01;
}

export function potentialExtraClicks(
  impressions: number,
  clicks: number,
  position: number,
): number {
  if (position <= 3) return 0;
  return Math.max(0, Math.round(impressions * ctrAtPosition(3) - clicks));
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** 0–100 : plus la position est en bas de la page 1 / sur la page 2, plus la marge de progression est grande. */
export function progressionScore(position: number | null): number {
  if (position == null) return 40;
  if (position <= 3) return 15;
  if (position <= 10) return 60 + ((position - 3) / 7) * 40;
  if (position <= 20) return 100 - ((position - 10) / 10) * 40;
  if (position <= 40) return 60 - ((position - 20) / 20) * 50;
  return 5;
}

export function proximityScore(minutes: number | null): number {
  if (minutes == null) return 60;
  return clamp(100 * (1 - minutes / MAX_TRAVEL_MINUTES), 10, 100);
}

export interface MonthlyCa {
  [prestation: string]: number[];
}

export function monthlyCaByPrestation(
  rows: Array<{ date: string; amount: number; prestation: string }>,
): MonthlyCa {
  const out: MonthlyCa = {};
  for (const row of rows) {
    const month = Number(row.date.slice(5, 7));
    if (!(month >= 1 && month <= 12) || !Number.isFinite(row.amount)) continue;
    const bucket = (out[row.prestation] ??= Array.from({ length: 12 }, () => 0));
    bucket[month - 1] = (bucket[month - 1] ?? 0) + row.amount;
  }
  return out;
}

/** Mois (1–12) couverts par les 6 semaines à venir. */
export function monthsAhead(today: Date, days = 42): number[] {
  const months = new Set<number>();
  for (let d = 0; d <= days; d += 7) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
    months.add(date.getMonth() + 1);
  }
  return [...months];
}

/** 0–100 ; 50 = mois moyen. Renvoie `null` si l'historique est trop court pour parler de saisonnalité. */
export function seasonalityScore(monthly: number[] | undefined, window: number[]): number | null {
  if (!monthly) return null;
  const active = monthly.filter((v) => v > 0).length;
  const total = monthly.reduce((s, v) => s + v, 0);
  if (active < 6 || total <= 0) return null;
  const mean = total / 12;
  const ahead = window.reduce((s, m) => s + (monthly[m - 1] ?? 0), 0) / Math.max(1, window.length);
  return clamp((ahead / mean) * 50);
}

export interface ScoredOpportunity extends Opportunity {
  travelMinutes: number | null;
  hourlyRate: number | null;
  criteria: Record<CriterionKey, number>;
  /** Critères remplacés par une valeur neutre faute de données. */
  neutral: CriterionKey[];
  score: number;
  promoted: boolean;
  outOfZone: boolean;
}

export function scoreOpportunities(params: {
  opportunities: Opportunity[];
  hourlyRates: Record<string, number | null | undefined>;
  travelMinutes: Record<string, number | null | undefined>;
  monthly: MonthlyCa;
  promoted: ScoredPrestation[];
  today?: Date;
}): ScoredOpportunity[] {
  const { opportunities, hourlyRates, travelMinutes, monthly, promoted } = params;
  const window = monthsAhead(params.today ?? new Date());
  const maxImp = Math.max(1, ...opportunities.map((o) => o.impressions));
  const rates = Object.values(hourlyRates).filter(
    (r): r is number => typeof r === "number" && r > 0,
  );
  const maxRate = rates.length > 0 ? Math.max(...rates) : 0;

  return opportunities
    .map((o) => {
      const neutral: CriterionKey[] = [];
      const rate = hourlyRates[o.prestation] ?? null;
      const minutes = travelMinutes[o.commune] ?? null;
      const season = seasonalityScore(monthly[o.prestation], window);
      if (!rate || maxRate <= 0) neutral.push("marge");
      if (minutes == null) neutral.push("proximite");
      if (season == null) neutral.push("saisonnalite");
      const criteria: Record<CriterionKey, number> = {
        demande: (100 * Math.log1p(o.impressions)) / Math.log1p(maxImp),
        marge: rate && maxRate > 0 ? (rate / maxRate) * 100 : 40,
        progression: progressionScore(o.position),
        proximite: proximityScore(minutes),
        saisonnalite: season ?? 50,
      };
      const score = (Object.keys(WEIGHTS) as CriterionKey[]).reduce(
        (sum, key) => sum + criteria[key] * WEIGHTS[key],
        0,
      );
      return {
        ...o,
        travelMinutes: minutes,
        hourlyRate: rate,
        criteria,
        neutral,
        score: Math.round(score * 10) / 10,
        promoted: promoted.includes(o.prestation),
        outOfZone: minutes != null && minutes > MAX_TRAVEL_MINUTES,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Combinaisons promues × communes sans aucune impression : candidates à une page (phase 2). */
export function visibilityGaps(
  opportunities: Opportunity[],
  promoted: ScoredPrestation[],
): Array<{ prestation: ScoredPrestation; commune: string }> {
  const seen = new Set(opportunities.map((o) => o.key));
  const gaps: Array<{ prestation: ScoredPrestation; commune: string }> = [];
  for (const prestation of promoted) {
    for (const commune of TARGET_COMMUNES) {
      if (!seen.has(`${prestation}|${commune.name}`))
        gaps.push({ prestation, commune: commune.name });
    }
  }
  return gaps;
}
