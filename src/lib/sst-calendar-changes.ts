import { supabase } from "@/integrations/supabase/client";
import {
  listSstNotifyCandidates,
  notifySstCalendarChanges,
  skipSstCalendarChanges,
} from "@/lib/sst-calendar-alerts.functions";

// Table créée par migration, absente des types générés : accès volontairement non typé.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const changesFrom = () => (supabase.from as any)("sst_calendar_changes");

export interface SstChangeLine {
  label: string;
  from: string | null;
  to: string | null;
}

export interface SstCalendarChange {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_label: string;
  entity: "availability" | "worksite";
  entity_id: string | null;
  action: "created" | "updated" | "deleted";
  calendar_date: string | null;
  summary: string;
  details: SstChangeLine[];
  acknowledged_at: string | null;
  notify_decision: "sent" | "skipped" | null;
}

export const SST_ACTION_META: Record<SstCalendarChange["action"], { label: string; tone: string }> =
  {
    created: { label: "Ajout", tone: "bg-emerald-100 text-emerald-800" },
    updated: { label: "Modification", tone: "bg-amber-100 text-amber-900" },
    deleted: { label: "Suppression", tone: "bg-red-100 text-red-800" },
  };

/** Modifications pas encore vues. Tolérant : sans la table (ou hors admin), renvoie une liste vide. */
export async function listUnseenSstChanges(): Promise<SstCalendarChange[]> {
  const { data, error } = await changesFrom()
    .select("*")
    .is("acknowledged_at", null)
    .eq("notify_decision", "sent")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as SstCalendarChange[];
}

export async function acknowledgeSstChanges(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await changesFrom()
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: auth.user?.id ?? null })
    .in("id", ids);
  if (error) throw new Error(`Impossible de marquer comme vu : ${error.message}`);
}

/** Jours du calendrier portant au moins une modification non vue, avec leur nombre. */
export function unseenCountByDate(changes: SstCalendarChange[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const change of changes) {
    if (!change.calendar_date) continue;
    map.set(change.calendar_date, (map.get(change.calendar_date) ?? 0) + 1);
  }
  return map;
}

export function describeChangeLine(line: SstChangeLine): string {
  return line.from == null && line.to == null
    ? line.label
    : `${line.label} : ${line.from ?? "—"} → ${line.to ?? "—"}`;
}

export const SST_PENDING_EVENT = "sst-calendar-pending-changed";

/**
 * À appeler après toute écriture sur le calendrier SST : la modification est journalisée en base,
 * mais RIEN n'est envoyé. On prévient simplement la page de proposer à l'auteur de notifier (ou non).
 */
export function signalSstCalendarWrite(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SST_PENDING_EVENT));
}

/** Modifications de l'utilisateur courant en attente de décision (notifier ou non). */
export async function listPendingSstDecisions(): Promise<SstCalendarChange[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await changesFrom()
    .select("*")
    .eq("actor_id", uid)
    .is("notify_decision", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return [];
  return (data ?? []) as SstCalendarChange[];
}

export async function notifySstChanges(ids: string[], recipientIds: string[]) {
  return notifySstCalendarChanges({ data: { ids, recipientIds } });
}

export async function listSstRecipients(ids: string[]) {
  return listSstNotifyCandidates({ data: { ids } });
}

export async function skipSstChanges(ids: string[]) {
  return skipSstCalendarChanges({ data: { ids } });
}
