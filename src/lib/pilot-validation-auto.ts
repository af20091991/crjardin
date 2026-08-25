import { supabase } from "@/integrations/supabase/client";
import { listClients, type Client } from "@/lib/clients";
import { buildDesignationIndex, suggestClients, linkEntryToClient } from "@/lib/pilot-ca-matching";
import { reasonsForLine, setValidation } from "@/lib/pilot-validation";

interface PendingSale {
  id: string;
  year: number;
  month: number;
  kind: string;
  designation: string | null;
  charge_class: string | null;
  charge_category: string | null;
  match_status: string | null;
  validation_status: string | null;
  is_investment: boolean | null;
  source_file: string | null;
  source_sheet: string | null;
}

export interface AutoValidationResult {
  linked: number;
  validated: number;
  skipped: number;
}

function isFutureMonth(year: number, month: number, now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const currentYear = Number(parts.find((p) => p.type === "year")?.value);
  const currentMonth = Number(parts.find((p) => p.type === "month")?.value);
  return year > currentYear || (year === currentYear && month > currentMonth);
}

/**
 * Traite uniquement les cas financiers certains du Centre de validation.
 *
 * - rattachement automatique uniquement sur correspondance exacte ou historique ;
 * - aucune création/fusion de client ;
 * - aucune décision sur les correspondances moyennes/faibles ;
 * - validation uniquement après disparition de tous les motifs de validation ;
 * - les lignes marquées « à revoir » et les lignes futures sont intouchables.
 */
export async function processCertainPendingValidation(): Promise<AutoValidationResult> {
  const { data, error } = await supabase
    .from("pilot_ca_entries")
    .select(
      "id,year,month,kind,designation,charge_class,charge_category,match_status,validation_status,is_investment,source_file,source_sheet",
    )
    .eq("validation_status", "a_valider")
    .order("year", { ascending: true })
    .order("month", { ascending: true })
    .limit(5000);
  if (error) throw error;

  const pending = (data ?? []) as PendingSale[];
  const eligible = pending.filter((r) => !isFutureMonth(r.year, r.month));
  if (eligible.length === 0) return { linked: 0, validated: 0, skipped: 0 };

  const clients = await listClients();
  const { data: history, error: historyError } = await supabase
    .from("pilot_ca_entries")
    .select("designation,client_id")
    .not("client_id", "is", null)
    .limit(10000);
  if (historyError) throw historyError;

  const designationIndex = buildDesignationIndex(
    (history ?? []) as Array<{ designation: string | null; client_id: string | null }>,
  );

  let linked = 0;
  let validated = 0;
  let skipped = 0;

  for (const row of eligible) {
    if (row.kind !== "vente") {
      skipped += 1;
      continue;
    }

    if (row.match_status === "non_identifie" || !row.match_status) {
      const suggestions = suggestClients(
        { designation: row.designation },
        clients as Client[],
        designationIndex,
        { limit: 2 },
      );
      const best = suggestions[0];
      const second = suggestions[1];
      const unambiguous = Boolean(
        best &&
          (best.reason === "exact" || best.reason === "historique") &&
          best.confidence === "haute" &&
          (!second || best.score - second.score >= 0.08),
      );

      if (unambiguous) {
        await linkEntryToClient({
          entryId: row.id,
          clientId: best.client.id,
          method: "bulk",
          score: best.score,
          note: `Rapprochement automatique (${best.reason}) — ${best.evidence.join(" ; ")}`,
        });
        linked += 1;
      }
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("pilot_ca_entries")
      .select(
        "id,year,month,kind,designation,charge_class,charge_category,match_status,is_investment,source_file,source_sheet,validation_status",
      )
      .eq("id", row.id)
      .single();
    if (refreshError) throw refreshError;

    const current = refreshed as PendingSale;
    const reasons = reasonsForLine(current);
    if (current.validation_status === "a_valider" && reasons.length === 0) {
      await setValidation(
        current.id,
        "valide",
        "Auto-validée : rattachement/rapprochement certain et aucun motif de validation restant.",
      );
      validated += 1;
    } else if (reasons.length > 0) {
      skipped += 1;
    }
  }

  return { linked, validated, skipped };
}
