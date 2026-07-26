import { supabase } from "@/integrations/supabase/client";
import { similarity, levenshtein, MATCH_RULES, type ConfidenceLevel } from "@/lib/pilot-ca-matching";
import type { Client } from "@/lib/clients";

/**
 * Trois sources d'heures strictement séparées dans Pilot Pro.
 * Aucune estimation n'est jamais utilisée dans les KPI.
 */
export const HOURS_SOURCE_META = {
  vendues: {
    label: "Heures vendues",
    origin: "Suivi CA (pilot_ca_entries.hours)",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
  },
  reelles: {
    label: "Heures réelles intervention",
    origin: "Interventions confirmées (hours_spent)",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  historiques: {
    label: "Heures historiques importées",
    origin: "Heures historiques importées Excel",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
} as const;

export type HoursSource = keyof typeof HOURS_SOURCE_META;

export type HistoricHoursStatus = "valide" | "a_valider" | "non_attribue";

export const HISTORIC_STATUS_META: Record<HistoricHoursStatus, { label: string; badge: string }> = {
  valide: { label: "Rattachée", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  a_valider: { label: "À valider", badge: "border-orange-200 bg-orange-50 text-orange-700" },
  non_attribue: { label: "Non attribuée", badge: "border-border bg-muted text-muted-foreground" },
};

export interface HistoricHoursRow {
  id: string;
  year: number;
  hours: number;
  raw_client_text: string;
  client_id: string | null;
  amount_ht: number | null;
  margin_net: number | null;
  source_file: string | null;
  source_sheet: string | null;
  source_row: number | null;
  confidence: ConfidenceLevel;
  status: HistoricHoursStatus;
  note: string | null;
}

export async function listHistoricHours(): Promise<HistoricHoursRow[]> {
  const { data, error } = await supabase
    .from("pilot_historic_hours")
    .select("*")
    .order("year", { ascending: false })
    .order("raw_client_text", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HistoricHoursRow[];
}

export async function listHistoricHoursForClient(clientId: string): Promise<HistoricHoursRow[]> {
  const { data, error } = await supabase
    .from("pilot_historic_hours")
    .select("*")
    .eq("client_id", clientId)
    .order("year", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as HistoricHoursRow[];
}

export interface HoursSuggestion {
  client: Client;
  score: number;
  confidence: ConfidenceLevel;
  evidence: string[];
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Suggestions de client pour une ligne d'heures historiques.
 * Confiance haute réservée à la correspondance exacte : une orthographe proche
 * (Mauric / Maurice) reste une simple suggestion à valider.
 */
export function suggestClientsForHours(
  row: Pick<HistoricHoursRow, "raw_client_text">,
  clients: Client[],
  limit = 5,
): HoursSuggestion[] {
  const key = norm(row.raw_client_text.replace(/\b(x\d|20\d\d|sap|ree|ceev)\b/gi, " "));
  if (!key) return [];
  const out: HoursSuggestion[] = [];
  for (const client of clients) {
    const n = norm(client.name);
    if (!n) continue;
    if (n === key) {
      out.push({
        client,
        score: 1,
        confidence: "haute",
        evidence: ["Libellé identique à la fiche client"],
      });
      continue;
    }
    const score = similarity(key, client.name);
    const near = levenshtein(n, key) <= MATCH_RULES.NEAR_MISS_MAX;
    if (score >= MATCH_RULES.MIN_SUGGESTION) {
      out.push({
        client,
        score,
        confidence: "moyenne",
        evidence: [
          n.includes(key) || key.includes(n)
            ? "Libellé contenu dans le nom du client"
            : "Similarité orthographique uniquement",
          ...(near ? ["Orthographe proche mais différente — vérification requise"] : []),
        ],
      });
    }
  }
  out.sort((a, b) => b.score - a.score);
  if (out.length > 1 && out[0].confidence === "haute" && out[0].score - out[1].score < MATCH_RULES.AMBIGUITY_GAP) {
    out[0] = {
      ...out[0],
      confidence: "moyenne",
      evidence: [...out[0].evidence, "Plusieurs clients possibles — validation requise"],
    };
  }
  return out.slice(0, limit);
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

/** Rattache (ou détache) une ligne d'heures historiques — décision journalisée. */
export async function assignHistoricHours(params: {
  id: string;
  clientId: string | null;
  status: HistoricHoursStatus;
  confidence?: ConfidenceLevel;
  method: "manual" | "suggestion" | "refused" | "new_client";
  note?: string | null;
}): Promise<void> {
  const user_id = await uid();
  const { data: before } = await supabase
    .from("pilot_historic_hours")
    .select("client_id")
    .eq("id", params.id)
    .maybeSingle();
  const { error } = await supabase
    .from("pilot_historic_hours")
    .update({
      client_id: params.clientId,
      status: params.status,
      confidence: params.confidence ?? (params.clientId ? "moyenne" : "faible"),
      note: params.note ?? null,
    } as never)
    .eq("id", params.id);
  if (error) throw error;
  const { error: logError } = await supabase.from("pilot_hours_match_log").insert({
    user_id,
    hours_id: params.id,
    previous_client_id: (before as { client_id: string | null } | null)?.client_id ?? null,
    new_client_id: params.clientId,
    method: params.method,
    note: params.note ?? null,
  } as never);
  if (logError) throw logError;
}

/** Total des heures historiques rattachées à un client (toutes années). */
export function sumHistoricHours(rows: HistoricHoursRow[]): number {
  return rows.reduce((s, r) => s + Number(r.hours ?? 0), 0);
}