// État de rapprochement d'une ligne CA, lisible par le dirigeant :
// automatique / manuel validé / à confirmer / non identifié.
// Aucun recalcul : l'état est déduit des colonnes existantes
// (client_id, match_status, match_method) et du journal des décisions.
import { supabase } from "@/integrations/supabase/client";

export type MatchState = "automatique" | "manuel_valide" | "a_confirmer" | "non_identifie";

export const MATCH_STATE_META: Record<
  MatchState,
  { label: string; hint: string; badge: string }
> = {
  automatique: {
    label: "Automatique",
    hint: "Rattachée par le moteur en confiance haute (correspondance exacte ou historique).",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  manuel_valide: {
    label: "Manuel validé",
    hint: "Rattachement décidé par le dirigeant : il fait référence et sert d'apprentissage.",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
  a_confirmer: {
    label: "À confirmer",
    hint: "Une correspondance est possible mais reste à valider humainement.",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
  },
  non_identifie: {
    label: "Non identifié",
    hint: "Aucune identification fiable : la ligne reste visible et comptée, jamais masquée.",
    badge: "border-border bg-muted text-muted-foreground",
  },
};

/** Méthodes correspondant à une décision humaine. */
export const MANUAL_METHODS = ["manual", "suggestion", "new_client"] as const;

export function matchStateOf(row: {
  client_id?: string | null;
  match_status?: string | null;
  match_method?: string | null;
}): MatchState {
  const method = row.match_method ?? "";
  if (row.client_id) {
    return (MANUAL_METHODS as readonly string[]).includes(method) ? "manuel_valide" : "automatique";
  }
  if (row.match_status === "validation") return "a_confirmer";
  return "non_identifie";
}

export interface MatchStateBucket {
  state: MatchState;
  lines: number;
  amount: number;
}

/** Répartition des lignes de vente par état de rapprochement. */
export async function getMatchStateBreakdown(): Promise<{
  buckets: MatchStateBucket[];
  totalLines: number;
  totalAmount: number;
}> {
  const rows: Array<{
    client_id: string | null;
    match_status: string | null;
    match_method: string | null;
    amount_ht: number | null;
  }> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("pilot_ca_entries")
      .select("client_id,match_status,match_method,amount_ht")
      .eq("kind", "vente")
      .neq("match_status", "non_applicable")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as unknown as typeof rows;
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }

  const order: MatchState[] = ["automatique", "manuel_valide", "a_confirmer", "non_identifie"];
  const map = new Map<MatchState, MatchStateBucket>(
    order.map((s) => [s, { state: s, lines: 0, amount: 0 }]),
  );
  let totalAmount = 0;
  for (const r of rows) {
    const amt = Number(r.amount_ht) || 0;
    totalAmount += amt;
    const b = map.get(matchStateOf(r))!;
    b.lines += 1;
    b.amount += amt;
  }
  return {
    buckets: order.map((s) => map.get(s)!).filter((b) => b.lines > 0),
    totalLines: rows.length,
    totalAmount,
  };
}

export interface ManualImpactCheck {
  /** Décisions humaines enregistrées dans le journal. */
  decisions: number;
  /** Décisions effectivement reflétées sur la ligne concernée. */
  applied: number;
  /** Décisions annulées volontairement (reverted / refused ensuite). */
  reverted: number;
  /** Décisions sans effet visible : à vérifier. */
  failures: Array<{ entryId: string; expectedClientId: string; actualClientId: string | null }>;
  /** Clients distincts concernés par une validation manuelle. */
  clientsTouched: number;
}

/**
 * Contrôle que les validations manuelles ont réellement un impact :
 * pour chaque décision humaine du journal, la ligne CA doit porter le client décidé
 * (sauf décision volontairement annulée ensuite).
 */
export async function checkManualValidationImpact(limit = 500): Promise<ManualImpactCheck> {
  const { data: logs, error } = await supabase
    .from("pilot_ca_match_log")
    .select("entry_id,new_client_id,method,decided_at")
    .not("new_client_id", "is", null)
    .order("decided_at", { ascending: false })
    .limit(limit * 3);
  if (error) throw error;

  const all = (logs ?? []) as unknown as Array<{
    entry_id: string;
    new_client_id: string;
    method: string;
    decided_at: string;
  }>;

  /** Dernière décision par ligne : c'est elle qui doit être reflétée. */
  const last = new Map<string, { clientId: string; method: string }>();
  for (const l of all) {
    if (!last.has(l.entry_id)) last.set(l.entry_id, { clientId: l.new_client_id, method: l.method });
  }
  const manual = Array.from(last.entries())
    .filter(([, v]) => (MANUAL_METHODS as readonly string[]).includes(v.method))
    .slice(0, limit);

  if (manual.length === 0) {
    return { decisions: 0, applied: 0, reverted: 0, failures: [], clientsTouched: 0 };
  }

  const { data: entries, error: e2 } = await supabase
    .from("pilot_ca_entries")
    .select("id,client_id,match_method")
    .in(
      "id",
      manual.map(([id]) => id),
    );
  if (e2) throw e2;
  const byId = new Map(
    ((entries ?? []) as unknown as Array<{ id: string; client_id: string | null; match_method: string | null }>).map(
      (e) => [e.id, e],
    ),
  );

  let applied = 0;
  let reverted = 0;
  const failures: ManualImpactCheck["failures"] = [];
  for (const [entryId, decision] of manual) {
    const row = byId.get(entryId);
    if (!row) continue;
    if (row.client_id === decision.clientId) applied += 1;
    else if (row.match_method === "reverted" || row.match_method === "refused") reverted += 1;
    else failures.push({ entryId, expectedClientId: decision.clientId, actualClientId: row.client_id });
  }

  return {
    decisions: manual.length,
    applied,
    reverted,
    failures,
    clientsTouched: new Set(manual.map(([, v]) => v.clientId)).size,
  };
}
