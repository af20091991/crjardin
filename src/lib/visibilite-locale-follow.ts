/** Radar Visibilité locale, phase 3 : fonctions pures de suivi (alertes, mesure avant/après, rapport). */

export const STRONG_SCORE = 70;
export const MEASURE_DAYS = 28;
export const MEASURE_DAYS_LONG = 56;

export interface SnapshotOpportunity {
  key: string;
  prestation: string;
  commune: string;
  score: number;
  impressions: number;
  clicks: number;
  position: number;
}

export interface Snapshot {
  taken_on: string;
  opportunities: SnapshotOpportunity[];
}

export const DAY_MS = 24 * 3600 * 1000;

const dayOf = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime();

/** Opportunités fortes jamais signalées. */
export function newStrongOpportunities(
  current: SnapshotOpportunity[],
  alertedKeys: Set<string>,
  threshold = STRONG_SCORE,
): SnapshotOpportunity[] {
  return current.filter((o) => o.score >= threshold && !alertedKeys.has(o.key));
}

export interface Effect {
  status: "attente" | "mesure";
  /** Date à laquelle la mesure sera disponible. */
  availableOn: string;
  before?: SnapshotOpportunity;
  after?: SnapshotOpportunity;
  deltaClicks?: number;
  deltaImpressions?: number;
  deltaPosition?: number;
}

/**
 * Compare le dernier instantané antérieur à la création de la page et le premier
 * instantané postérieur de `days` jours. Indicatif : Search Console est lue sur 90 jours glissants.
 */
export function measureEffect(
  snapshots: Snapshot[],
  key: string,
  createdAt: string,
  days = MEASURE_DAYS,
): Effect {
  const created = dayOf(createdAt);
  const availableOn = new Date(created + days * DAY_MS).toISOString().slice(0, 10);
  const sorted = [...snapshots].sort((a, b) => a.taken_on.localeCompare(b.taken_on));
  const find = (s?: Snapshot) => s?.opportunities.find((o) => o.key === key);
  const beforeSnap = [...sorted].reverse().find((s) => dayOf(s.taken_on) <= created);
  const afterSnap = sorted.find((s) => dayOf(s.taken_on) >= created + days * DAY_MS);
  const before = find(beforeSnap);
  const after = find(afterSnap);
  if (!before || !after) return { status: "attente", availableOn, before, after };
  return {
    status: "mesure",
    availableOn,
    before,
    after,
    deltaClicks: after.clicks - before.clicks,
    deltaImpressions: after.impressions - before.impressions,
    deltaPosition: Math.round((after.position - before.position) * 10) / 10,
  };
}

/** Mois « YYYY-MM » précédant la date donnée (fuseau Paris géré par l'appelant). */
export function previousMonth(todayIso: string): string {
  const [y, m] = todayIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function topOpportunities(opps: SnapshotOpportunity[], n = 5): SnapshotOpportunity[] {
  return [...opps].sort((a, b) => b.score - a.score).slice(0, n);
}
