// Retour utilisateur sur les alertes de la page « Aujourd'hui » (Pilot Pro).
// Une alerte marquée « vue » n'est jamais supprimée : elle passe en style
// atténué et se range en bas de liste. La notation (1 à 5) sert de mesure de
// pertinence perçue, agrégée dans l'en-tête du bloc alertes.

import { supabase } from "@/integrations/supabase/client";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export interface AlertFeedback {
  id: string;
  user_id: string;
  alert_key: string;
  seen_at: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Clé stable et déterministe dérivée du contenu de l'alerte : deux alertes
 * portant le même libellé et le même détail partagent la même clé, sans
 * dépendre d'un identifiant technique volatil.
 */
export function alertKeyFrom(parts: { key: string; label: string; detail: string }): string {
  const raw = `${parts.key}|${parts.label}|${parts.detail}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  // Hash court (FNV-1a) pour garder une clé courte et déterministe.
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hash = (h >>> 0).toString(36);
  return `${parts.key}-${hash}`;
}

export async function listAlertFeedback(): Promise<AlertFeedback[]> {
  const { data, error } = await supabase
    .from("pilot_alert_feedback")
    .select("id,user_id,alert_key,seen_at,rating,created_at,updated_at");
  if (error) throw error;
  return (data ?? []) as AlertFeedback[];
}

export async function markAlertSeen(alertKey: string, seen: boolean): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_alert_feedback")
    .upsert(
      { user_id, alert_key: alertKey, seen_at: seen ? new Date().toISOString() : null },
      { onConflict: "user_id,alert_key" },
    );
  if (error) throw error;
}

export async function rateAlert(alertKey: string, rating: number): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("pilot_alert_feedback")
    .upsert({ user_id, alert_key: alertKey, rating }, { onConflict: "user_id,alert_key" });
  if (error) throw error;
}

export function averageRating(rows: AlertFeedback[]): number | null {
  const rated = rows.filter((r) => r.rating != null);
  if (rated.length === 0) return null;
  return rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length;
}
