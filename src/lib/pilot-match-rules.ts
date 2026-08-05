// ---------------------------------------------------------------------------
// Règles de rapprochement apprises (Chantier 2).
// « Cette ancienne désignation correspond toujours au client X. »
// Chaque validation humaine crée / renforce une règle persistante, consultable
// et supprimable. Aucune règle n'est créée automatiquement par le moteur :
// seule une décision humaine (manual / suggestion / new_client) en produit une.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };

export interface MatchRule {
  id: string;
  designation_key: string;
  sample_designation: string | null;
  client_id: string;
  hits: number;
  origin: string;
  created_at: string;
  updated_at: string;
}

/** Enregistre (ou renforce) la règle issue d'une validation humaine. */
export async function saveMatchRule(params: {
  designationKey: string;
  sampleDesignation: string | null;
  clientId: string;
  origin?: string;
}): Promise<void> {
  if (!params.designationKey) return;
  const { data: existing, error } = await db
    .from("pilot_match_rules")
    .select("id, hits, client_id")
    .eq("designation_key", params.designationKey)
    .maybeSingle();
  if (error) throw error;
  const row = existing as { id: string; hits: number; client_id: string } | null;
  if (row) {
    const { error: e } = await db
      .from("pilot_match_rules")
      .update({
        client_id: params.clientId,
        hits: row.client_id === params.clientId ? row.hits + 1 : 1,
        sample_designation: params.sampleDesignation,
        origin: params.origin ?? "manual",
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (e) throw e;
    return;
  }
  const { error: e2 } = await db.from("pilot_match_rules").insert({
    designation_key: params.designationKey,
    sample_designation: params.sampleDesignation,
    client_id: params.clientId,
    origin: params.origin ?? "manual",
  });
  if (e2) throw e2;
}

export async function listMatchRules(): Promise<MatchRule[]> {
  const { data, error } = await db
    .from("pilot_match_rules")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MatchRule[];
}

/** Suppression manuelle : la règle ne guidera plus les suggestions. */
export async function deleteMatchRule(id: string): Promise<void> {
  const { error } = await db.from("pilot_match_rules").delete().eq("id", id);
  if (error) throw error;
}

/** Index prêt à alimenter suggestClients() (même forme que l'historique validé). */
export function rulesIndex(rules: MatchRule[]): Map<string, { clientId: string; count: number }> {
  const out = new Map<string, { clientId: string; count: number }>();
  for (const r of rules) out.set(r.designation_key, { clientId: r.client_id, count: r.hits });
  return out;
}
