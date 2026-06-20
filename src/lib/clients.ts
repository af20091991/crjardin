import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  civility: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
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
  contract_type?: string | null;
  frequency?: string | null;
  notes?: string | null;
};

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Client[];
}

export async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Client;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Non authentifié");
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...input, user_id: auth.user.id })
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Client;
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