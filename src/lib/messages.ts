import { supabase } from "@/integrations/supabase/client";
import {
  CHAT_ATTACHMENTS_BUCKET,
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_URL_TTL,
  chatAttachmentPath,
  resolveChatMime,
  validateChatAttachment,
  type ChatAttachmentMeta,
} from "@/lib/message-attachments";

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
 * Réponse entreprise avec pièces jointes : fichiers envoyés d'abord (bucket privé), puis message,
 * puis rattachement. En cas d'échec, les fichiers déjà envoyés sont supprimés.
 */
export async function replyToClientWithAttachments(input: {
  client_id: string;
  content: string;
  files: File[];
}): Promise<void> {
  if (input.files.length === 0) return replyToClient({ ...input, intervention_id: null });
  if (input.files.length > CHAT_ATTACHMENT_MAX_FILES) throw new Error("5 pièces jointes maximum");
  for (const file of input.files) {
    const problem = validateChatAttachment(file);
    if (problem) throw new Error(problem);
  }
  await uid();
  const requestId = crypto.randomUUID();
  const bucket = supabase.storage.from(CHAT_ATTACHMENTS_BUCKET);
  const uploaded: { path: string; file: File; mime: string }[] = [];
  try {
    for (const [index, file] of input.files.entries()) {
      const path = chatAttachmentPath(input.client_id, requestId, index, file.name);
      const mime = resolveChatMime(file.name, file.type);
      const { error } = await bucket.upload(path, file, { contentType: mime, upsert: true });
      if (error) throw new Error(`Envoi de « ${file.name} » impossible : ${error.message}`);
      uploaded.push({ path, file, mime });
    }
    const { data: msg, error: msgError } = await supabase
      .from("client_messages")
      .insert({
        client_id: input.client_id,
        intervention_id: null,
        kind: "annotation",
        sender: "gardener",
        content: input.content.trim().slice(0, 2000),
        author_name: GARDENER_AUTHOR_NAME,
        resolved: true,
      })
      .select("id")
      .single();
    if (msgError) throw msgError;
    const { error: attError } = await supabase.from("client_message_attachments").insert(
      uploaded.map((u) => ({
        message_id: msg.id,
        client_id: input.client_id,
        storage_path: u.path,
        filename: u.file.name.slice(0, 200),
        mime_type: u.mime,
        size_bytes: u.file.size,
        uploaded_by: "gardener",
      })),
    );
    if (attError) {
      await supabase.from("client_messages").delete().eq("id", msg.id);
      throw attError;
    }
  } catch (error) {
    if (uploaded.length > 0) await bucket.remove(uploaded.map((u) => u.path));
    throw error;
  }
}

/** Pièces jointes des messages donnés, avec liens signés de courte durée. */
export async function listMessageAttachments(
  messageIds: string[],
): Promise<Record<string, ChatAttachmentMeta[]>> {
  if (messageIds.length === 0) return {};
  const { data, error } = await supabase
    .from("client_message_attachments")
    .select("id, message_id, storage_path, filename, mime_type, size_bytes, created_at")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return {};
  const { data: signed } = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).createSignedUrls(
    data.map((a) => a.storage_path),
    CHAT_ATTACHMENT_URL_TTL,
  );
  const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const out: Record<string, ChatAttachmentMeta[]> = {};
  for (const a of data) {
    (out[a.message_id] ??= []).push({
      id: a.id,
      storage_path: a.storage_path,
      filename: a.filename,
      mime_type: a.mime_type,
      size_bytes: Number(a.size_bytes),
      url: urls.get(a.storage_path) ?? null,
    });
  }
  return out;
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
