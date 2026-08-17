// Journal des décisions du Centre de contrôle des données.
//
// Traçabilité : chaque action de la file (correction automatique sûre,
// confirmation, refus, justification) est enregistrée dans la table de suivi
// existante `pilot_quality_checks` avec sa date, son auteur et sa motivation.
// Aucune valeur métier n'est écrite ici : ce module ne stocke QUE l'état de
// traitement d'une anomalie, ce qui permet de la faire sortir de la file active
// sans jamais la supprimer.
import { supabase } from "@/integrations/supabase/client";
import type { ControlState } from "@/lib/pilot-control-queue";

const TABLE = "pilot_quality_checks";
const PREFIX = "control:";

const DB_STATUS: Record<ControlState, string> = {
  corrigee_auto: "resolved",
  confirmee: "resolved",
  refusee: "ignored",
  justifiee: "ignored",
  en_attente: "open",
  non_resolue: "in_progress",
  indisponible: "in_progress",
  // Hors périmètre : classé comme ignoré volontairement, jamais « en erreur ».
  hors_perimetre: "ignored",
};

export interface ControlLogRow {
  id: string;
  key: string;
  state: ControlState;
  note: string | null;
  at: string;
}

export async function listControlStates(): Promise<ControlLogRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,check_type,status,message,resolution_note,context,updated_at")
    .like("check_type", `${PREFIX}%`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const ctx = (r.context ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id),
      key: String(r.check_type).slice(PREFIX.length),
      state: (String(ctx.state ?? "en_attente") as ControlState) ?? "en_attente",
      note: (r.resolution_note as string | null) ?? null,
      at: String(r.updated_at ?? ""),
    };
  });
}

/** Enregistre l'état de traitement d'une anomalie (aucune donnée métier modifiée). */
export async function setControlState(params: {
  key: string;
  title: string;
  state: ControlState;
  note?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const checkType = `${PREFIX}${params.key}`;
  const payload = {
    status: DB_STATUS[params.state],
    severity: "info",
    message: params.title,
    context: { state: params.state, ...(params.detail ?? {}) },
    resolution_note: params.note ?? null,
    resolved_at:
      params.state === "en_attente" || params.state === "non_resolue"
        ? null
        : new Date().toISOString(),
    resolved_by: auth.user?.id ?? null,
  };
  const existing = await supabase.from(TABLE).select("id").eq("check_type", checkType).maybeSingle();
  if (existing.data?.id) {
    const { error } = await supabase.from(TABLE).update(payload).eq("id", existing.data.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from(TABLE)
    .insert({ ...payload, check_type: checkType, target_table: "pilot", detected_by: "control-center" });
  if (error) throw error;
}

/** Annule un état : l'anomalie revient dans la file active. */
export async function clearControlState(key: string, title: string): Promise<void> {
  await setControlState({ key, title, state: "en_attente", note: "Décision annulée" });
}
