import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const premiumCalendarDb = supabase as unknown as SupabaseClient<any>;

const DOCS_BUCKET = "client-premium";

export interface ClientPremium {
  client_id: string;
  enabled: boolean;
  activated_at: string | null;
  deactivated_at: string | null;
  garden_state: string | null;
  garden_objectives: string | null;
  garden_specificities: string | null;
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
  if (!data) return null;

  // L'état du jardin affiché dans Premium provient en priorité du dernier
  // compte-rendu effectivement destiné au client.
  const { data: latestReport } = await supabase
    .from("interventions")
    .select("garden_state, intervention_date")
    .eq("client_id", clientId)
    .not("sent_to_client_at", "is", null)
    .not("garden_state", "is", null)
    .order("intervention_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ...(data as ClientPremium),
    garden_state: latestReport?.garden_state ?? (data.garden_state as string | null),
  };
}

export async function setClientPremiumEnabled(clientId: string, enabled: boolean): Promise<void> {
  const user_id = await uid();

  if (enabled) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("contract_type")
      .eq("id", clientId)
      .single();

    if (clientError) {
      throw new Error(`Impossible de vérifier l'éligibilité Premium : ${clientError.message}`);
    }
    if (client.contract_type !== "Entretien annuel") {
      throw new Error(
        "Le compte Premium est réservé aux clients ayant souscrit un entretien annuel.",
      );
    }
  }

  const now = new Date().toISOString();
  let cover_photo_id: string | null | undefined = undefined;

  if (enabled) {
    const { data: existing } = await supabase
      .from("client_premium")
      .select("cover_photo_id")
      .eq("client_id", clientId)
      .maybeSingle();

    if (!existing?.cover_photo_id) {
      const photos = await listClientPhotosForCover(clientId);
      cover_photo_id = photos[0]?.id ?? null;
    }
  }

  const { error } = await supabase.from("client_premium").upsert(
    {
      client_id: clientId,
      user_id,
      enabled,
      activated_at: enabled ? now : undefined,
      deactivated_at: enabled ? null : now,
      ...(cover_photo_id !== undefined ? { cover_photo_id } : {}),
    },
    { onConflict: "client_id" },
  );
  if (error) throw new Error(`Impossible de mettre à jour le statut Premium : ${error.message}`);
}

export async function updateClientPremium(
  clientId: string,
  patch: Partial<
    Pick<
      ClientPremium,
      | "garden_state"
      | "garden_objectives"
      | "garden_specificities"
      | "google_review_url"
      | "commercial_note"
      | "cover_photo_id"
    >
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
  if (error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
    throw new Error(`Impossible d'enregistrer le document : ${error.message}`);
  }
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
  const { error: storageError } = await supabase.storage.from(DOCS_BUCKET).remove([storagePath]);
  if (storageError) {
    throw new Error(`Impossible de supprimer le fichier : ${storageError.message}`);
  }
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

export interface PremiumWorkCalendarItem {
  id: string;
  client_id: string;
  document_id: string | null;
  period_label: string;
  year: number | null;
  month: number | null;
  sequence: number;
  title: string;
  details: string | null;
  position: number;
}

export async function listPremiumWorkCalendar(
  clientId: string,
): Promise<PremiumWorkCalendarItem[]> {
  const { data, error } = await premiumCalendarDb
    .from("client_premium_work_calendar_items")
    .select("*")
    .eq("client_id", clientId)
    .order("year", { ascending: true, nullsFirst: false })
    .order("month", { ascending: true, nullsFirst: false })
    .order("sequence", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw new Error(`Impossible de charger le calendrier travaux : ${error.message}`);
  return data as PremiumWorkCalendarItem[];
}

export async function replacePremiumWorkCalendar(
  clientId: string,
  documentId: string,
  items: Array<{
    period_label: string;
    year: number | null;
    month: number | null;
    sequence: number;
    title: string;
    details: string;
  }>,
  source: "pdf" | "ia" | "manuel" = "ia",
): Promise<void> {
  const user_id = await uid();
  const { error: deleteError } = await premiumCalendarDb
    .from("client_premium_work_calendar_items")
    .delete()
    .eq("client_id", clientId);
  if (deleteError)
    throw new Error(`Impossible de remplacer le calendrier : ${deleteError.message}`);

  if (items.length === 0) return;

  const rows = items.map((item, position) => ({
    client_id: clientId,
    document_id: documentId,
    user_id,
    period_label: item.period_label,
    year: item.year,
    month: item.month,
    sequence: item.sequence,
    title: item.title,
    details: item.details,
    position,
    source,
  }));

  const { error } = await premiumCalendarDb.from("client_premium_work_calendar_items").insert(rows);
  if (error) throw new Error(`Impossible d'enregistrer le calendrier : ${error.message}`);
}
