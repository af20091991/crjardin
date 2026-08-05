// ---------------------------------------------------------------------------
// Fusion manuelle de fiches clients dupliquées (Chantier 4).
// RÈGLES ABSOLUES : aucune fusion automatique, aucune donnée supprimée.
// La fiche absorbée est conservée (archivée via merged_into_client_id) ;
// tous ses rattachements sont déplacés vers la fiche conservée et le détail
// est journalisé dans client_merge_log pour permettre une annulation.
// ---------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as { from: (t: string) => any };

/** Tables rattachées à un client, déplacées lors d'une fusion. */
const LINKED_TABLES = [
  "pilot_ca_entries",
  "interventions",
  "ceev_contracts",
  "subcontractor_missions",
  "recommendations",
  "pilot_historic_hours",
  "pilot_client_notes",
  "sites",
  "contacts",
  "worksite_sheets",
] as const;

export interface MergeLogEntry {
  id: string;
  source_client_id: string;
  source_client_name: string;
  target_client_id: string;
  target_client_name: string;
  moved: Record<string, number>;
  reason: string | null;
  reverted_at: string | null;
  created_at: string;
}

async function countLinked(table: string, clientId: string): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  if (error) return 0;
  return count ?? 0;
}

/** Comparaison des historiques de deux fiches avant décision humaine. */
export async function compareClients(aId: string, bId: string) {
  const build = async (id: string) => {
    const entries: Record<string, number> = {};
    for (const t of LINKED_TABLES) entries[t] = await countLinked(t, id);
    const { data } = await db
      .from("pilot_ca_entries")
      .select("amount_ht")
      .eq("client_id", id)
      .eq("kind", "vente");
    const caAmount = ((data ?? []) as { amount_ht: number }[]).reduce(
      (s, r) => s + (Number(r.amount_ht) || 0),
      0,
    );
    return { clientId: id, counts: entries, caAmount };
  };
  return { a: await build(aId), b: await build(bId) };
}

/**
 * Fusion manuelle : `sourceId` est archivé au profit de `targetId`.
 * Retourne le détail des éléments déplacés (journalisé).
 */
export async function mergeClients(params: {
  sourceId: string;
  targetId: string;
  reason: string;
}): Promise<Record<string, number>> {
  const { sourceId, targetId, reason } = params;
  if (sourceId === targetId) throw new Error("Impossible de fusionner une fiche avec elle-même.");

  const { data: names, error: nameErr } = await db
    .from("clients")
    .select("id, name, merged_into_client_id")
    .in("id", [sourceId, targetId]);
  if (nameErr) throw nameErr;
  const rows = (names ?? []) as { id: string; name: string; merged_into_client_id: string | null }[];
  const source = rows.find((r) => r.id === sourceId);
  const target = rows.find((r) => r.id === targetId);
  if (!source || !target) throw new Error("Fiche introuvable.");
  if (source.merged_into_client_id) throw new Error("Cette fiche est déjà fusionnée.");
  if (target.merged_into_client_id) throw new Error("La fiche conservée est elle-même fusionnée.");

  const moved: Record<string, number> = {};
  for (const t of LINKED_TABLES) {
    const n = await countLinked(t, sourceId);
    if (n === 0) continue;
    const { error } = await db.from(t).update({ client_id: targetId }).eq("client_id", sourceId);
    if (error) throw error;
    moved[t] = n;
  }

  const { error: archErr } = await db
    .from("clients")
    .update({
      merged_into_client_id: targetId,
      merged_at: new Date().toISOString(),
      merged_reason: reason,
    })
    .eq("id", sourceId);
  if (archErr) throw archErr;

  const { error: logErr } = await db.from("client_merge_log").insert({
    source_client_id: sourceId,
    source_client_name: source.name,
    target_client_id: targetId,
    target_client_name: target.name,
    moved,
    reason,
  });
  if (logErr) throw logErr;

  return moved;
}

export async function listMergeLog(limit = 50): Promise<MergeLogEntry[]> {
  const { data, error } = await db
    .from("client_merge_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as MergeLogEntry[];
}

/**
 * Annulation d'une fusion : la fiche absorbée est réactivée. Les éléments
 * déplacés ne sont pas re-répartis automatiquement (aucune supposition) ;
 * le journal conserve leur nombre exact pour un contrôle humain.
 */
export async function revertMerge(id: string): Promise<void> {
  const { data, error } = await db.from("client_merge_log").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const log = data as MergeLogEntry | null;
  if (!log) throw new Error("Fusion introuvable.");
  if (log.reverted_at) throw new Error("Cette fusion est déjà annulée.");

  const { error: e1 } = await db
    .from("clients")
    .update({
      merged_into_client_id: null,
      merged_at: null,
      merged_reason: `Fusion annulée le ${new Date().toLocaleDateString("fr-FR")}`,
    })
    .eq("id", log.source_client_id);
  if (e1) throw e1;

  const { error: e2 } = await db
    .from("client_merge_log")
    .update({ reverted_at: new Date().toISOString() })
    .eq("id", id);
  if (e2) throw e2;
}
