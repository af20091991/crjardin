import { supabase } from "@/integrations/supabase/client";

/** Le client est-il concerné par l'envoi de comptes-rendus ? */
export type ReportPolicy = "oui" | "non" | "a_confirmer";

/** Cycle de vie commercial d'une fiche client. */
export type ClientLifecycle = "actif" | "perdu";

export const LIFECYCLE_META: Record<ClientLifecycle, { label: string; hint: string; badge: string }> = {
  actif: {
    label: "Client suivi",
    hint: "Le client reste suivi : il peut apparaître en dormant ou en relance.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  perdu: {
    label: "Client perdu",
    hint: "Retiré des clients dormants et des relances commerciales. Historique et fiche restent consultables.",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

export const REPORT_POLICY_META: Record<ReportPolicy, { label: string; short: string; hint: string; badge: string }> = {
  oui: {
    label: "Oui — client suivi par compte-rendu",
    short: "CR : oui",
    hint: "Les interventions terminées génèrent une action compte-rendu.",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  non: {
    label: "Non — client non concerné",
    short: "CR : non",
    hint: "Aucune alerte ni action compte-rendu pour ce client.",
    badge: "border-border bg-muted text-muted-foreground",
  },
  a_confirmer: {
    label: "À confirmer",
    short: "CR à qualifier",
    hint: "À qualifier — jamais compté comme retard.",
    badge: "border-orange-200 bg-orange-50 text-orange-700",
  },
};

export interface Client {
  id: string;
  name: string;
  civility: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  emails: string[];
  contract_type: string | null;
  frequency: string | null;
  notes: string | null;
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
  civility?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  emails?: string[];
  contract_type?: string | null;
  frequency?: string | null;
  notes?: string | null;
  report_policy?: ReportPolicy;
  lifecycle_status?: ClientLifecycle;
  lost_at?: string | null;
  source?: string | null;
  source_confidence?: string | null;
};

/** Origine d'une fiche créée depuis l'historique CA. */
export const CLIENT_SOURCE_CA = "ca_historique";
export const CLIENT_SOURCE_LABEL: Record<string, string> = {
  [CLIENT_SOURCE_CA]: "Création automatique depuis historique CA",
};

/** Toutes les adresses e-mail d'un client (nouvelle liste + ancien champ), dédupliquées. */
export function clientEmails(client: { email?: string | null; emails?: string[] | null }): string[] {
  const list = [...(client.emails ?? []), ...(client.email ? [client.email] : [])]
    .map((e) => e.trim())
    .filter(Boolean);
  return Array.from(new Set(list));
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
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
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...input, user_id: auth.user.id } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Client;
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(input as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

/** Libellé "Jardin de [civilité] [nom]" utilisé dans les rapports. */
export function gardenLabel(client: { name: string; civility?: string | null }): string {
  const civ = client.civility?.trim();
  const name = client.name?.trim() || "";
  return civ ? `Jardin de ${civ} ${name}`.trim() : `Jardin de ${name}`.trim();
}