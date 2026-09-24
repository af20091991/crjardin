import { supabase } from "@/integrations/supabase/client";

export type PlanningNoteStatus = "disponible" | "chantier_bloque";

export type PlanningNote = {
  id: string;
  scheduled_date: string;
  title: string;
  details: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
  status: PlanningNoteStatus;
  assigned_to: string | null;
};

export type CalendarParticipant = {
  user_id: string;
  color: string;
  icon: string;
  label: string;
};

export async function listPlanningNotes(): Promise<PlanningNote[]> {
  const { data, error } = await supabase
    .from("planning_notes")
    .select(
      "id, scheduled_date, title, details, client_id, created_by, created_at, status, assigned_to",
    )
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanningNote[];
}

export async function createPlanningNote(input: {
  scheduled_date: string;
  title: string;
  details?: string | null;
  client_id?: string | null;
  status?: PlanningNoteStatus;
  assigned_to?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("planning_notes").insert({
    scheduled_date: input.scheduled_date,
    title: input.title,
    details: input.details ?? null,
    client_id: input.client_id ?? null,
    created_by: auth.user?.id ?? null,
    status: input.status ?? "chantier_bloque",
    assigned_to: input.assigned_to ?? auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function deletePlanningNote(id: string): Promise<void> {
  const { error } = await supabase.from("planning_notes").delete().eq("id", id);
  if (error) throw error;
}

/** Couleurs/icônes des participants du calendrier partagé, complétées par le nom du profil. */
export async function listCalendarParticipants(): Promise<CalendarParticipant[]> {
  const { data, error } = await supabase
    .from("calendar_participants")
    .select("user_id, color, icon");
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.user_id);
  let names: Record<string, string | null> = {};
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, company_name")
      .in("id", ids);
    names = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.display_name || p.company_name]),
    );
  }
  return rows.map((r) => ({
    user_id: r.user_id,
    color: r.color,
    icon: r.icon,
    label: names[r.user_id] ?? "Participant",
  }));
}

export async function upsertCalendarParticipant(input: {
  user_id: string;
  color: string;
  icon: string;
}): Promise<void> {
  const { error } = await supabase
    .from("calendar_participants")
    .upsert({ user_id: input.user_id, color: input.color, icon: input.icon });
  if (error) throw error;
}
