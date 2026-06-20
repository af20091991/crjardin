import { supabase } from "@/integrations/supabase/client";

export interface ReportTemplate {
  id: string;
  user_id: string;
  name: string;
  intervention_type: string | null;
  tasks: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listTemplates(): Promise<ReportTemplate[]> {
  const { data, error } = await supabase
    .from("report_templates")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as unknown[]).map(normalize);
}

function normalize(row: unknown): ReportTemplate {
  const r = row as Record<string, unknown>;
  return {
    ...(r as object),
    tasks: Array.isArray(r.tasks) ? (r.tasks as string[]) : [],
  } as ReportTemplate;
}

export async function addTemplate(input: { name: string; intervention_type?: string | null; tasks: string[]; summary?: string | null }): Promise<ReportTemplate> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("report_templates")
    .insert({
      user_id,
      name: input.name,
      intervention_type: input.intervention_type ?? null,
      tasks: input.tasks,
      summary: input.summary ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("report_templates").delete().eq("id", id);
  if (error) throw error;
}
