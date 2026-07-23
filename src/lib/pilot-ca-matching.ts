import { supabase } from "@/integrations/supabase/client";
import type { CaEntry } from "@/lib/pilot-ca";
import type { Client } from "@/lib/clients";

export type MatchMethod = "manual" | "suggestion" | "refused" | "reverted" | "new_client" | "bulk";

export interface MatchLog {
  id: string;
  entry_id: string;
  previous_client_id: string | null;
  new_client_id: string | null;
  method: MatchMethod;
  score: number | null;
  decided_by: string;
  note: string | null;
  decided_at: string;
}

export interface Suggestion {
  client: Client;
  score: number;
  reason: "historique" | "similarite";
}

// ---- Normalisation & similarité ----
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}

/** Coefficient de Dice sur bigrams (0..1). */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let inter = 0;
  let total = 0;
  ga.forEach((v) => (total += v));
  gb.forEach((v) => (total += v));
  ga.forEach((v, k) => {
    const w = gb.get(k);
    if (w) inter += Math.min(v, w);
  });
  if (total === 0) return 0;
  // Bonus si un nom est inclus dans l'autre
  const inclusion = na.includes(nb) || nb.includes(na) ? 0.15 : 0;
  return Math.min(1, (2 * inter) / total + inclusion);
}

/**
 * Construit un index désignation normalisée -> client dominant, à partir des
 * lignes CA déjà rattachées. Sert de suggestion "historique".
 */
export function buildDesignationIndex(
  entries: Pick<CaEntry, "designation" | "client_id">[],
): Map<string, { clientId: string; count: number }> {
  const idx = new Map<string, Map<string, number>>();
  for (const e of entries) {
    if (!e.client_id || !e.designation) continue;
    const key = normalize(e.designation);
    if (!key) continue;
    if (!idx.has(key)) idx.set(key, new Map());
    const inner = idx.get(key)!;
    inner.set(e.client_id, (inner.get(e.client_id) ?? 0) + 1);
  }
  const out = new Map<string, { clientId: string; count: number }>();
  idx.forEach((inner, key) => {
    let bestId = "";
    let bestCount = 0;
    inner.forEach((count, id) => {
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
      }
    });
    if (bestId) out.set(key, { clientId: bestId, count: bestCount });
  });
  return out;
}

/** Retourne les meilleures suggestions (top N) pour une ligne CA. */
export function suggestClients(
  entry: Pick<CaEntry, "designation">,
  clients: Client[],
  designationIndex: Map<string, { clientId: string; count: number }>,
  opts: { limit?: number; minScore?: number } = {},
): Suggestion[] {
  const limit = opts.limit ?? 5;
  const minScore = opts.minScore ?? 0.35;
  const designation = entry.designation ?? "";
  const key = normalize(designation);
  const scores = new Map<string, Suggestion>();

  // 1) Historique désignation -> client
  if (key) {
    const hit = designationIndex.get(key);
    if (hit) {
      const client = clients.find((c) => c.id === hit.clientId);
      if (client) {
        scores.set(client.id, {
          client,
          score: Math.min(1, 0.9 + Math.log10(hit.count + 1) * 0.05),
          reason: "historique",
        });
      }
    }
  }

  // 2) Similarité fuzzy nom / civilité + nom
  for (const client of clients) {
    const candidates = [
      client.name,
      client.civility ? `${client.civility} ${client.name}` : "",
    ].filter(Boolean);
    let best = 0;
    for (const c of candidates) {
      const s = similarity(designation, c);
      if (s > best) best = s;
    }
    if (best < minScore) continue;
    const existing = scores.get(client.id);
    if (!existing || best > existing.score) {
      scores.set(client.id, { client, score: best, reason: "similarite" });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---- Accès base ----
export async function listOrphanEntries(): Promise<CaEntry[]> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("*")
    .is("client_id", null)
    .eq("kind", "vente")
    .order("year", { ascending: false })
    .order("month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as CaEntry[];
}

export async function listLinkedEntries(): Promise<Pick<CaEntry, "designation" | "client_id">[]> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("designation, client_id")
    .not("client_id", "is", null);
  if (error) throw error;
  return (data ?? []) as unknown as Pick<CaEntry, "designation" | "client_id">[];
}

export async function listRecentDecisions(limit = 20): Promise<MatchLog[]> {
  const { data, error } = await supabase
    .from("pilot_ca_match_log")
    .select("*")
    .order("decided_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as MatchLog[];
}

export async function linkEntryToClient(params: {
  entryId: string;
  clientId: string | null;
  method: MatchMethod;
  score?: number | null;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("link_ca_entry_to_client", {
    _entry_id: params.entryId,
    _client_id: params.clientId,
    _method: params.method,
    _score: params.score ?? null,
    _note: params.note ?? null,
  });
  if (error) throw error;
}

/**
 * Rejoue la dernière décision pour restaurer previous_client_id.
 * Ne modifie jamais amount / date / catégorie.
 */
export async function revertLastDecision(entryId: string): Promise<void> {
  const { data, error } = await supabase
    .from("pilot_ca_match_log")
    .select("*")
    .eq("entry_id", entryId)
    .order("decided_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const last = (data ?? [])[0] as MatchLog | undefined;
  if (!last) throw new Error("Aucune décision à annuler.");
  await linkEntryToClient({
    entryId,
    clientId: last.previous_client_id,
    method: "reverted",
    note: `Annulation de la décision ${last.id}`,
  });
}