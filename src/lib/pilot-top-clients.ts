// ---------------------------------------------------------------------------
// TOP clients — classement composite unique (Pilot Pro).
//
// AUCUN CALCUL MÉTIER NOUVEAU : le module ne consomme que des valeurs déjà
// produites par les moteurs officiels (CA HT vendu, part du CA total, taux
// horaire Vente → Temps). Il ne fait que pondérer et ordonner.
//
// Pondérations sanctuarisées :
//   50 % CA HT vendu · 30 % part du CA HT total · 20 % taux horaire.
//
// Règles :
//   - un client sans CA strictement positif n'entre jamais au classement ;
//   - un taux horaire absent (aucune heure Vente → Temps documentée) vaut 0
//     dans la pondération : on n'invente jamais un taux ;
//   - chaque composante est normalisée sur le maximum observé du périmètre
//     analysé (période globale « À date » par défaut, décidée en amont).
// ---------------------------------------------------------------------------

export const TOP_CLIENT_WEIGHTS = { ca: 0.5, share: 0.3, rate: 0.2 } as const;

export interface TopClientInput {
  /** Clé de regroupement (clientId ou clé de vue). */
  key: string;
  clientId: string | null;
  name: string;
  /** CA HT vendu sur le périmètre analysé. */
  ca: number;
  /** Part du CA HT total du périmètre, en %. */
  share: number;
  /** Taux horaire Vente → Temps, `null` si non documenté (jamais inventé). */
  hourlyRate: number | null;
}

export interface TopClientRow extends TopClientInput {
  /** Score composite 0 → 100. */
  score: number;
  /** Contributions (points sur 100) pour l'explication à l'écran. */
  caPoints: number;
  sharePoints: number;
  ratePoints: number;
  rank: number;
}

function norm(value: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value / max);
}

/**
 * Classement composite des clients (TOP 5 par défaut).
 * Les lignes fournies doivent déjà être filtrées en amont (entités
 * économiquement exploitables uniquement).
 */
export function topClients(rows: TopClientInput[], limit = 5): TopClientRow[] {
  const eligible = rows.filter((r) => Number(r.ca) > 0);
  if (eligible.length === 0) return [];

  const maxCa = Math.max(...eligible.map((r) => Number(r.ca) || 0));
  const maxShare = Math.max(...eligible.map((r) => Number(r.share) || 0));
  const maxRate = Math.max(...eligible.map((r) => Number(r.hourlyRate) || 0));

  return eligible
    .map((r) => {
      const caPoints = norm(Number(r.ca) || 0, maxCa) * TOP_CLIENT_WEIGHTS.ca * 100;
      const sharePoints = norm(Number(r.share) || 0, maxShare) * TOP_CLIENT_WEIGHTS.share * 100;
      const ratePoints =
        r.hourlyRate == null
          ? 0
          : norm(Number(r.hourlyRate) || 0, maxRate) * TOP_CLIENT_WEIGHTS.rate * 100;
      return { ...r, caPoints, sharePoints, ratePoints, score: caPoints + sharePoints + ratePoints, rank: 0 };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.ca !== a.ca) return b.ca - a.ca;
      return (b.hourlyRate ?? 0) - (a.hourlyRate ?? 0);
    })
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
