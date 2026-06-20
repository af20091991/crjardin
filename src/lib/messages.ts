import { supabase } from "@/integrations/supabase/client";

export interface ClientMessageRow {
  id: string;
  client_id: string;
  intervention_id: string | null;
  kind: string;
  content: string;
  author_name: string | null;
  sender: string;
  resolved: boolean;
  created_at: string;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function listMessagesByClient(clientId: string): Promise<ClientMessageRow[]> {
  const { data, error } = await supabase
    .from("client_messages")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as ClientMessageRow[];
}

export async function replyToClient(input: { client_id: string; intervention_id: string | null; content: string; authorName?: string | null }): Promise<void> {
  await uid();
  const { error } = await supabase.from("client_messages").insert({
    client_id: input.client_id,
    intervention_id: input.intervention_id,
    kind: "annotation",
    sender: "gardener",
    content: input.content.trim().slice(0, 2000),
    author_name: input.authorName ?? null,
    resolved: true,
  });
  if (error) throw error;
}

export async function resolveMessage(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase.from("client_messages").update({ resolved }).eq("id", id);
  if (error) throw error;
}
