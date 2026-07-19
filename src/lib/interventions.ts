import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "realise" | "partiel" | "reporte" | "impossible";
export type InterventionStatus = "brouillon" | "termine";

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; tone: string; short: string }
> = {
  realise: { label: "Réalisé", tone: "text-emerald-700 bg-emerald-100", short: "OK" },
  partiel: { label: "Partiel", tone: "text-amber-700 bg-amber-100", short: "Partiel" },
  reporte: { label: "Reporté", tone: "text-blue-700 bg-blue-100", short: "Reporté" },
  impossible: { label: "Impossible", tone: "text-rose-700 bg-rose-100", short: "Impossible" },
};

export const INTERVENTION_TYPES = [
  "Entretien courant",
  "Tonte / Pelouse",
  "Taille de haies",
  "Élagage / Taille d'arbres",
  "Désherbage",
  "Plantation",
  "Massifs & fleurissement",
  "Nettoyage / Évacuation",
  "Traitement / Soin",
  "Arrosage / Irrigation",
] as const;

export const COMMON_TASKS = [
  "Tonte de la pelouse",
  "Taille des haies",
  "Désherbage des massifs",
  "Taille des arbustes",
  "Ramassage des feuilles",
  "Nettoyage des allées",
  "Évacuation des déchets verts",
  "Arrosage / contrôle irrigation",
  "Binage et paillage",
  "Traitement phytosanitaire",
  "Tonte des bordures",
  "Soufflage des terrasses",
] as const;

export interface Intervention {
  id: string;
  client_id: string;
  user_id: string;
  intervention_date: string;
  intervention_type: string | null;
  status: string;
  title: string | null;
  reference: string | null;
  summary: string | null;
  garden_state: string | null;
  upcoming_works: string | null;
  recommendations_text: string | null;
  client_read_at: string | null;
  client_read_count: number;
  created_at: string;
  updated_at: string;
  pdf_storage_path?: string | null;
  report_generated_at?: string | null;
  sent_to_client_at?: string | null;
}

export interface InterventionTask {
  id: string;
  intervention_id: string;
  user_id: string;
  label: string;
  status: string;
  note: string | null;
  position: number;
  created_at: string;
}

export interface InterventionPhoto {
  id: string;
  intervention_id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  include_in_report: boolean;
  position: number;
  created_at: string;
  lat?: number | null;
  lng?: number | null;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listInterventionsByClient(clientId: string): Promise<Intervention[]> {
  const { data, error } = await supabase
    .from("interventions")
    .select("*")
    .eq("client_id", clientId)
    .order("intervention_date", { ascending: false });
  if (error) throw error;
  return data as Intervention[];
}

export async function listAllInterventions(): Promise<Intervention[]> {
  const { data, error } = await supabase
    .from("interventions")
    .select("*")
    .order("intervention_date", { ascending: false });
  if (error) throw error;
  return data as Intervention[];
}

export async function getIntervention(id: string): Promise<Intervention> {
  const { data, error } = await supabase.from("interventions").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Intervention;
}

export async function createIntervention(input: {
  client_id: string;
  intervention_date: string;
  intervention_type?: string | null;
  tasks?: string[];
}): Promise<Intervention> {
  const user_id = await uid();

  // Auto reference (CR-YYYY-NNNNN) via secure DB function
  let reference: string | null = null;
  try {
    const { data: ref } = await supabase.rpc("next_intervention_reference");
    reference = (ref as string | null) ?? null;
  } catch {
    reference = null;
  }

  // Auto title: "<Client> — <Type> · <Mois Année>"
  let title: string | null = null;
  try {
    const { data: cli } = await supabase
      .from("clients")
      .select("name")
      .eq("id", input.client_id)
      .single();
    title = buildInterventionTitle(cli?.name ?? "Client", input.intervention_type ?? null, input.intervention_date);
  } catch {
    title = null;
  }

  const { data, error } = await supabase
    .from("interventions")
    .insert({
      client_id: input.client_id,
      user_id,
      intervention_date: input.intervention_date,
      intervention_type: input.intervention_type ?? null,
      status: "brouillon",
      title,
      reference,
    })
    .select()
    .single();
  if (error) throw error;
  const intervention = data as Intervention;

  if (input.tasks && input.tasks.length > 0) {
    const rows = input.tasks.map((label, i) => ({
      intervention_id: intervention.id,
      user_id,
      label,
      status: "realise",
      position: i,
    }));
    const { error: tErr } = await supabase.from("intervention_tasks").insert(rows);
    if (tErr) throw tErr;
  }
  return intervention;
}

export function buildInterventionTitle(
  clientName: string,
  type: string | null,
  dateStr: string,
): string {
  const month = new Date(dateStr).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const cap = month.charAt(0).toUpperCase() + month.slice(1);
  const t = type?.trim() ? type.trim() : "Entretien";
  return `${clientName} — ${t} · ${cap}`;
}

export async function updateIntervention(
  id: string,
  patch: Partial<Pick<Intervention, "client_id" | "intervention_date" | "intervention_type" | "status" | "summary" | "garden_state" | "upcoming_works" | "recommendations_text">>,
): Promise<Intervention> {
  const { data, error } = await supabase
    .from("interventions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Intervention;
}

export async function deleteIntervention(id: string): Promise<void> {
  await supabase.from("intervention_tasks").delete().eq("intervention_id", id);
  await supabase.from("intervention_photos").delete().eq("intervention_id", id);
  const { error } = await supabase.from("interventions").delete().eq("id", id);
  if (error) throw error;
}

// ---- Tasks ----
export async function listTasks(interventionId: string): Promise<InterventionTask[]> {
  const { data, error } = await supabase
    .from("intervention_tasks")
    .select("*")
    .eq("intervention_id", interventionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as InterventionTask[];
}

export async function addTask(interventionId: string, label: string, position: number): Promise<InterventionTask> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("intervention_tasks")
    .insert({ intervention_id: interventionId, user_id, label, status: "realise", position })
    .select()
    .single();
  if (error) throw error;
  return data as InterventionTask;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<InterventionTask, "label" | "status" | "note">>,
): Promise<void> {
  const { error } = await supabase.from("intervention_tasks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("intervention_tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---- Photos ----
export async function listPhotos(interventionId: string): Promise<InterventionPhoto[]> {
  const { data, error } = await supabase
    .from("intervention_photos")
    .select("*")
    .eq("intervention_id", interventionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as InterventionPhoto[];
}

export async function addPhoto(
  interventionId: string,
  storagePath: string,
  position: number,
  coords?: { lat: number; lng: number } | null,
): Promise<InterventionPhoto> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("intervention_photos")
    .insert({
      intervention_id: interventionId, user_id, storage_path: storagePath, position,
      include_in_report: true, lat: coords?.lat ?? null, lng: coords?.lng ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InterventionPhoto;
}

export async function updatePhoto(
  id: string,
  patch: Partial<Pick<InterventionPhoto, "caption" | "include_in_report">>,
): Promise<void> {
  const { error } = await supabase.from("intervention_photos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePhoto(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from("chantier-photos").remove([storagePath]);
  const { error } = await supabase.from("intervention_photos").delete().eq("id", id);
  if (error) throw error;
}

export async function signedPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("chantier-photos")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
