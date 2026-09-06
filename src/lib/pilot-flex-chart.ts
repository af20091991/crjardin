// ---------------------------------------------------------------------------
// Modèle de données commun aux graphiques flexibles de Pilot Pro.
// AUCUN CALCUL MÉTIER ICI : les séries sont produites par les moteurs
// officiels (pilot-engine, pilot-charges, pilot-annual, computeKpis…) puis
// simplement décrites pour l'affichage. Ce module ne fait que décider quels
// types de visualisation sont honnêtes pour une série donnée.
// ---------------------------------------------------------------------------

export type FlexUnit = "euro" | "heure" | "pourcent" | "nombre";

export interface FlexSeries {
  key: string;
  label: string;
  color: string;
}

export interface FlexDataset {
  id: string;
  label: string;
  unit: FlexUnit;
  /** Libellé de l'axe des catégories (mois, client, famille…). */
  categoryLabel: string;
  series: FlexSeries[];
  /** Lignes déjà calculées : `name` + une clé par série. */
  rows: Array<Record<string, string | number>>;
  /** Origine des chiffres, affichée sous le graphique. */
  note: string;
}

export type FlexChartType =
  | "barres"
  | "barres_h"
  | "barres_groupees"
  | "barres_empilees"
  | "barres_100"
  | "courbe"
  | "aire"
  | "aire_empilee"
  | "combo"
  | "radar"
  | "donut"
  | "camembert"
  | "treemap"
  | "funnel"
  | "nuage"
  | "bulles"
  | "heatmap"
  | "waterfall"
  | "pareto"
  | "kpi";

export const FLEX_CHART_TYPES: { type: FlexChartType; label: string }[] = [
  { type: "barres", label: "Barres verticales" },
  { type: "barres_h", label: "Barres horizontales" },
  { type: "barres_groupees", label: "Barres groupées" },
  { type: "barres_empilees", label: "Barres empilées" },
  { type: "barres_100", label: "Barres empilées à 100 %" },
  { type: "courbe", label: "Courbe" },
  { type: "aire", label: "Aire" },
  { type: "aire_empilee", label: "Aire empilée" },
  { type: "combo", label: "Barres + courbe" },
  { type: "radar", label: "Radar" },
  { type: "donut", label: "Donut" },
  { type: "camembert", label: "Camembert" },
  { type: "treemap", label: "Treemap" },
  { type: "funnel", label: "Entonnoir" },
  { type: "nuage", label: "Nuage de points" },
  { type: "bulles", label: "Bulles" },
  { type: "heatmap", label: "Heatmap" },
  { type: "waterfall", label: "Waterfall" },
  { type: "pareto", label: "Pareto" },
  { type: "kpi", label: "Cartes KPI comparatives" },
];

export const FLEX_CHART_LABELS = Object.fromEntries(
  FLEX_CHART_TYPES.map((t) => [t.type, t.label]),
) as Record<FlexChartType, string>;

/** Valeurs numériques d'une série. */
function values(d: FlexDataset, key: string): number[] {
  return d.rows.map((r) => Number(r[key]) || 0);
}

function hasNegative(d: FlexDataset): boolean {
  return d.series.some((s) => values(d, s.key).some((v) => v < 0));
}

/**
 * Compatibilité honnête d'un type de graphique avec une série de données.
 * Un type incompatible est désactivé et accompagné d'une explication courte —
 * jamais affiché avec des chiffres trompeurs.
 */
export function flexCompatibility(
  d: FlexDataset,
  type: FlexChartType,
): { ok: true } | { ok: false; reason: string } {
  const n = d.rows.length;
  const s = d.series.length;
  const neg = hasNegative(d);
  const multi = "Nécessite au moins deux indicateurs comparables.";
  const single = "Nécessite un seul indicateur.";
  const negative = "Impossible avec des valeurs négatives : la part de chaque élément n'aurait aucun sens.";

  if (n === 0) return { ok: false, reason: "Aucune donnée à représenter." };

  switch (type) {
    case "barres":
    case "barres_h":
    case "courbe":
    case "aire":
    case "kpi":
      return { ok: true };
    case "barres_groupees":
    case "barres_empilees":
    case "aire_empilee":
    case "combo":
    case "heatmap":
      return s >= 2 ? { ok: true } : { ok: false, reason: multi };
    case "barres_100":
      if (s < 2) return { ok: false, reason: multi };
      return neg ? { ok: false, reason: negative } : { ok: true };
    case "nuage":
    case "bulles":
      return s >= 2 ? { ok: true } : { ok: false, reason: "Nécessite deux indicateurs à croiser." };
    case "radar":
      if (n < 3) return { ok: false, reason: "Nécessite au moins trois catégories." };
      return neg ? { ok: false, reason: "Impossible avec des valeurs négatives." } : { ok: true };
    case "donut":
    case "camembert":
    case "treemap":
    case "funnel":
    case "pareto":
      if (s !== 1) return { ok: false, reason: single };
      if (neg) return { ok: false, reason: negative };
      return values(d, d.series[0].key).some((v) => v > 0)
        ? { ok: true }
        : { ok: false, reason: "Toutes les valeurs sont nulles." };
    case "waterfall":
      return s === 1 ? { ok: true } : { ok: false, reason: single };
  }
}

/** Premier type compatible, en partant du type demandé. */
export function resolveFlexType(d: FlexDataset, wanted: FlexChartType): FlexChartType {
  if (flexCompatibility(d, wanted).ok) return wanted;
  const fallback = FLEX_CHART_TYPES.find((t) => flexCompatibility(d, t.type).ok);
  return fallback ? fallback.type : "kpi";
}

/** Formatage français d'une valeur selon l'unité de la série. */
export function formatFlexValue(v: number, unit: FlexUnit): string {
  if (!Number.isFinite(v)) return "—";
  switch (unit) {
    case "euro":
      return `${Math.round(v).toLocaleString("fr-FR")} €`;
    case "heure":
      return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
    case "pourcent":
      return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
    default:
      return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  }
}

/** Abrégé pour les axes (1 250 000 € → 1,25 M€). */
export function formatFlexAxis(v: number, unit: FlexUnit): string {
  if (unit === "pourcent") return `${Math.round(v)} %`;
  if (unit === "heure") return `${Math.round(v)} h`;
  const abs = Math.abs(v);
  const suffix = unit === "euro" ? " €" : "";
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M${suffix}`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k${suffix}`;
  return `${Math.round(v).toLocaleString("fr-FR")}${suffix}`;
}
