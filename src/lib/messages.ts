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

/** Nom affiché au client pour les messages écrits depuis PP. */
export const GARDENER_AUTHOR_NAME = "Anthony";

export async function replyToClient(input: {
  client_id: string;
  intervention_id: string | null;
  content: string;
  authorName?: string | null;
}): Promise<void> {
  await uid();
  const { error } = await supabase.from("client_messages").insert({
    client_id: input.client_id,
    intervention_id: input.intervention_id,
    kind: "annotation",
    sender: "gardener",
    content: input.content.trim().slice(0, 2000),
    author_name: input.authorName ?? GARDENER_AUTHOR_NAME,
    resolved: true,
  });
  if (error) throw error;
}

/**
 * Clôture la conversation en cours d'un client : tous ses messages ouverts reçoivent la date du jour
 * et sont classés dans les archives. Un nouveau message rouvre ensuite une conversation vierge.
 */
export async function archiveConversation(clientId: string): Promise<void> {
  const { error } = await supabase
    .from("client_messages")
    .update({ archived_at: new Date().toISOString(), resolved: true } as never)
    .eq("client_id", clientId)
    .is("archived_at" as never, null);
  if (error) {
    throw new Error(
      error.message.includes("archived_at")
        ? "L'archivage n'est pas encore activé sur la base de données."
        : error.message,
    );
  }
}

export async function resolveMessage(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase.from("client_messages").update({ resolved }).eq("id", id);
  if (error) throw error;
}
