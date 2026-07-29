import { supabase } from "@/integrations/supabase/client";

export type MissionStatus =
  | "planned"
  | "in_progress"
  | "done"
  | "done_with_issues"
  | "problem"
  | "impossible";

export const MISSION_STATUS_META: Record<MissionStatus, { label: string; tone: string }> = {
  planned: { label: "Planifiée", tone: "bg-slate-100 text-slate-700" },
  in_progress: { label: "En cours", tone: "bg-blue-100 text-blue-700" },
  done: { label: "Terminée", tone: "bg-emerald-100 text-emerald-700" },
  done_with_issues: { label: "Terminée avec remarques", tone: "bg-amber-100 text-amber-700" },
  problem: { label: "Problème rencontré", tone: "bg-orange-100 text-orange-700" },
  impossible: { label: "Impossible", tone: "bg-rose-100 text-rose-700" },
};

export interface Subcontractor {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  specialties: string[];
  hourly_rate: number | null;
  notes: string | null;
  active: boolean;
  default_service_types: string[];
  created_at: string;
  updated_at: string;
}

export type SubcontractorInput = Omit<Subcontractor, "id" | "user_id" | "created_at" | "updated_at">;

export interface SubcontractorMission {
  id: string;
  user_id: string;
  subcontractor_id: string;
  client_id: string | null;
  worksite_sheet_id: string | null;
  intervention_id: string | null;
  service_id: string | null;
  mission_date: string;
  service_requested: string;
  objective: string | null;
  context_notes: string | null;
  instructions: string | null;
  status: MissionStatus;
  report_notes: string | null;
  anomalies: string | null;
  recommendations: string | null;
  hours_spent: number | null;
  internal_rating: number | null;
  agreed_price: number | null;
  invoiced_amount: number | null;
  client_price: number | null;
  archived_at: string | null;
  payment_method: string | null;
  category: string | null;
  prestation: string | null;
  invoice_ref: string | null;
  hours_saved: number | null;
  autonomy: string | null;
  parallel_worksite: string | null;
  import_source: string | null;
  created_at: string;
  updated_at: string;
}

type MissionOptionalKeys =
  | "archived_at"
  | "payment_method"
  | "category"
  | "prestation"
  | "invoice_ref"
  | "hours_saved"
  | "autonomy"
  | "parallel_worksite"
  | "import_source";

export type MissionInput = Omit<
  SubcontractorMission,
  "id" | "user_id" | "created_at" | "updated_at" | MissionOptionalKeys
> &
  Partial<Pick<SubcontractorMission, MissionOptionalKeys>>;

export interface MissionPnl {
  mission_id: string;
  sst_cost: number;
  client_revenue: number;
  gross_margin: number;
  margin_pct: number | null;
}

export interface SubcontractorSummary {
  subcontractor_id: string;
  name: string;
  active: boolean;
  missions_count: number;
  missions_done: number;
  total_sst_cost: number;
  total_client_revenue: number;
  total_gross_margin: number;
  avg_rating: number | null;
  last_mission_date: string | null;
}

export async function listMissionPnl(): Promise<MissionPnl[]> {
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => { select: (c: string) => Promise<{ data: MissionPnl[] | null; error: unknown }> };
  })
    .from("v_sst_mission_pnl")
    .select("mission_id, sst_cost, client_revenue, gross_margin, margin_pct");
  if (error) throw error;
  return (data ?? []) as MissionPnl[];
}

export async function listSubcontractorSummary(): Promise<SubcontractorSummary[]> {
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => { select: (c: string) => Promise<{ data: SubcontractorSummary[] | null; error: unknown }> };
  })
    .from("v_sst_summary")
    .select("subcontractor_id, name, active, missions_count, missions_done, total_sst_cost, total_client_revenue, total_gross_margin, avg_rating, last_mission_date");
  if (error) throw error;
  return (data ?? []) as SubcontractorSummary[];
}

export interface MissionPhoto {
  id: string;
  user_id: string;
  mission_id: string;
  storage_path: string;
  caption: string | null;
  kind: "briefing" | "report";
  position: number;
  created_at: string;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

// ---- Subcontractors ----
export async function listSubcontractors(): Promise<Subcontractor[]> {
  const { data, error } = await supabase
    .from("subcontractors")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Subcontractor[];
}

export async function getSubcontractor(id: string): Promise<Subcontractor> {
  const { data, error } = await supabase.from("subcontractors").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Subcontractor;
}

export async function createSubcontractor(input: SubcontractorInput): Promise<Subcontractor> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("subcontractors")
    .insert({ ...input, user_id })
    .select()
    .single();
  if (error) throw error;
  return data as Subcontractor;
}

export async function updateSubcontractor(id: string, patch: Partial<SubcontractorInput>): Promise<void> {
  const { error } = await supabase.from("subcontractors").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSubcontractor(id: string): Promise<void> {
  const { error } = await supabase.from("subcontractors").delete().eq("id", id);
  if (error) throw error;
}

// ---- Missions ----
export async function listMissions(): Promise<SubcontractorMission[]> {
  const { data, error } = await supabase
    .from("subcontractor_missions")
    .select("*")
    .order("mission_date", { ascending: false });
  if (error) throw error;
  return data as SubcontractorMission[];
}

export async function listMissionsBySubcontractor(sstId: string): Promise<SubcontractorMission[]> {
  const { data, error } = await supabase
    .from("subcontractor_missions")
    .select("*")
    .eq("subcontractor_id", sstId)
    .order("mission_date", { ascending: false });
  if (error) throw error;
  return data as SubcontractorMission[];
}

export async function getMission(id: string): Promise<SubcontractorMission> {
  const { data, error } = await supabase.from("subcontractor_missions").select("*").eq("id", id).single();
  if (error) throw error;
  return data as SubcontractorMission;
}

export async function createMission(input: MissionInput): Promise<SubcontractorMission> {
  const user_id = await uid();
  const { data, error } = await supabase
    .from("subcontractor_missions")
    .insert({ ...input, user_id })
    .select()
    .single();
  if (error) throw error;
  return data as SubcontractorMission;
}

export async function updateMission(id: string, patch: Partial<MissionInput>): Promise<void> {
  const { error } = await supabase.from("subcontractor_missions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteMission(id: string): Promise<void> {
  const { error } = await supabase.from("subcontractor_missions").delete().eq("id", id);
  if (error) throw error;
}

// ---- Photos ----
export async function listMissionPhotos(missionId: string): Promise<MissionPhoto[]> {
  const { data, error } = await supabase
    .from("subcontractor_mission_photos")
    .select("*")
    .eq("mission_id", missionId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as MissionPhoto[];
}

export async function addMissionPhoto(
  missionId: string,
  file: File,
  kind: "briefing" | "report",
  caption?: string,
): Promise<MissionPhoto> {
  const user_id = await uid();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `sst/${user_id}/${missionId}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("chantier-photos").upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase
    .from("subcontractor_mission_photos")
    .insert({
      user_id,
      mission_id: missionId,
      storage_path: path,
      caption: caption ?? null,
      kind,
      position: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MissionPhoto;
}

export async function deleteMissionPhoto(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from("chantier-photos").remove([storagePath]);
  const { error } = await supabase.from("subcontractor_mission_photos").delete().eq("id", id);
  if (error) throw error;
}

export async function signedMissionPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("chantier-photos")
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}