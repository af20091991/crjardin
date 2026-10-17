import { supabase } from "@/integrations/supabase/client";
import { attachmentError, attachmentOnlyContent } from "@/lib/message-attachments";
import {
  deletePremiumDocument,
  signedPremiumDocumentUrl,
  uploadPremiumDocument,
} from "@/lib/client-premium";

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
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_size?: number | null;
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
  file?: File | null;
}): Promise<void> {
  await uid();
  const file = input.file ?? null;
  if (file) {
    const problem = attachmentError(file);
    if (problem) throw new Error(problem);
  }
  // Le fichier est aussi classé dans « Photos et Documents » du client.
  const doc = file
    ? await uploadPremiumDocument(
        input.client_id,
        file,
        `Pièce jointe — ${file.name}`.slice(0, 200),
      )
    : null;
  const content =
    input.content.trim().slice(0, 2000) || (file ? attachmentOnlyContent(file.name) : "");
  const { error } = await supabase.from("client_messages").insert({
    client_id: input.client_id,
    intervention_id: input.intervention_id,
    kind: "annotation",
    sender: "gardener",
    content,
    author_name: input.authorName ?? GARDENER_AUTHOR_NAME,
    resolved: true,
    ...(doc
      ? {
          attachment_path: doc.storage_path,
          attachment_name: doc.filename,
          attachment_size: doc.size_bytes,
        }
      : {}),
  } as never);
  if (error) {
    if (doc) await deletePremiumDocument(doc.id, doc.storage_path).catch(() => undefined);
    throw new Error(
      error.message.includes("attachment_")
        ? "Les pièces jointes ne sont pas encore activées sur la base de données."
        : error.message,
    );
  }
}

/** Lien temporaire vers la pièce jointe d'un message (côté PP, jardinier connecté). */
export function messageAttachmentUrl(path: string): Promise<string> {
  return signedPremiumDocumentUrl(path);
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
