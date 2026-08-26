import { supabase } from "@/integrations/supabase/client";

/** Classification simple du client. */
export type ClientType = "particulier" | "residence" | "professionnel";

export const CLIENT_TYPE_META: Record<ClientType, { label: string; hint: string }> = {
  particulier: { label: "Particulier", hint: "Client individuel / foyer." },
  residence: { label: "Résidence", hint: "Résidence ou ensemble immobilier : le client peut être différent du référent sur place." },
  professionnel: { label: "Professionnel", hint: "Entreprise ou organisme : le client peut être différent du référent sur place." },
};

export type ReportPolicy = "oui" | "non" | "a_confirmer";
export type ClientLifecycle = "actif" | "perdu";

export const LIFECYCLE_META: Record<ClientLifecycle, { label: string; hint: string; badge: string }> = {
  actif: { label: "Client suivi", hint: "Le client reste suivi : il peut apparaître en dormant ou en relance.", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  perdu: { label: "Client perdu", hint: "Retiré des clients dormants et des relances commerciales. Historique et fiche restent consultables.", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

export const REPORT_POLICY_META: Record<ReportPolicy, { label: string; short: string; hint: string; badge: string }> = {
  oui: { label: "Oui — client suivi par compte-rendu", short: "CR : oui", hint: "Les interventions terminées génèrent une action compte-rendu.", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  non: { label: "Non — client non concerné", short: "CR : non", hint: "Aucune alerte ni action compte-rendu pour ce client.", badge: "border-border bg-muted text-muted-foreground" },
  a_confirmer: { label: "À confirmer", short: "CR à qualifier", hint: "À qualifier — jamais compté comme retard.", badge: "border-orange-200 bg-orange-50 text-orange-700" },
};

export interface Client {
  id: string;
  name: string;
  client_type: ClientType | null;
  civility: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  emails: string[];
  contract_type: string | null;
  frequency: string | null;
  notes: string | null;
  cr_notes: string | null;
  ceev_enabled: boolean;
  ceev_planning_path: string | null;
  ceev_planning_filename: string | null;
  ceev_planning_updated_at: string | null;
  report_policy: ReportPolicy;
  lifecycle_status: ClientLifecycle;
  lost_at: string | null;
  source: string | null;
  source_confidence: string | null;
  created_at: string;
  updated_at: string;
  share_token: string;
}

export type ClientInput = {
  name: string;
  client_type?: ClientType | null;
  civility?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  emails?: string[];
  contract_type?: string | null;
  frequency?: string | null;
  notes?: string | null;
  cr_notes?: string | null;
  ceev_enabled?: boolean;
  report_policy?: ReportPolicy;
  lifecycle_status?: ClientLifecycle;
  lost_at?: string | null;
  source?: string | null;
  source_confidence?: string | null;
};

export const CLIENT_SOURCE_CA = "ca_historique";
export const CLIENT_SOURCE_LABEL: Record<string, string> = { [CLIENT_SOURCE_CA]: "Création automatique depuis historique CA" };

export function clientEmails(client: { email?: string | null; emails?: string[] | null }): string[] {
  const list = [...(client.emails ?? []), ...(client.email ? [client.email] : [])].map((e) => e.trim()).filter(Boolean);
  return Array.from(new Set(list));
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").is("merged_into_client_id", null).order("name", { ascending: true });
  if (error) throw error;
  return data as unknown as Client[];
}

export async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as Client;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const payload = { ...input, user_id: auth.user.id };
  const { data, error } = await supabase.from("clients").insert(payload as never).select().single();
  if (error) throw error;
  return data as unknown as Client;
}

/**
 * Update a client while remaining compatible with databases that have not yet
 * received every optional migration. We first try the complete payload. If
 * PostgREST reports an unknown column, retry once without the optional fields
 * introduced by later features. This keeps basic client editing functional
 * while the database catches up, instead of displaying a generic "Erreur".
 */
export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const primary = { ...input } as Record<string, unknown>;
  if (Array.isArray(primary.emails)) {
    primary.email = primary.email ?? primary.emails[0] ?? null;
  }

  let { data, error } = await supabase.from("clients").update(primary as never).eq("id", id).select().single();
  if (!error) return data as unknown as Client;

  const optionalFields = [
    "emails",
    "cr_notes",
    "ceev_enabled",
    "ceev_planning_path",
    "ceev_planning_filename",
    "ceev_planning_updated_at",
    "client_type",
  ];
  const message = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  const schemaError = error.code === "PGRST204" || error.code === "42703" || message.includes("column") || message.includes("schema cache");
  if (!schemaError) throw error;

  const fallback = { ...primary };
  for (const field of optionalFields) delete fallback[field];
  ({ data, error } = await supabase.from("clients").update(fallback as never).eq("id", id).select().single());
  if (error) throw error;
  return data as unknown as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export function gardenLabel(client: { name: string; civility?: string | null }): string {
  const civ = client.civility?.trim();
  const name = client.name?.trim() || "";
  return civ ? `Jardin de ${civ} ${name}`.trim() : `Jardin de ${name}`.trim();
}
