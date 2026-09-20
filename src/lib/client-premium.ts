import { supabase } from "@/integrations/supabase/client";

const DOCS_BUCKET = "client-premium";

export interface ClientPremium {
  client_id: string;
  enabled: boolean;
  activated_at: string | null;
  deactivated_at: string | null;
  garden_state: string | null;
  google_review_url: string | null;
  commercial_note: string | null;
  cover_photo_id: string | null;
}

export type PremiumDocumentUploader = "gardener" | "client";

export interface PremiumDocument {
  id: string;
  client_id: string;
  title: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  uploaded_by: PremiumDocumentUploader;
  visible_to_client: boolean;
  created_at: string;
}

export interface ClientCoverPhotoOption {
  id: string;
  storage_path: string;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non authentifié");
  return data.user.id;
}

export async function getClientPremium(clientId: string): Promise<ClientPremium | null> {
  const { data, error } = await supabase
    .from("client_premium")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(`Impossible de charger le statut Premium : ${error.message}`);
  return data as ClientPremium | null;
}

export async function setClientPremiumEnabled(clientId: string, enabled: boolean): Promise<void> {
  const user_id = await uid();
  const now = new Date().toISOString();
  const { error } = await supabase.from("client_premium").upsert(
    {
      client_id: clientId,
      user_id,
      enabled,
      activated_at: enabled ? now : undefined,
      deactivated_at: enabled ? null : now,
    },
    { onConflict: "client_id" },
  );
  if (error) throw new Error(`Impossible de mettre à jour le statut Premium : ${error.message}`);
}

export async function updateClientPremium(
  clientId: string,
  patch: Partial<
    Pick<ClientPremium, "garden_state" | "google_review_url" | "commercial_note" | "cover_photo_id">
  >,
): Promise<void> {
  const user_id = await uid();
  const { error } = await supabase
    .from("client_premium")
    .upsert({ client_id: clientId, user_id, ...patch }, { onConflict: "client_id" });
  if (error) throw new Error(`Impossible d'enregistrer les modifications : ${error.message}`);
}

export async function listPremiumDocuments(clientId: string): Promise<PremiumDocument[]> {
  const { data, error } = await supabase
    .from("client_premium_documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Impossible de charger les documents : ${error.message}`);
  return data as PremiumDocument[];
}

export async function uploadPremiumDocument(
  clientId: string,
  file: File,
  title: string,
): Promise<PremiumDocument> {
  const user_id = await uid();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw new Error(`Échec de l'envoi du document : ${uploadError.message}`);
  const { data, error } = await supabase
    .from("client_premium_documents")
    .insert({
      client_id: clientId,
      user_id,
      title,
      filename: file.name,
      storage_path: path,
      size_bytes: file.size,
      uploaded_by: "gardener",
    })
    .select()
    .single();
  if (error) throw new Error(`Impossible d'enregistrer le document : ${error.message}`);
  return data as PremiumDocument;
}

export async function updatePremiumDocumentVisibility(id: string, visible: boolean): Promise<void> {
  const { error } = await supabase
    .from("client_premium_documents")
    .update({ visible_to_client: visible })
    .eq("id", id);
  if (error) throw new Error(`Impossible de mettre à jour le document : ${error.message}`);
}

export async function deletePremiumDocument(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from(DOCS_BUCKET).remove([storagePath]);
  const { error } = await supabase.from("client_premium_documents").delete().eq("id", id);
  if (error) throw new Error(`Impossible de supprimer le document : ${error.message}`);
}

export async function signedPremiumDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Photos d'interventions du client, candidates pour la couverture de son espace Premium. */
export async function listClientPhotosForCover(
  clientId: string,
): Promise<ClientCoverPhotoOption[]> {
  const { data: interventions, error: ivError } = await supabase
    .from("interventions")
    .select("id")
    .eq("client_id", clientId);
  if (ivError) throw new Error(`Impossible de charger les interventions : ${ivError.message}`);
  const ids = (interventions ?? []).map((i) => i.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("intervention_photos")
    .select("id, storage_path")
    .in("intervention_id", ids)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`Impossible de charger les photos : ${error.message}`);
  return data as ClientCoverPhotoOption[];
}
