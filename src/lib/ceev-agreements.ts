// Module CEEV opérationnel : contrats d'entretien des espaces verts.
// Aucun rapprochement automatique : le client est toujours choisi explicitement
// dans le référentiel client existant (clients.id).
import { supabase } from "@/integrations/supabase/client";

export type CeevStatus = "actif" | "a_renouveler" | "termine" | "suspendu";
export type CeevFrequency = "mensuelle" | "trimestrielle" | "personnalisee";
export type CeevEventType = "creation" | "modification" | "renouvellement" | "archivage";

export const CEEV_STATUS_META: Record<CeevStatus, { label: string; badge: string }> = {
  actif: { label: "Actif", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  a_renouveler: { label: "À renouveler", badge: "border-orange-200 bg-orange-50 text-orange-700" },
  termine: { label: "Terminé", badge: "border-border bg-muted text-muted-foreground" },
  suspendu: { label: "Suspendu", badge: "border-sky-200 bg-sky-50 text-sky-700" },
};

export const CEEV_FREQUENCY_META: Record<CeevFrequency, { label: string; months: number | null }> = {
  mensuelle: { label: "Mensuelle", months: 1 },
  trimestrielle: { label: "Trimestrielle", months: 3 },
  personnalisee: { label: "Personnalisée", months: null },
};

export const CEEV_EVENT_LABEL: Record<CeevEventType, string> = {
  creation: "Création",
  modification: "Modification",
  renouvellement: "Renouvellement",
  archivage: "Archivage",
};

export interface CeevAgreement {
  id: string;
  user_id: string;
  client_id: string;
  name: string | null;
  site_address: string | null;
  start_date: string;
  end_date: string;
  status: CeevStatus;
  frequency: CeevFrequency;
  next_intervention_date: string | null;
  notes: string | null;
  renewed_from_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string | null;
}

export interface CeevAgreementEvent {
  id: string;
  agreement_id: string;
  event_type: CeevEventType;
  label: string;
  details: Record<string, unknown>;
  created_at: string;
}

export type CeevAgreementInput = {
  client_id: string;
  start_date: string;
  end_date: string;
  frequency: CeevFrequency;
  name?: string | null;
  site_address?: string | null;
  notes?: string | null;
  status?: CeevStatus;
  next_intervention_date?: string | null;
};

const DAY_MS = 86_400_000;

/** Ajoute n mois à une date ISO (yyyy-mm-dd). */
export function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

/** Jours restants avant une date (négatif si dépassée). */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(t)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / DAY_MS);
}

/** Prochaine échéance suggérée à partir de la fréquence (jamais imposée). */
export function suggestedNextIntervention(a: Pick<CeevAgreement, "frequency" | "start_date" | "next_intervention_date">): string | null {
  if (a.next_intervention_date) return a.next_intervention_date;
  const months = CEEV_FREQUENCY_META[a.frequency].months;
  if (months == null) return null;
  return addMonths(a.start_date, months);
}

export function agreementLabel(a: CeevAgreement): string {
  return a.name?.trim() || a.client_name?.trim() || "Contrat d'entretien";
}

// ---------------- Accès données ----------------

export async function listCeevAgreements(): Promise<CeevAgreement[]> {
  const { data, error } = await supabase
    .from("ceev_agreements")
    .select("*, clients(name)")
    .order("end_date", { ascending: true });
  if (error) throw error;
  return (data as unknown as Array<CeevAgreement & { clients: { name: string } | null }>).map((row) => ({
    ...row,
    client_name: row.clients?.name ?? null,
  }));
}

export async function getCeevAgreement(id: string): Promise<CeevAgreement> {
  const { data, error } = await supabase
    .from("ceev_agreements")
    .select("*, clients(name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  const row = data as unknown as CeevAgreement & { clients: { name: string } | null };
  return { ...row, client_name: row.clients?.name ?? null };
}

export async function listCeevEvents(agreementId: string): Promise<CeevAgreementEvent[]> {
  const { data, error } = await supabase
    .from("ceev_agreement_events")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as CeevAgreementEvent[];
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

async function logEvent(
  userId: string,
  agreementId: string,
  event_type: CeevEventType,
  label: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await supabase
    .from("ceev_agreement_events")
    .insert({ user_id: userId, agreement_id: agreementId, event_type, label, details } as never);
}

export async function createCeevAgreement(input: CeevAgreementInput): Promise<CeevAgreement> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("ceev_agreements")
    .insert({
      user_id: userId,
      client_id: input.client_id,
      name: input.name ?? null,
      site_address: input.site_address ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      frequency: input.frequency,
      status: input.status ?? "actif",
      next_intervention_date: input.next_intervention_date ?? null,
      notes: input.notes ?? null,
    } as never)
    .select()
    .single();
  if (error) throw error;
  const row = data as unknown as CeevAgreement;
  await logEvent(userId, row.id, "creation", "Contrat créé", {
    start_date: row.start_date,
    end_date: row.end_date,
    frequency: row.frequency,
  });
  return row;
}

export async function updateCeevAgreement(id: string, input: Partial<CeevAgreementInput>): Promise<CeevAgreement> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("ceev_agreements")
    .update({ ...input } as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await logEvent(userId, id, "modification", "Contrat modifié", { ...input });
  return data as unknown as CeevAgreement;
}

/**
 * Renouvellement : crée une nouvelle période liée à l'ancienne.
 * L'ancien contrat est conservé intégralement et passe en « Terminé ».
 */
export async function renewCeevAgreement(
  source: CeevAgreement,
  period: { start_date: string; end_date: string },
): Promise<CeevAgreement> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("ceev_agreements")
    .insert({
      user_id: userId,
      client_id: source.client_id,
      name: source.name,
      site_address: source.site_address,
      start_date: period.start_date,
      end_date: period.end_date,
      frequency: source.frequency,
      status: "actif",
      next_intervention_date: null,
      notes: source.notes,
      renewed_from_id: source.id,
    } as never)
    .select()
    .single();
  if (error) throw error;
  const created = data as unknown as CeevAgreement;

  const { error: closeError } = await supabase
    .from("ceev_agreements")
    .update({ status: "termine" } as never)
    .eq("id", source.id);
  if (closeError) throw closeError;

  await logEvent(userId, source.id, "renouvellement", "Contrat renouvelé sur une nouvelle période", {
    new_agreement_id: created.id,
    new_start_date: created.start_date,
    new_end_date: created.end_date,
  });
  await logEvent(userId, created.id, "creation", "Nouvelle période issue d'un renouvellement", {
    previous_agreement_id: source.id,
    previous_period: `${source.start_date} → ${source.end_date}`,
  });
  return created;
}

/** Archivage : le contrat reste consultable, aucune donnée supprimée. */
export async function archiveCeevAgreement(id: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("ceev_agreements")
    .update({ status: "termine", archived_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
  await logEvent(userId, id, "archivage", "Contrat archivé");
}

/** Suggestion de période de renouvellement (12 mois à la suite de l'ancienne). */
export function renewalPeriod(a: CeevAgreement): { start_date: string; end_date: string } {
  const start = addMonths(a.end_date, 0);
  const nextStart = new Date(`${start}T00:00:00`);
  nextStart.setDate(nextStart.getDate() + 1);
  const startIso = nextStart.toISOString().slice(0, 10);
  return { start_date: startIso, end_date: addMonths(startIso, 12) };
}

// ---------------- Surveillance (page Aujourd'hui) ----------------

export type CeevWatch = {
  endingSoon: CeevAgreement[];
  overdueEnd: CeevAgreement[];
  upcomingInterventions: CeevAgreement[];
  withoutNextAction: CeevAgreement[];
};

/** Contrats à surveiller : échéances proches, interventions prévues, absence d'action. */
export function ceevWatch(agreements: CeevAgreement[], horizonDays = 60): CeevWatch {
  const live = agreements.filter((a) => a.status === "actif" || a.status === "a_renouveler");
  const endingSoon: CeevAgreement[] = [];
  const overdueEnd: CeevAgreement[] = [];
  const upcomingInterventions: CeevAgreement[] = [];
  const withoutNextAction: CeevAgreement[] = [];
  for (const a of live) {
    const dEnd = daysUntil(a.end_date);
    if (dEnd != null && dEnd < 0) overdueEnd.push(a);
    else if (dEnd != null && dEnd <= horizonDays) endingSoon.push(a);
    const dNext = daysUntil(a.next_intervention_date);
    if (dNext != null && dNext <= horizonDays) upcomingInterventions.push(a);
    if (!a.next_intervention_date) withoutNextAction.push(a);
  }
  return { endingSoon, overdueEnd, upcomingInterventions, withoutNextAction };
}

export function ceevWatchCount(w: CeevWatch): number {
  return w.endingSoon.length + w.overdueEnd.length + w.upcomingInterventions.length + w.withoutNextAction.length;
}
