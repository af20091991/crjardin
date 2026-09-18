import { supabase } from "@/integrations/supabase/client";

export type EquipmentCategory = "vehicule" | "engin" | "batterie" | "smartphone" | "autre";
export type EquipmentStatus = "en_service" | "en_panne" | "en_reparation" | "hors_service";

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  vehicule: "Véhicule",
  engin: "Engin motorisé",
  batterie: "Batterie",
  smartphone: "Smartphone",
  autre: "Autre",
};

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  en_service: "En service",
  en_panne: "En panne",
  en_reparation: "En réparation",
  hors_service: "Hors service",
};

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  custom_category: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  amortization_years: number | null;
  status: EquipmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentMaintenance {
  id: string;
  equipment_id: string;
  maintenance_date: string;
  description: string;
  cost: number | null;
  next_due_date: string | null;
  reminder_sent_at: string | null;
  created_at: string;
}

/** Libellé de catégorie à afficher (gère la catégorie personnalisée). */
export function categoryLabel(equipment: Pick<Equipment, "category" | "custom_category">): string {
  if (equipment.category === "autre" && equipment.custom_category) return equipment.custom_category;
  return EQUIPMENT_CATEGORY_LABELS[equipment.category];
}

/** Valeur actuelle d'un équipement (amortissement linéaire). Jamais négative. */
export function currentValue(
  equipment: Pick<Equipment, "purchase_cost" | "purchase_date" | "amortization_years">,
): number | null {
  const { purchase_cost, purchase_date, amortization_years } = equipment;
  if (!purchase_cost || !purchase_date || !amortization_years || amortization_years <= 0)
    return null;
  const years = (Date.now() - new Date(purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const remaining = 1 - Math.min(Math.max(years, 0), amortization_years) / amortization_years;
  return Math.round(purchase_cost * remaining * 100) / 100;
}

export type MaintenanceUrgency = "overdue" | "soon" | "ok" | "none";

/** Urgence d'entretien à partir de la prochaine échéance. */
export function maintenanceUrgency(
  nextDueDate: string | null,
  withinDays = 30,
): MaintenanceUrgency {
  if (!nextDueDate) return "none";
  const days = (new Date(nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "overdue";
  if (days <= withinDays) return "soon";
  return "ok";
}

export async function listEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase
    .from("equipment")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Equipment[];
}

export async function getEquipment(id: string): Promise<Equipment> {
  const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Equipment;
}

export interface EquipmentInput {
  name: string;
  category: EquipmentCategory;
  custom_category?: string | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  amortization_years?: number | null;
  status?: EquipmentStatus;
  notes?: string | null;
}

export async function createEquipment(input: EquipmentInput): Promise<Equipment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Utilisateur non authentifié");

  const { data, error } = await supabase
    .from("equipment")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Equipment;
}

export async function updateEquipment(
  id: string,
  input: Partial<EquipmentInput>,
): Promise<Equipment> {
  const { data, error } = await supabase
    .from("equipment")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Equipment;
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) throw error;
}

export async function listMaintenanceFor(equipmentId: string): Promise<EquipmentMaintenance[]> {
  const { data, error } = await supabase
    .from("equipment_maintenance")
    .select("*")
    .eq("equipment_id", equipmentId)
    .order("maintenance_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EquipmentMaintenance[];
}

/** Toutes les échéances d'entretien à venir/en retard, tous équipements confondus (pour la vue d'ensemble). */
export async function listUpcomingMaintenance(): Promise<
  (EquipmentMaintenance & { equipment_name: string })[]
> {
  const { data, error } = await supabase
    .from("equipment_maintenance")
    .select("*, equipment:equipment_id(name)")
    .not("next_due_date", "is", null)
    .order("next_due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: EquipmentMaintenance & { equipment: { name: string } | null }) => ({
    ...row,
    equipment_name: row.equipment?.name ?? "—",
  }));
}

export interface MaintenanceInput {
  equipment_id: string;
  maintenance_date: string;
  description: string;
  cost?: number | null;
  next_due_date?: string | null;
}


export async function createMaintenance(input: MaintenanceInput): Promise<EquipmentMaintenance> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Utilisateur non authentifié");
  const { data, error } = await supabase.from("equipment_maintenance").insert({ ...input, user_id: userId }).select("*").single();
  if (error) throw error;
  return data as EquipmentMaintenance;
}

export interface EquipmentType {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceType {
  id: string;
  user_id: string;
  name: string;
  interval_months: number;
  reminder_days: number;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  equipment_id: string;
  maintenance_type_id: string;
  last_completed_date: string | null;
  next_due_date: string;
  last_maintenance_id: string | null;
  maintenance_type_name: string;
  reminder_days: number;
}

export async function listEquipmentTypes(): Promise<EquipmentType[]> {
  const { data, error } = await supabase.from("equipment_types").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as EquipmentType[];
}

export async function createEquipmentType(name: string): Promise<EquipmentType> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utilisateur non authentifié");
  const { data, error } = await supabase.from("equipment_types").insert({ name: name.trim(), user_id: userData.user.id }).select("*").single();
  if (error) throw error;
  return data as EquipmentType;
}

export async function listMaintenanceTypes(): Promise<MaintenanceType[]> {
  const { data, error } = await supabase.from("maintenance_types").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as MaintenanceType[];
}

export async function createMaintenanceType(input: { name: string; interval_months: number; reminder_days: number }): Promise<MaintenanceType> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utilisateur non authentifié");
  const { data, error } = await supabase.from("maintenance_types").insert({ ...input, name: input.name.trim(), user_id: userData.user.id }).select("*").single();
  if (error) throw error;
  return data as MaintenanceType;
}

export async function setEquipmentTypeMaintenanceTypes(equipmentTypeId: string, maintenanceTypeIds: string[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utilisateur non authentifié");
  const userId = userData.user.id;
  const { error: deleteError } = await supabase.from("equipment_type_maintenance_types").delete().eq("equipment_type_id", equipmentTypeId).eq("user_id", userId);
  if (deleteError) throw deleteError;
  if (maintenanceTypeIds.length) {
    const { error } = await supabase.from("equipment_type_maintenance_types").insert(
      maintenanceTypeIds.map((maintenanceTypeId) => ({ equipment_type_id: equipmentTypeId, maintenance_type_id: maintenanceTypeId, user_id: userId })),
    );
    if (error) throw error;
  }
}

export async function syncEquipmentMaintenanceSchedules(equipmentId: string): Promise<void> {
  const { error } = await supabase.rpc("sync_equipment_maintenance_schedules", { p_equipment_id: equipmentId });
  if (error) throw error;
}

export async function listMaintenanceSchedules(equipmentId?: string): Promise<MaintenanceSchedule[]> {
  let query = supabase
    .from("equipment_maintenance_schedules")
    .select("*, maintenance_type:maintenance_type_id(name, reminder_days)")
    .order("next_due_date", { ascending: true });
  if (equipmentId) query = query.eq("equipment_id", equipmentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    maintenance_type_name: row.maintenance_type?.name ?? "Entretien",
    reminder_days: row.maintenance_type?.reminder_days ?? 14,
  })) as MaintenanceSchedule[];
}

export async function completeMaintenanceSchedule(scheduleId: string, maintenanceDate: string, cost?: number | null): Promise<EquipmentMaintenance> {
  const { data, error } = await supabase.rpc("complete_equipment_maintenance", {
    p_schedule_id: scheduleId,
    p_maintenance_date: maintenanceDate,
    p_cost: cost ?? null,
  });
  if (error) throw error;
  return data as EquipmentMaintenance;
}
