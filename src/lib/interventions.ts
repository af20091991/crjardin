import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "realise" | "partiel" | "reporte" | "impossible";
export type InterventionStatus = "brouillon" | "terminee";

export interface ReportSections {
  summary: boolean;
  worksite: boolean;
  tasks: boolean;
  positive_points: boolean;
  attention_points: boolean;
  garden_evolution: boolean;
  garden_state: boolean;
  recommendations: boolean;
  upcoming: boolean;
  photos: boolean;
}

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  summary: true,
  worksite: true,
  tasks: true,
  positive_points: true,
  attention_points: true,
  garden_evolution: true,
  garden_state: true,
  recommendations: true,
  upcoming: true,
  photos: true,
};

export const REPORT_SECTION_LABELS: Record<keyof ReportSections, string> = {
  summary: "Synthèse de l'intervention",
  worksite: "Fiche jardin",
  tasks: "Travaux réalisés",
  positive_points: "Points positifs",
  attention_points: "Points de vigilance",
  garden_evolution: "Évolution du jardin",
  garden_state: "État du jardin",
  recommendations: "Préconisations & conseils",
  upcoming: "Prochaine intervention",
  photos: "Photos",
};

export function normalizeReportSections(raw: unknown): ReportSections {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ReportSections, unknown>>;
  const out = { ...DEFAULT_REPORT_SECTIONS };
  (Object.keys(DEFAULT_REPORT_SECTIONS) as (keyof ReportSections)[]).forEach((k) => {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  });
  return out;
}

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
  sent_pdf_storage_path?: string | null;
  worksite_sheet_id?: string | null;
  positive_points?: string | null;
  attention_points?: string | null;
  garden_evolution?: string | null;
  report_sections?: ReportSections | null;
  ai_metadata?: Record<string, unknown> | null;
  hours_spent?: number | null;
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
  service_id?: string | null;
}

export interface ServiceCatalogItem {
  id: string;
  label: string;
  category_id: string | null;
  category_code: string | null;
  category_label: string | null;
}

export async function listServiceCatalog(): Promise<ServiceCatalogItem[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, label, category_id, is_archived, service_categories(code, label)")
    .eq("is_archived", false)
    .order("label", { ascending: true });
  if (error) throw error;
  type Row = {
    id: string;
    label: string;
    category_id: string | null;
    service_categories: { code: string | null; label: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    label: r.label,
    category_id: r.category_id,
    category_code: r.service_categories?.code ?? null,
    category_label: r.service_categories?.label ?? null,
  }));
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
  patch: Partial<Pick<Intervention,
    "client_id" | "intervention_date" | "intervention_type" | "status"
    | "summary" | "garden_state" | "upcoming_works" | "recommendations_text"
    | "worksite_sheet_id" | "sent_pdf_storage_path" | "sent_to_client_at"
    | "positive_points" | "attention_points" | "garden_evolution"
    | "report_sections" | "hours_spent" | "ai_metadata"
  >>,
): Promise<Intervention> {
  const { data, error } = await supabase
    .from("interventions")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Intervention;
}

/**
 * Estime le nombre d'heures passées sur une intervention à partir des tâches
 * et de la durée standard de leur prestation catalogue. Fallback : 0,5 h/tâche
 * (minimum 1 h). Retourne un nombre arrondi au quart d'heure.
 */
export async function estimateHoursSpent(interventionId: string): Promise<number> {
  const { data: tasksData } = await supabase
    .from("intervention_tasks")
    .select("service_id, status")
    .eq("intervention_id", interventionId);
  const tasks = (tasksData ?? []) as Array<{ service_id: string | null; status: string }>;
  const active = tasks.filter((t) => t.status !== "impossible" && t.status !== "reporte");
  if (active.length === 0) return 1;

  const serviceIds = Array.from(new Set(active.map((t) => t.service_id).filter((v): v is string => !!v)));
  const durations = new Map<string, number>();
  if (serviceIds.length > 0) {
    const { data: svcData } = await supabase
      .from("services")
      .select("id, standard_duration_hours")
      .in("id", serviceIds);
    for (const s of (svcData ?? []) as Array<{ id: string; standard_duration_hours: number | null }>) {
      if (typeof s.standard_duration_hours === "number") durations.set(s.id, s.standard_duration_hours);
    }
  }

  let total = 0;
  for (const t of active) {
    const d = t.service_id ? durations.get(t.service_id) : undefined;
    const base = typeof d === "number" && d > 0 ? d : 0.5;
    const factor = t.status === "partiel" ? 0.5 : 1;
    total += base * factor;
  }
  const rounded = Math.round(total * 4) / 4;
  return Math.max(1, rounded);
}

/**
 * Clôture une intervention en préremplissant hours_spent s'il est vide.
 * Marque la valeur comme "estimée" dans ai_metadata.hours_spent_estimated.
 */
export async function completeInterventionWithHoursAutofill(
  intervention: Intervention,
): Promise<Intervention> {
  if (intervention.hours_spent != null && intervention.hours_spent > 0) {
    return updateIntervention(intervention.id, { status: "terminee" });
  }
  const estimated = await estimateHoursSpent(intervention.id);
  const meta = { ...(intervention.ai_metadata ?? {}), hours_spent_estimated: true, hours_spent_estimated_at: new Date().toISOString() };
  return updateIntervention(intervention.id, {
    status: "terminee",
    hours_spent: estimated,
    ai_metadata: meta,
  });
}

/**
 * Enregistre une valeur d'heures confirmée par l'utilisateur.
 * Supprime le flag "estimé" dans ai_metadata.
 */
export async function confirmHoursSpent(
  intervention: Intervention,
  hours: number,
): Promise<Intervention> {
  const prev = { ...(intervention.ai_metadata ?? {}) } as Record<string, unknown>;
  delete prev.hours_spent_estimated;
  delete prev.hours_spent_estimated_at;
  return updateIntervention(intervention.id, {
    hours_spent: hours,
    ai_metadata: prev,
  });
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

export async function addTask(
  interventionId: string,
  label: string,
  position: number,
  serviceId?: string | null,
): Promise<InterventionTask> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("intervention_tasks")
    .insert({
      intervention_id: interventionId,
      user_id,
      label,
      status: "realise",
      position,
      service_id: serviceId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InterventionTask;
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<InterventionTask, "label" | "status" | "note" | "service_id">>,
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
  patch: Partial<Pick<InterventionPhoto, "caption" | "include_in_report" | "position">>,
): Promise<void> {
  const { error } = await supabase.from("intervention_photos").update(patch).eq("id", id);
  if (error) throw error;
}

/** Réordonne les photos d'une intervention selon l'ordre transmis. */
export async function reorderPhotos(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, position) =>
      supabase.from("intervention_photos").update({ position }).eq("id", id),
    ),
  );
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
