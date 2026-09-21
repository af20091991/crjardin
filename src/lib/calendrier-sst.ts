import { supabase } from "@/integrations/supabase/client";

/**
 * Calendrier SST — calendrier partagé des disponibilités des utilisateurs.
 * Une seule notion : « disponible » un jour donné, avec commentaire facultatif.
 */
export interface SstAvailabilityEntry {
  id: string;
  user_id: string;
  date: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface SstAvailabilityWithUser extends SstAvailabilityEntry {
  userLabel: string;
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function monthWindow(year: number, month: number): { start: string; end: string } {
  return {
    start: isoDate(new Date(year, month, 1)),
    end: isoDate(new Date(year, month + 1, 0)),
  };
}

/** Grille mensuelle complète (lundi → dimanche). */
export function monthGridDates(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  const dates: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    dates.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return dates;
}

export function groupByDate(
  entries: SstAvailabilityWithUser[],
): Map<string, SstAvailabilityWithUser[]> {
  const map = new Map<string, SstAvailabilityWithUser[]>();
  for (const entry of entries) {
    const list = map.get(entry.date) ?? [];
    list.push(entry);
    map.set(entry.date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.userLabel.localeCompare(b.userLabel, "fr"));
  }
  return map;
}

export async function listAvailabilities(
  start: string,
  end: string,
): Promise<SstAvailabilityWithUser[]> {
  const { data, error } = await supabase
    .from("sst_availability_calendar")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as SstAvailabilityEntry[];
  const ids = Array.from(new Set(rows.map((row) => row.user_id)));
  const labels = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, company_name")
      .in("id", ids);
    if (profileError) throw profileError;
    for (const profile of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      company_name: string | null;
    }>) {
      const label = profile.display_name?.trim() || profile.company_name?.trim() || "";
      if (label) labels.set(profile.id, label);
    }
  }
  return rows.map((row) => ({
    ...row,
    userLabel: labels.get(row.user_id) ?? "Utilisateur PP",
  }));
}

export async function declareAvailability(date: string, comment: string | null) {
  const value = comment?.trim() ? comment.trim() : null;
  const { error } = await supabase
    .from("sst_availability_calendar")
    .upsert({ date, comment: value }, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function updateAvailabilityComment(id: string, comment: string | null) {
  const value = comment?.trim() ? comment.trim() : null;
  const { error } = await supabase
    .from("sst_availability_calendar")
    .update({ comment: value })
    .eq("id", id);
  if (error) throw error;
}

export async function removeAvailability(id: string) {
  const { error } = await supabase.from("sst_availability_calendar").delete().eq("id", id);
  if (error) throw error;
}
