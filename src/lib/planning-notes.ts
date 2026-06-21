import { supabase } from "@/integrations/supabase/client";

export type PlanningNote = {
  id: string;
  scheduled_date: string;
  title: string;
  details: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
};

export async function listPlanningNotes(): Promise<PlanningNote[]> {
  const { data, error } = await supabase
    .from("planning_notes")
    .select("id, scheduled_date, title, details, client_id, created_by, created_at")
    .order("scheduled_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanningNote[];
}

export async function createPlanningNote(input: {
  scheduled_date: string;
  title: string;
  details?: string | null;
  client_id?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("planning_notes").insert({
    scheduled_date: input.scheduled_date,
    title: input.title,
    details: input.details ?? null,
    client_id: input.client_id ?? null,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export async function deletePlanningNote(id: string): Promise<void> {
  const { error } = await supabase.from("planning_notes").delete().eq("id", id);
  if (error) throw error;
}
