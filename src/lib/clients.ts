import { supabase } from "@/integrations/supabase/client";

export type ClientType = "particulier" | "residence" | "professionnel";
export type ReportPolicy = "oui" | "non" | "a_confirmer";
export type ClientLifecycle = "actif" | "perdu";

export const CLIENT_TYPE_META: Record<ClientType, { label: string; hint: string }> = {
  particulier: { label: "Particulier", hint: "Client individuel / foyer." },
  residence: { label: "Résidence", hint: "Résidence ou ensemble immobilier." },
  professionnel: { label: "Professionnel", hint: "Entreprise ou organisme." },
};

export const LIFECYCLE_META: Record<ClientLifecycle, { label: string; hint: string; badge: string }> = {
  actif: { label: "Client suivi", hint: "Le client reste suivi.", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  perdu: { label: "Client perdu", hint: "Historique conservé, exclu des relances.", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

export const REPORT_POLICY_META: Record<ReportPolicy, { label: string; short: string; hint: string; badge: string }> = {
  oui: { label: "Oui — client suivi par compte-rendu", short: "CR : oui", hint: "Les interventions terminées génèrent une action compte-rendu.", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  non: { label: "Non — client non concerné", short: "CR : non", hint: "Aucune alerte ni action compte-rendu.", badge: "border-border bg-muted text-muted-foreground" },
  a_confirmer: { label: "À confirmer", short: "CR à qualifier", hint: "À qualifier — jamais compté comme retard.", badge: "border-orange-200 bg-orange-50 text-orange-700" },
};

export interface Client {
  id: string; name: string; client_type: ClientType | null; civility: string | null; address: string | null;
  phone: string | null; email: string | null; emails: string[]; contract_type: string | null; frequency: string | null;
  notes: string | null; cr_notes: string | null; ceev_enabled: boolean; ceev_planning_path: string | null;
  ceev_planning_filename: string | null; ceev_planning_updated_at: string | null; report_policy: ReportPolicy;
  lifecycle_status: ClientLifecycle; lost_at: string | null; source: string | null; source_confidence: string | null;
  created_at: string; updated_at: string; share_token: string;
}

export type ClientInput = {
  name: string; client_type?: ClientType | null; civility?: string | null; address?: string | null; phone?: string | null;
  email?: string | null; emails?: string[]; contract_type?: string | null; frequency?: string | null; notes?: string | null;
  cr_notes?: string | null; ceev_enabled?: boolean; report_policy?: ReportPolicy; lifecycle_status?: ClientLifecycle;
  lost_at?: string | null; source?: string | null; source_confidence?: string | null;
};

export const CLIENT_SOURCE_CA = "ca_historique";
export const CLIENT_SOURCE_LABEL: Record<string, string> = { [CLIENT_SOURCE_CA]: "Création automatique depuis historique CA" };

export function clientEmails(client: { email?: string | null; emails?: string[] | null }): string[] {
  return Array.from(new Set([...(client.emails ?? []), ...(client.email ? [client.email] : [])].map(e => e.trim()).filter(Boolean)));
}

export function gardenLabel(client: { name?: string | null }): string { return client.name?.trim() || "Jardin"; }

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").is("merged_into_client_id", null).order("name", { ascending: true });
  if (error) throw new Error(`Impossible de charger les clients : ${error.message}`);
  return data as unknown as Client[];
}

export async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw new Error(`Impossible de charger la fiche client : ${error.message}`);
  return data as unknown as Client;
}

function normaliseInput(input: ClientInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) payload[key] = value;
  }
  if (Array.isArray(payload.emails)) {
    const emails = Array.from(new Set(payload.emails.map(e => e.trim()).filter(Boolean)));
    payload.emails = emails;
    if (!payload.email) payload.email = emails[0] ?? null;
  }
  if (typeof payload.name === "string") payload.name = payload.name.trim();
  return payload;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const payload = { ...normaliseInput(input), user_id: auth.user.id };
  const { data, error } = await supabase.from("clients").insert(payload as never).select().single();
  if (error) throw new Error(`Impossible d'enregistrer le client : ${error.message}`);
  return data as unknown as Client;
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const payload = normaliseInput(input);
  const { data, error } = await supabase.from("clients").update(payload as never).eq("id", id).select().single();
  if (error) throw new Error(`Impossible d'enregistrer la fiche client : ${error.message}`);
  if (!data) throw new Error("Aucune fiche client n'a été modifiée.");
  return data as unknown as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(`Impossible de supprimer le client : ${error.message}`);
}
