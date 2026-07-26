// Règles centralisées d'activité client (dormant / à relancer).
// Source de vérité unique — importer ces constantes plutôt que de recopier
// des seuils "180"/"365" dans les composants.
import { supabase } from "@/integrations/supabase/client";

export const CLIENT_ACTIVITY_RULES = {
  /** Au-delà de ce délai (jours), un client bascule "à relancer". */
  WARNING_DAYS: 180,
  /** Au-delà de ce délai (jours), un client est considéré "dormant". */
  DORMANT_DAYS: 365,
} as const;

const DAY_MS = 86_400_000;

export type ClientActivityStatus = "actif" | "a_relancer" | "dormant";

/** Statut d'activité à partir d'une date ISO (dernière intervention/vente). */
export function getClientActivityStatus(
  lastDate: string | null | undefined,
  now: number = Date.now(),
): ClientActivityStatus {
  if (!lastDate) return "dormant";
  const t = new Date(lastDate).getTime();
  if (!Number.isFinite(t)) return "dormant";
  const days = (now - t) / DAY_MS;
  if (days > CLIENT_ACTIVITY_RULES.DORMANT_DAYS) return "dormant";
  if (days > CLIENT_ACTIVITY_RULES.WARNING_DAYS) return "a_relancer";
  return "actif";
}

export function isWarning(lastDate: string | null | undefined, now: number = Date.now()): boolean {
  return getClientActivityStatus(lastDate, now) !== "actif";
}

export function isDormant(lastDate: string | null | undefined, now: number = Date.now()): boolean {
  return getClientActivityStatus(lastDate, now) === "dormant";
}

/** Ligne d'activité consolidée pour UN client du référentiel (table clients). */
export interface ClientActivityRow {
  id: string;
  name: string;
  lastActivity: string | null;
  status: ClientActivityStatus;
  caTotal: number;
}

/**
 * Activité par client, basée EXCLUSIVEMENT sur le référentiel `clients`
 * (clients uniques). Les lignes CA non rattachées ne créent jamais de client
 * fantôme : elles sont ignorées ici et restent visibles dans le rapprochement.
 */
export async function fetchClientActivityRows(): Promise<ClientActivityRow[]> {
  const [{ data: clients, error }, lastMap] = await Promise.all([
    supabase.from("clients").select("id,name"),
    fetchLastActivityByClient(),
  ]);
  if (error) throw error;

  const ca = await supabase
    .from("pilot_ca_entries")
    .select("client_id,amount_ht")
    .eq("kind", "vente")
    .not("client_id", "is", null);
  if (ca.error) throw ca.error;
  const caByClient = new Map<string, number>();
  for (const r of ca.data ?? []) {
    if (!r.client_id) continue;
    caByClient.set(r.client_id, (caByClient.get(r.client_id) ?? 0) + Number(r.amount_ht ?? 0));
  }

  const now = Date.now();
  return (clients ?? []).map((c) => {
    const lastActivity = lastMap.get(c.id) ?? null;
    return {
      id: c.id,
      name: c.name,
      lastActivity,
      status: getClientActivityStatus(lastActivity, now),
      caTotal: caByClient.get(c.id) ?? 0,
    };
  });
}

/**
 * Dernière date d'activité par client.
 * Source principale : interventions.intervention_date.
 * Fallback (client sans intervention enregistrée) : pilot_ca_entries (année/mois → 15).
 */
export async function fetchLastActivityByClient(): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  const iv = await supabase
    .from("interventions")
    .select("client_id,intervention_date");
  if (iv.error) throw iv.error;
  for (const r of iv.data ?? []) {
    if (!r.client_id || !r.intervention_date) continue;
    const prev = out.get(r.client_id);
    if (!prev || r.intervention_date > prev) out.set(r.client_id, r.intervention_date);
  }

  const ca = await supabase
    .from("pilot_ca_entries")
    .select("client_id,year,month")
    .eq("kind", "vente");
  if (ca.error) throw ca.error;
  for (const r of ca.data ?? []) {
    if (!r.client_id) continue;
    const mm = String(r.month).padStart(2, "0");
    const iso = `${r.year}-${mm}-15`;
    const prev = out.get(r.client_id);
    if (!prev || iso > prev) out.set(r.client_id, iso);
  }

  return out;
}