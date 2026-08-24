// Couche de PRÉSENTATION des cartes Pilot Pro (aucun calcul métier ici).
// Elle ne transforme que du texte déjà produit par les moteurs : format
// d'affichage des nombres, libellés courts, voyants dérivés des tons existants.
// La valeur stockée ou calculée n'est jamais modifiée.

export type EuroFormat = "normal" | "compact";
export type HoursFormat = "decimal" | "integer";
export type PercentFormat = "decimal" | "integer";

export type ValueFormatOptions = {
  euro: EuroFormat;
  hours: HoursFormat;
  percent: PercentFormat;
};

export const DEFAULT_VALUE_FORMAT: ValueFormatOptions = {
  euro: "normal",
  hours: "decimal",
  percent: "decimal",
};

/** Espaces fines / insécables utilisées par Intl.NumberFormat("fr-FR"). */
const SPACES = "\\s\u00a0\u202f";
const NUM = `-?\\d[\\d${SPACES}]*(?:[.,]\\d+)?`;

function parseFrNumber(raw: string): number {
  const cleaned = raw.replace(new RegExp(`[${SPACES}]`, "g"), "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function frNumber(n: number, digits: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** 80 400 € → 80,4 k€ ; 1 250 000 € → 1,3 M€ ; en dessous de 1 000 : inchangé. */
export function compactEuro(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${frNumber(value / 1_000_000, 1).replace(",0", "")} M€`;
  if (abs >= 1_000) return `${frNumber(value / 1_000, 1).replace(",0", "")} k€`;
  return `${frNumber(value, 0)} €`;
}

/**
 * Réécrit uniquement l'affichage des montants, heures et pourcentages d'un texte.
 * Toute chaîne non reconnue est renvoyée telle quelle.
 */
export function formatValueText(text: string, opts: ValueFormatOptions): string {
  let out = text;
  if (opts.euro === "compact") {
    out = out.replace(new RegExp(`(${NUM})[${SPACES}]*€`, "g"), (m, raw: string) => {
      const n = parseFrNumber(raw);
      return Number.isNaN(n) ? m : compactEuro(n);
    });
  }
  if (opts.hours === "integer") {
    out = out.replace(new RegExp(`(${NUM})[${SPACES}]*h(?![a-zA-Zéè])`, "g"), (m, raw: string) => {
      const n = parseFrNumber(raw);
      return Number.isNaN(n) ? m : `${frNumber(Math.round(n), 0)} h`;
    });
  }
  if (opts.percent === "integer") {
    out = out.replace(new RegExp(`(${NUM})[${SPACES}]*%`, "g"), (m, raw: string) => {
      const n = parseFrNumber(raw);
      return Number.isNaN(n) ? m : `${frNumber(Math.round(n), 0)} %`;
    });
  }
  return out;
}

/**
 * Libellés courts : dictionnaire fermé, uniquement des raccourcis sans ambiguïté.
 * Un libellé absent de cette table reste affiché en entier.
 */
const SHORT_LABELS: Record<string, string> = {
  "chiffre d'affaires réalisé": "CA réalisé",
  "chiffre d'affaires": "CA",
  "ca réalisé du mois": "CA du mois",
  "interventions réalisées": "Interventions",
  "heures d'intervention": "Heures",
  "taux horaire réel": "Taux horaire",
  "taux horaire moyen": "Taux horaire moyen",
  "bénéfice net": "Bénéfice",
  "charges d'exploitation": "Charges",
  "charges variables": "Charges var.",
  "clients à relancer": "À relancer",
  "marge d'exploitation": "Marge",
  "résultat d'exploitation": "Résultat",
};

/** Préfixes conservés tels quels (« CA cumulé 2026 » → « CA 2026 »). */
const SHORT_PREFIX: { pattern: RegExp; replace: string }[] = [
  { pattern: /^chiffre d'affaires cumulé/i, replace: "CA" },
  { pattern: /^ca cumulé/i, replace: "CA" },
  { pattern: /^interventions réalisées/i, replace: "Interventions" },
];

export function shortLabel(label: string): string {
  const direct = SHORT_LABELS[label.trim().toLowerCase()];
  if (direct) return direct;
  for (const rule of SHORT_PREFIX) {
    if (rule.pattern.test(label)) return label.replace(rule.pattern, rule.replace);
  }
  return label;
}

/* ---------- Voyants : dérivés des tons déjà calculés, sans nouveau seuil ---------- */

export type CardSignal = "ok" | "correct" | "watch" | "high" | "low" | "neutral";

export const CARD_SIGNAL_META: Record<CardSignal, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-[var(--pp-good,theme(colors.emerald.500))]" },
  correct: { label: "Correct", className: "bg-emerald-400" },
  watch: { label: "À surveiller", className: "bg-amber-500" },
  high: { label: "Trop haut", className: "bg-rose-500" },
  low: { label: "Trop bas", className: "bg-rose-400" },
  neutral: { label: "Données insuffisantes", className: "bg-muted-foreground/40" },
};

/**
 * Un voyant n'est affiché que si un ton interprétatif existe déjà sur la carte
 * (ton issu d'un seuil Pilot Pro). Sinon : aucun voyant.
 */
export function signalFromTone(
  tone: "default" | "positive" | "negative" | "warning",
): CardSignal | null {
  if (tone === "positive") return "ok";
  if (tone === "warning") return "watch";
  if (tone === "negative") return "low";
  return null;
}
