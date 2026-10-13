/**
 * Calculs purs de l'onglet Statistiques du module Site web (source : Google Analytics 4).
 * Aucune valeur par défaut inventée : une donnée absente reste `null`.
 */
export type GaRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};
export type GaReport = { rows?: GaRow[] } | null | undefined;
export type GaProperty = { name: string; displayName?: string };

export type AudienceTotals = {
  users: number;
  pageViews: number;
  engagedSessions: number;
  engagementRate: number;
};

const toNumber = (value?: string): number | null => {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Totaux GA4 ; `null` si le rapport est absent ou ne contient aucune ligne exploitable. */
export function parseTotals(report: GaReport): AudienceTotals | null {
  const metrics = report?.rows?.[0]?.metricValues;
  if (!metrics) return null;
  const [users, pageViews, engagedSessions, engagementRate] = metrics.map((m) => toNumber(m.value));
  if (users == null || pageViews == null || engagedSessions == null || engagementRate == null) {
    return null;
  }
  return { users, pageViews, engagedSessions, engagementRate };
}

/** Pages les plus consultées (tri par pages vues décroissantes). */
export function parseTopPages(report: GaReport, limit = 8) {
  return (report?.rows ?? [])
    .map((row) => ({
      path: row.dimensionValues?.[0]?.value || "(page non renseignée)",
      pageViews: toNumber(row.metricValues?.[0]?.value) ?? 0,
      users: toNumber(row.metricValues?.[1]?.value) ?? 0,
    }))
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, limit);
}

/** Évolution relative ; `null` si la période précédente est absente ou nulle (comparaison non pertinente). */
export function relativeChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return (current - previous) / previous;
}

export function formatChange(change: number | null): string | null {
  if (change == null) return null;
  const pct = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(change);
  return `${pct} vs 30 jours précédents`;
}

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 30 derniers jours complets et les 30 jours qui les précèdent. */
export function statisticsPeriods(now: Date = new Date()) {
  const day = 86_400_000;
  const end = new Date(now.getTime() - day);
  const start = new Date(end.getTime() - 29 * day);
  const previousEnd = new Date(start.getTime() - day);
  const previousStart = new Date(previousEnd.getTime() - 29 * day);
  return {
    current: { startDate: isoDate(start), endDate: isoDate(end) },
    previous: { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) },
  };
}

/**
 * Choix de la propriété GA4 : la propriété mémorisée si elle est accessible, sinon la seule
 * propriété disponible. Avec plusieurs propriétés et aucun choix, `null` (l'utilisateur choisit).
 */
export function pickProperty(properties: GaProperty[], savedId: string | null): GaProperty | null {
  const normalize = (name: string) => name.replace(/^properties\//, "");
  if (savedId) {
    const saved = properties.find((p) => normalize(p.name) === savedId);
    if (saved) return saved;
  }
  return properties.length === 1 ? properties[0] : null;
}
