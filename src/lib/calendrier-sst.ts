import { supabase } from "@/integrations/supabase/client";
import type { Intervention } from "@/lib/interventions";
import type { Subcontractor, SubcontractorMission } from "@/lib/subcontractors";
import type { Site } from "@/lib/sites";

export type SstAvailabilityStatus = "available" | "unavailable" | "partial" | "to_confirm";
export type SstRequestStatus = "pending" | "answered" | "expired" | "cancelled";
export type SstAssignmentStatus =
  | "to_plan"
  | "proposed"
  | "to_confirm"
  | "confirmed"
  | "in_progress"
  | "done"
  | "report_due"
  | "closed"
  | "cancelled"
  | "refused"
  | "verify";
export type SstConflictType =
  | "unavailable"
  | "overlap"
  | "outside_availability"
  | "understaffed"
  | "late_confirmation"
  | "missing_report";

export const AVAILABILITY_STATUS_LABEL: Record<SstAvailabilityStatus, string> = {
  available: "Disponible",
  unavailable: "Indisponible",
  partial: "Créneau limité",
  to_confirm: "À confirmer",
};

export const REQUEST_STATUS_LABEL: Record<SstRequestStatus, string> = {
  pending: "En attente",
  answered: "Répondue",
  expired: "Expirée",
  cancelled: "Annulée",
};

export const ASSIGNMENT_STATUS_LABEL: Record<SstAssignmentStatus, string> = {
  to_plan: "À planifier",
  proposed: "Proposée",
  to_confirm: "À confirmer",
  confirmed: "Confirmée",
  in_progress: "En intervention",
  done: "Intervention faite",
  report_due: "CR à compléter",
  closed: "Clôturée",
  cancelled: "Annulée",
  refused: "Refusée",
  verify: "À vérifier",
};

export interface SstUserLink {
  id: string;
  user_id: string;
  subcontractor_id: string;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SstAvailability {
  id: string;
  subcontractor_id: string;
  availability_date: string;
  start_time: string | null;
  end_time: string | null;
  status: SstAvailabilityStatus;
  comment: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SstAvailabilityRequest {
  id: string;
  created_by: string;
  start_date: string;
  end_date: string;
  intervention_type: string | null;
  comment: string | null;
  response_deadline: string | null;
  status: SstRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface SstAvailabilityRequestTarget {
  id: string;
  request_id: string;
  subcontractor_id: string;
  status: SstRequestStatus;
  response_comment: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SstInterventionAssignment {
  id: string;
  intervention_id: string | null;
  mission_id: string | null;
  subcontractor_id: string;
  required_people: number;
  starts_at: string | null;
  ends_at: string | null;
  status: SstAssignmentStatus;
  planning_comment: string | null;
  response_comment: string | null;
  proposed_at: string | null;
  responded_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SstCalendarSettings {
  id: boolean;
  availability_horizon_months: number;
  reminder_lead_months: number;
  confirmation_deadline_days: number;
  intervention_reminder_days: number;
  notifications_enabled: boolean;
  shared_view_options: Record<string, unknown>;
  colors: Record<string, unknown>;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SstCalendarConflict {
  id: string;
  conflict_type: SstConflictType;
  severity: "warning" | "critical";
  subcontractor_id: string | null;
  intervention_id: string | null;
  mission_id: string | null;
  assignment_id: string | null;
  conflict_date: string | null;
  message: string;
  status: "open" | "acknowledged" | "resolved";
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SstCalendarData {
  subcontractors: Subcontractor[];
  availabilities: SstAvailability[];
  requests: SstAvailabilityRequest[];
  requestTargets: SstAvailabilityRequestTarget[];
  assignments: SstInterventionAssignment[];
  conflicts: SstCalendarConflict[];
  settings: SstCalendarSettings | null;
  interventions: Intervention[];
  missions: SubcontractorMission[];
  clients: Array<{ id: string; name: string; address: string | null }>;
  sites: Site[];
  userLinks: SstUserLink[];
}

export interface SstComputedConflict {
  key: string;
  type: SstConflictType;
  severity: "warning" | "critical";
  subcontractor_id: string | null;
  assignment_id: string | null;
  conflict_date: string | null;
  message: string;
}

type UntypedSupabase = {
  from: (table: string) => {
    select: (columns?: string) => QueryBuilder;
    insert: (values: unknown) => QueryBuilder;
    update: (values: unknown) => QueryBuilder;
    delete: () => QueryBuilder;
  };
};

type QueryBuilder = {
  select: (columns?: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  gte: (column: string, value: unknown) => QueryBuilder;
  lte: (column: string, value: unknown) => QueryBuilder;
  is: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  then: Promise<{ data: unknown; error: unknown }>["then"];
};

const db = supabase as unknown as UntypedSupabase;

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthWindow(date = new Date()): { start: string; end: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

export function addDaysIso(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export async function listSstCalendarData(startDate: string, endDate: string): Promise<SstCalendarData> {
  const [
    subcontractors,
    availabilities,
    requests,
    requestTargets,
    assignments,
    conflicts,
    settings,
    interventions,
    missions,
    clients,
    sites,
    userLinks,
  ] = await Promise.all([
    db.from("subcontractors").select("*").order("name", { ascending: true }),
    db.from("sst_availabilities").select("*").gte("availability_date", startDate).lte("availability_date", endDate).order("availability_date", { ascending: true }),
    db.from("sst_availability_requests").select("*").gte("end_date", startDate).lte("start_date", endDate).order("created_at", { ascending: false }),
    db.from("sst_availability_request_targets").select("*").order("created_at", { ascending: false }),
    db.from("sst_intervention_assignments").select("*").order("starts_at", { ascending: true }),
    db.from("sst_calendar_conflicts").select("*").order("created_at", { ascending: false }),
    db.from("sst_calendar_settings").select("*").eq("id", true).maybeSingle(),
    db.from("interventions").select("*").gte("intervention_date", startDate).lte("intervention_date", endDate).order("intervention_date", { ascending: true }),
    db.from("subcontractor_missions").select("*").gte("mission_date", startDate).lte("mission_date", endDate).order("mission_date", { ascending: true }),
    db.from("clients").select("id,name,address").order("name", { ascending: true }),
    db.from("sites").select("id,client_id,name,address,status,is_primary,notes,latitude,longitude").order("name", { ascending: true }),
    db.from("sst_user_links").select("*").eq("active", true),
  ]);

  const results = [
    subcontractors,
    availabilities,
    requests,
    requestTargets,
    assignments,
    conflicts,
    interventions,
    missions,
    clients,
    sites,
    userLinks,
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  if (settings.error) throw settings.error;

  return {
    subcontractors: (subcontractors.data ?? []) as Subcontractor[],
    availabilities: (availabilities.data ?? []) as SstAvailability[],
    requests: (requests.data ?? []) as SstAvailabilityRequest[],
    requestTargets: (requestTargets.data ?? []) as SstAvailabilityRequestTarget[],
    assignments: (assignments.data ?? []) as SstInterventionAssignment[],
    conflicts: (conflicts.data ?? []) as SstCalendarConflict[],
    settings: (settings.data ?? null) as SstCalendarSettings | null,
    interventions: (interventions.data ?? []) as Intervention[],
    missions: (missions.data ?? []) as SubcontractorMission[],
    clients: (clients.data ?? []) as Array<{ id: string; name: string; address: string | null }>,
    sites: (sites.data ?? []) as Site[],
    userLinks: (userLinks.data ?? []) as SstUserLink[],
  };
}

export async function createSstAvailability(input: {
  subcontractor_id: string;
  availability_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: SstAvailabilityStatus;
  comment?: string | null;
}): Promise<SstAvailability> {
  const { data, error } = await db.from("sst_availabilities").insert(cleanPayload(input)).select("*").single();
  if (error) throw error;
  return data as SstAvailability;
}

export async function updateSstAvailability(id: string, patch: Partial<Pick<SstAvailability, "status" | "start_time" | "end_time" | "comment">>): Promise<void> {
  const { error } = await db.from("sst_availabilities").update(cleanPayload(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteSstAvailability(id: string): Promise<void> {
  const { error } = await db.from("sst_availabilities").delete().eq("id", id);
  if (error) throw error;
}

export async function createAvailabilityRequest(input: {
  start_date: string;
  end_date: string;
  response_deadline?: string | null;
  intervention_type?: string | null;
  comment?: string | null;
  subcontractor_ids: string[];
}): Promise<SstAvailabilityRequest> {
  if (input.subcontractor_ids.length === 0) throw new Error("Sélectionnez au moins un SST.");
  const { subcontractor_ids, ...requestInput } = input;
  const { data, error } = await db
    .from("sst_availability_requests")
    .insert(cleanPayload({ ...requestInput, status: "pending" }))
    .select("*")
    .single();
  if (error) throw error;
  const request = data as SstAvailabilityRequest;
  const targets = subcontractor_ids.map((subcontractor_id) => ({ request_id: request.id, subcontractor_id }));
  const targetResult = await db.from("sst_availability_request_targets").insert(targets).select("id");
  if (targetResult.error) throw targetResult.error;
  return request;
}

export async function answerAvailabilityRequestTarget(id: string, response_comment?: string | null): Promise<void> {
  const { error } = await db
    .from("sst_availability_request_targets")
    .update(cleanPayload({ status: "answered", response_comment: response_comment ?? null }))
    .eq("id", id);
  if (error) throw error;
}

export async function createSstAssignment(input: {
  intervention_id?: string | null;
  mission_id?: string | null;
  subcontractor_id: string;
  starts_at?: string | null;
  ends_at?: string | null;
  required_people?: number;
  planning_comment?: string | null;
}): Promise<SstInterventionAssignment> {
  const hasIntervention = Boolean(input.intervention_id);
  const hasMission = Boolean(input.mission_id);
  if (hasIntervention === hasMission) throw new Error("Sélectionnez une intervention ou une mission SST.");
  const { data, error } = await db
    .from("sst_intervention_assignments")
    .insert(cleanPayload({ ...input, status: "proposed", proposed_at: new Date().toISOString() }))
    .select("*")
    .single();
  if (error) throw error;
  return data as SstInterventionAssignment;
}

export async function updateSstAssignmentStatus(id: string, status: SstAssignmentStatus): Promise<void> {
  const { error } = await db.from("sst_intervention_assignments").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function answerSstAssignment(id: string, status: Extract<SstAssignmentStatus, "confirmed" | "refused" | "verify" | "to_confirm">, response_comment?: string | null): Promise<void> {
  const { error } = await db
    .from("sst_intervention_assignments")
    .update(cleanPayload({ status, response_comment: response_comment ?? null }))
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSstAssignment(id: string): Promise<void> {
  const { error } = await db.from("sst_intervention_assignments").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSstCalendarSettings(patch: Partial<Pick<SstCalendarSettings, "availability_horizon_months" | "reminder_lead_months" | "confirmation_deadline_days" | "intervention_reminder_days" | "notifications_enabled">>): Promise<void> {
  const { error } = await db.from("sst_calendar_settings").update(cleanPayload(patch)).eq("id", true);
  if (error) throw error;
}

export async function updateSstConflictStatus(id: string, status: "acknowledged" | "resolved"): Promise<void> {
  const { error } = await db
    .from("sst_calendar_conflicts")
    .update(cleanPayload({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null }))
    .eq("id", id);
  if (error) throw error;
}

export function latestAvailabilityBySubcontractor(availabilities: SstAvailability[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of availabilities) {
    const previous = out.get(row.subcontractor_id);
    if (!previous || row.availability_date > previous) out.set(row.subcontractor_id, row.availability_date);
  }
  return out;
}

export function availabilitiesForDate(availabilities: SstAvailability[], date: string): SstAvailability[] {
  return availabilities.filter((row) => row.availability_date === date);
}

export function assignmentsForDate(assignments: SstInterventionAssignment[], date: string): SstInterventionAssignment[] {
  return assignments.filter((assignment) => assignmentDate(assignment) === date);
}

export function assignmentDate(assignment: SstInterventionAssignment): string | null {
  return assignment.starts_at?.slice(0, 10) ?? null;
}

export function detectSstCalendarConflicts(params: {
  assignments: SstInterventionAssignment[];
  availabilities: SstAvailability[];
  missions: SubcontractorMission[];
}): SstComputedConflict[] {
  const out: SstComputedConflict[] = [];
  const activeAssignments = params.assignments.filter((assignment) =>
    ["proposed", "to_confirm", "confirmed", "in_progress", "report_due"].includes(assignment.status),
  );

  for (const assignment of activeAssignments) {
    const date = assignmentDate(assignment);
    if (!date) continue;
    const dayAvailabilities = params.availabilities.filter(
      (row) => row.subcontractor_id === assignment.subcontractor_id && row.availability_date === date,
    );
    if (dayAvailabilities.some((row) => row.status === "unavailable")) {
      out.push({
        key: `unavailable:${assignment.id}`,
        type: "unavailable",
        severity: "critical",
        subcontractor_id: assignment.subcontractor_id,
        assignment_id: assignment.id,
        conflict_date: date,
        message: "SST affecté sur une journée déclarée indisponible.",
      });
    }
    if (assignment.starts_at && assignment.ends_at) {
      const partials = dayAvailabilities.filter((row) => row.status === "partial" && row.start_time && row.end_time);
      if (partials.length > 0 && !partials.some((row) => fitsAvailability(assignment, row))) {
        out.push({
          key: `outside:${assignment.id}`,
          type: "outside_availability",
          severity: "warning",
          subcontractor_id: assignment.subcontractor_id,
          assignment_id: assignment.id,
          conflict_date: date,
          message: "Créneau proposé hors disponibilité partielle renseignée.",
        });
      }
    }
  }

  for (let i = 0; i < activeAssignments.length; i += 1) {
    const current = activeAssignments[i];
    if (!current?.starts_at || !current.ends_at) continue;
    for (let j = i + 1; j < activeAssignments.length; j += 1) {
      const other = activeAssignments[j];
      if (!other?.starts_at || !other.ends_at) continue;
      if (current.subcontractor_id !== other.subcontractor_id) continue;
      if (intervalsOverlap(current.starts_at, current.ends_at, other.starts_at, other.ends_at)) {
        out.push({
          key: `overlap:${current.id}:${other.id}`,
          type: "overlap",
          severity: "critical",
          subcontractor_id: current.subcontractor_id,
          assignment_id: current.id,
          conflict_date: assignmentDate(current),
          message: "Deux propositions SST se chevauchent sur le même créneau.",
        });
      }
    }
  }

  for (const mission of params.missions) {
    if (["done", "done_with_issues", "problem"].includes(mission.status) && !mission.report_notes?.trim()) {
      out.push({
        key: `missing-report:${mission.id}`,
        type: "missing_report",
        severity: "warning",
        subcontractor_id: mission.subcontractor_id,
        assignment_id: null,
        conflict_date: mission.mission_date,
        message: "Mission SST terminée sans compte-rendu renseigné.",
      });
    }
  }

  return out;
}

function fitsAvailability(assignment: SstInterventionAssignment, availability: SstAvailability): boolean {
  if (!assignment.starts_at || !assignment.ends_at || !availability.start_time || !availability.end_time) return true;
  const start = assignment.starts_at.slice(11, 16);
  const end = assignment.ends_at.slice(11, 16);
  return start >= availability.start_time.slice(0, 5) && end <= availability.end_time.slice(0, 5);
}

function intervalsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(startB).getTime() < new Date(endA).getTime();
}

function cleanPayload<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}
