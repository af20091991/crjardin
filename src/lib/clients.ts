import { supabase } from "@/integrations/supabase/client";

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