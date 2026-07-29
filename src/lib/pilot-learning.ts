// Apprentissage des interactions : Pilot Pro n'invente pas de préférence, il
// réutilise les retours déjà enregistrés (alertes vues, notes 1 à 5, actions
// ignorées) pour remonter ce qui est jugé utile et ranger le reste.

import type { AlertFeedback } from "@/lib/pilot-alert-feedback";
import { ACTION_STATUS_ORDER, type ActionStatus } from "@/lib/pilot-action-status";

export interface RankableItem {
  key: string;
  weight: number;
}

/**
 * Ajuste le poids d'une recommandation à partir du retour utilisateur :
 * note 4-5 → remontée, note 1-2 → rangée, alerte déjà vue → légèrement rangée.
 */
export function feedbackAdjustment(feedback: AlertFeedback | undefined): number {
  if (!feedback) return 0;
  let delta = 0;
  if (feedback.rating != null) delta += (feedback.rating - 3) * 10;
  if (feedback.seen_at) delta -= 5;
  return delta;
}

export function statusAdjustment(status: ActionStatus): number {
  if (status === "realisee") return -1000;
  if (status === "ignoree") return -2000;
  if (status === "en_cours") return 20;
  return 0;
}

/** Tri final : poids métier + apprentissage + état de traitement. */
export function rankItems<T extends RankableItem>(
  items: T[],
  opts: {
    feedbackByKey?: Map<string, AlertFeedback>;
    statusOf?: (key: string) => ActionStatus;
  } = {},
): T[] {
  const { feedbackByKey, statusOf } = opts;
  return [...items].sort((a, b) => {
    const sa = statusOf?.(a.key) ?? "nouvelle";
    const sb = statusOf?.(b.key) ?? "nouvelle";
    if (ACTION_STATUS_ORDER[sa] !== ACTION_STATUS_ORDER[sb]) {
      return ACTION_STATUS_ORDER[sa] - ACTION_STATUS_ORDER[sb];
    }
    const wa = a.weight + feedbackAdjustment(feedbackByKey?.get(a.key)) + statusAdjustment(sa);
    const wb = b.weight + feedbackAdjustment(feedbackByKey?.get(b.key)) + statusAdjustment(sb);
    return wb - wa;
  });
}