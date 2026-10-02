import { supabase } from "@/integrations/supabase/client";
import { flushSstCalendarChangeEmails } from "@/lib/sst-calendar-alerts.functions";

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

/**
 * À appeler après toute écriture sur le calendrier SST : déclenche l'e-mail aux administrateurs.
 * Silencieux par conception : une panne d'e-mail ne doit jamais bloquer ou faire échouer l'action de l'utilisateur
 * (le journal et l'alerte dans l'appli restent en base, l'e-mail repart au passage suivant).
 */
export function requestSstChangeEmails(): void {
  void flushSstCalendarChangeEmails().catch(() => undefined);
}
