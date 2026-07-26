import { supabase } from "@/integrations/supabase/client";
import type { CaEntry } from "@/lib/pilot-ca";
import { createClient, type Client } from "@/lib/clients";

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
  reason: "historique" | "exact" | "renforce" | "similarite";
  confidence: ConfidenceLevel;
  evidence: string[];
}

/** Niveau de confiance d'un rapprochement proposé. */
export type ConfidenceLevel = "haute" | "moyenne" | "faible";

export const CONFIDENCE_META: Record<
  ConfidenceLevel,
  { label: string; hint: string; badge: string }
> = {
  haute: {
    label: "Confiance haute",
    hint: "Correspondance certaine (exacte ou déjà validée) — rattachement automatique autorisé.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  moyenne: {
    label: "Confiance moyenne",
    hint: "Suggestion uniquement — validation humaine obligatoire.",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
  },
  faible: {
    label: "Confiance faible",
    hint: "Aucune suggestion fiable — recherche manuelle recommandée.",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/** Seuils du moteur de rapprochement (constantes métier centralisées). */
export const MATCH_RULES = {
  /** En dessous : aucune suggestion affichée. */
  MIN_SUGGESTION: 0.55,
  /** Écart minimal entre 1re et 2e proposition pour rester en confiance haute. */
  AMBIGUITY_GAP: 0.08,
  /** Distance d'édition minimale considérée comme "faux ami" (Mauric ≠ Maurice). */
  NEAR_MISS_MAX: 2,
} as const;

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

/** Distance de Levenshtein (garde-fou "faux amis" : Mauric ≠ Maurice). */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length > 1);
}

/** Signaux "niveau 2" trouvés dans la désignation : commune, téléphone, email, prénom. */
function reinforcement(designation: string, client: Client): string[] {
  const d = normalize(designation);
  const found: string[] = [];
  const addressTokens = tokens(client.address ?? "").filter((t) => t.length > 3 && !/^\d+$/.test(t));
  if (addressTokens.some((t) => d.includes(t))) found.push("adresse / commune");
  const digits = (client.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 6 && designation.replace(/\D/g, "").includes(digits.slice(-6))) found.push("téléphone");
  const mails = [client.email, ...(client.emails ?? [])].filter(Boolean) as string[];
  const local = mails.map((m) => normalize(m.split("@")[0])).filter((t) => t.length > 3);
  if (local.some((t) => d.includes(t))) found.push("e-mail");
  if (client.civility && d.includes(normalize(client.civility))) found.push("civilité / prénom");
  return found;
}

/**
 * Retourne les meilleures suggestions (top N) pour une ligne CA, avec niveau de
 * confiance. Seule la confiance « haute » autorise un rattachement automatique.
 */
export function suggestClients(
  entry: Pick<CaEntry, "designation">,
  clients: Client[],
  designationIndex: Map<string, { clientId: string; count: number }>,
  opts: { limit?: number; minScore?: number } = {},
): Suggestion[] {
  const limit = opts.limit ?? 5;
  const minScore = opts.minScore ?? MATCH_RULES.MIN_SUGGESTION;
  const designation = entry.designation ?? "";
  const key = normalize(designation);
  const scores = new Map<string, Suggestion>();
  if (!key) return [];

  // Niveau 1 — historique validé sur désignation identique
  const hit = designationIndex.get(key);
  if (hit) {
    const client = clients.find((c) => c.id === hit.clientId);
    if (client) {
      scores.set(client.id, {
        client,
        score: Math.min(1, 0.9 + Math.log10(hit.count + 1) * 0.05),
        reason: "historique",
        confidence: "haute",
        evidence: [`${hit.count} ligne(s) déjà validée(s) avec cette désignation`],
      });
    }
  }

  for (const client of clients) {
    const names = [client.name, client.civility ? `${client.civility} ${client.name}` : ""].filter(Boolean);
    const exact = names.some((n) => normalize(n) === key);
    const nameTokens = tokens(client.name);
    const dTokens = tokens(designation);
    const allTokensPresent =
      nameTokens.length > 0 && nameTokens.every((t) => dTokens.includes(t));
    const near = nameTokens.some((t) =>
      dTokens.some((u) => u !== t && levenshtein(t, u) <= MATCH_RULES.NEAR_MISS_MAX),
    );
    const boosts = reinforcement(designation, client);

    let best = 0;
    for (const n of names) best = Math.max(best, similarity(designation, n));

    let candidate: Suggestion | null = null;
    if (exact) {
      candidate = {
        client,
        score: 1,
        reason: "exact",
        confidence: "haute",
        evidence: ["Correspondance exacte après normalisation"],
      };
    } else if (allTokensPresent && boosts.length > 0) {
      candidate = {
        client,
        score: Math.max(best, 0.9),
        reason: "renforce",
        confidence: "haute",
        evidence: ["Nom complet retrouvé", ...boosts.map((b) => `Confirmé par ${b}`)],
      };
    } else if (allTokensPresent) {
      candidate = {
        client,
        score: Math.max(best, 0.8),
        reason: "renforce",
        confidence: "moyenne",
        evidence: ["Nom complet retrouvé, sans autre donnée de confirmation"],
      };
    } else if (best >= minScore) {
      candidate = {
        client,
        score: best,
        reason: "similarite",
        confidence: "moyenne",
        evidence: [
          "Similarité orthographique uniquement",
          ...(near ? ["Orthographe proche mais différente — vérification requise"] : []),
          ...boosts.map((b) => `Confirmé par ${b}`),
        ],
      };
    }
    if (!candidate) continue;
    // Garde-fou faux amis : une orthographe proche mais non identique ne peut
    // jamais autoriser un rattachement automatique.
    if (candidate.confidence === "haute" && !exact && candidate.reason !== "historique" && near) {
      candidate = { ...candidate, confidence: "moyenne" };
    }
    const existing = scores.get(client.id);
    if (!existing || candidate.score > existing.score) scores.set(client.id, candidate);
  }

  const out = Array.from(scores.values()).sort((a, b) => b.score - a.score);

  // Ambiguïté : deux candidats trop proches → aucune confiance haute.
  if (
    out.length > 1 &&
    out[0].confidence === "haute" &&
    out[0].score - out[1].score < MATCH_RULES.AMBIGUITY_GAP
  ) {
    out[0] = {
      ...out[0],
      confidence: "moyenne",
      evidence: [...out[0].evidence, "Plusieurs clients possibles — validation requise"],
    };
  }
  return out.slice(0, limit);
}

/** Confiance globale d'une ligne CA orpheline. */
export function entryConfidence(suggestions: Suggestion[]): ConfidenceLevel {
  if (suggestions.length === 0) return "faible";
  return suggestions[0].confidence;
}

/** Rattachement automatique — uniquement les lignes en confiance haute. */
export async function autoLinkHighConfidence(
  rows: Array<{ entry: CaEntry; suggestion: Suggestion }>,
): Promise<number> {
  let done = 0;
  for (const r of rows) {
    if (r.suggestion.confidence !== "haute") continue;
    await linkEntryToClient({
      entryId: r.entry.id,
      clientId: r.suggestion.client.id,
      method: "bulk",
      score: r.suggestion.score,
      note: `Rapprochement automatique (${r.suggestion.reason}) — ${r.suggestion.evidence.join(" ; ")}`,
    });
    done += 1;
  }
  return done;
}

export const AUTO_CLIENT_MARKER = "Créé automatiquement depuis historique CA";

/**
 * Crée une fiche client minimale depuis la désignation d'une ligne CA et rattache
 * la ligne. La fiche est marquée pour rester identifiable et complétable.
 */
export async function createClientFromEntry(entry: CaEntry): Promise<Client> {
  const raw = (entry.designation ?? "").trim();
  if (!raw) throw new Error("Désignation vide : impossible de créer une fiche client.");
  const client = await createClient({
    name: raw,
    notes: `${AUTO_CLIENT_MARKER} (${entry.designation ?? ""} — ${entry.month}/${entry.year}). À compléter : adresse, téléphone, e-mail.`,
  });
  await linkEntryToClient({
    entryId: entry.id,
    clientId: client.id,
    method: "new_client",
    note: AUTO_CLIENT_MARKER,
  });
  return client;
}

/** Nombre de lignes CA vente non rattachées (indicateur de couverture). */
export async function countOrphanEntries(): Promise<number> {
  const { count, error } = await supabase
    .from("pilot_ca_entries")
    .select("id", { count: "exact", head: true })
    .is("client_id", null)
    .eq("kind", "vente");
  if (error) throw error;
  return count ?? 0;
}

/** Total HT des lignes CA non rattachées (jamais masqué dans les vues). */
export async function sumOrphanAmount(): Promise<number> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select("amount_ht")
    .is("client_id", null)
    .eq("kind", "vente");
  if (error) throw error;
  return (data ?? []).reduce((s, r) => s + Number((r as { amount_ht: number }).amount_ht ?? 0), 0);
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
  } as never);
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