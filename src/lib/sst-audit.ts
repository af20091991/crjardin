// Journal des modifications du module Rentabilité SST + annulation de la dernière action.
import { supabase } from "@/integrations/supabase/client";

export interface SstAuditEntry {
  id: string;
  user_id: string;
  entity: string;
  entity_id: string | null;
  action: "create" | "update" | "delete" | "archive" | "restore" | "duplicate" | "undo";
  label: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  undone_at: string | null;
  created_at: string;
}

const table = () =>
  (supabase as unknown as { from: (t: string) => any }).from("sst_audit_log");

export async function listSstAudit(limit = 100): Promise<SstAuditEntry[]> {
  const { data, error } = await table().select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as SstAuditEntry[];
}

export async function logSst(entry: {
  entity: string;
  entity_id?: string | null;
  action: SstAuditEntry["action"];
  label?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await table().insert({
    entity: entry.entity,
    entity_id: entry.entity_id ?? null,
    action: entry.action,
    label: entry.label ?? null,
    before_data: entry.before_data ?? null,
    after_data: entry.after_data ?? null,
  });
  if (error) throw error;
}

const RESTORABLE = [
  "mission_date",
  "service_requested",
  "prestation",
  "category",
  "payment_method",
  "invoice_ref",
  "status",
  "hours_spent",
  "hours_saved",
  "agreed_price",
  "invoiced_amount",
  "client_price",
  "archived_at",
] as const;

/** Rétablit l'état précédent d'une mission à partir d'une entrée du journal. */
export async function undoSstChange(entry: SstAuditEntry): Promise<void> {
  if (!entry.entity_id || !entry.before_data) throw new Error("Modification non réversible");
  const patch: Record<string, unknown> = {};
  for (const key of RESTORABLE) {
    if (key in entry.before_data) patch[key] = entry.before_data[key];
  }
  if (Object.keys(patch).length === 0) throw new Error("Aucune valeur à restaurer");
  const { error } = await (supabase as unknown as { from: (t: string) => any })
    .from("subcontractor_missions")
    .update(patch)
    .eq("id", entry.entity_id);
  if (error) throw error;
  await table().update({ undone_at: new Date().toISOString() }).eq("id", entry.id);
  await logSst({
    entity: entry.entity,
    entity_id: entry.entity_id,
    action: "undo",
    label: entry.label,
    before_data: entry.after_data,
    after_data: entry.before_data,
  });
}