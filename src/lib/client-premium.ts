import { supabase } from "@/integrations/supabase/client";
import { parsePlanning } from "@/lib/file-parser";

type PremiumRow = {
  client_id: string;
  enabled: boolean;
  activated_at: string;
  deactivated_at: string | null;
  cover_photo_id: string | null;
  google_review_url: string | null;
  commercial_note: string | null;
};

export type PremiumDocument = {
  id: string;
  client_id: string;
  kind: "document" | "planning";
  title: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  year: number | null;
  visible_to_client: boolean;
  created_at: string;
};

type PremiumIntervention = {
  id: string;
  title: string | null;
  intervention_date: string | null;
};

type PremiumPhoto = {
  id: string;
  intervention_id: string;
  storage_path: string;
  caption: string | null;
  created_at: string | null;
};

export type PremiumPhotoRow = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string | null;
  intervention_date: string | null;
  intervention_title: string | null;
  url: string | null;
};

export type PremiumPlanningItem = {
  id: string;
  client_id: string;
  document_id: string | null;
  label: string;
  period_label: string | null;
  start_date: string | null;
  end_date: string | null;
  year: number | null;
  status: "a_valider" | "valide";
  source: "pdf" | "manuel";
  notes: string | null;
  position: number;
};

const db = supabase as any;

export async function getClientPremium(
  clientId: string,
): Promise<PremiumRow | null> {
  const { data, error } = await db
    .from("client_premium")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function listPremiumClientIds(): Promise<string[]> {
  const { data, error } = await db
    .from("client_premium")
    .select("client_id")
    .eq("enabled", true);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { client_id: string }) => row.client_id);
}

export async function setClientPremiumEnabled(
  clientId: string,
  enabled: boolean,
): Promise<void> {
  const existing = await getClientPremium(clientId);
  const now = new Date().toISOString();

  if (!existing) {
    const { error } = await db.from("client_premium").insert({
      client_id: clientId,
      enabled,
      activated_at: now,
      deactivated_at: enabled ? null : now,
    });

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await db
    .from("client_premium")
    .update(
      enabled
        ? { enabled: true, activated_at: now, deactivated_at: null }
        : { enabled: false, deactivated_at: now },
    )
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
}

export async function updateClientPremium(
  clientId: string,
  patch: Partial<
    Pick<PremiumRow, "cover_photo_id" | "google_review_url" | "commercial_note">
  >,
): Promise<void> {
  const { error } = await db
    .from("client_premium")
    .update(patch)
    .eq("client_id", clientId);

  if (error) throw new Error(error.message);
}

export async function listPremiumDocuments(
  clientId: string,
): Promise<PremiumDocument[]> {
  const { data, error } = await db
    .from("client_premium_documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setPremiumDocumentVisibility(
  id: string,
  visible: boolean,
): Promise<void> {
  const { error } = await db
    .from("client_premium_documents")
    .update({ visible_to_client: visible })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function listPremiumPlanning(
  clientId: string,
): Promise<PremiumPlanningItem[]> {
  const { data, error } = await db
    .from("client_premium_planning_items")
    .select("*")
    .eq("client_id", clientId)
    .order("year", { ascending: true })
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updatePlanningItem(
  id: string,
  patch: Partial<
    Pick<PremiumPlanningItem, "label" | "period_label" | "start_date" | "end_date" | "year" | "status" | "notes" | "position">
  >,
): Promise<void> {
  const { error } = await db
    .from("client_premium_planning_items")
    .update(patch)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function createManualPlanningItem(
  clientId: string,
  item: Pick<PremiumPlanningItem, "label" | "period_label" | "start_date" | "end_date" | "year" | "notes">,
): Promise<void> {
  const { error } = await db.from("client_premium_planning_items").insert({
    client_id: clientId,
    ...item,
    status: "a_valider",
    source: "manuel",
    position: 0,
  });

  if (error) throw new Error(error.message);
}

export async function deletePlanningItem(id: string): Promise<void> {
  const { error } = await db
    .from("client_premium_planning_items")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function createPlanningItems(
  clientId: string,
  documentId: string,
  rows: Awaited<ReturnType<typeof parsePlanning>>,
): Promise<void> {
  if (!rows.length) return;

  const items = rows.map((row, index) => ({
    client_id: clientId,
    document_id: documentId,
    label: row.label,
    period_label: row.monthLabel,
    start_date: null,
    end_date: null,
    year: null,
    status: "a_valider",
    source: "pdf",
    notes: [row.type, ...row.tasks].filter(Boolean).join(" · "),
    position: index,
  }));

  const { error } = await db
    .from("client_premium_planning_items")
    .insert(items);

  if (error) throw new Error(error.message);
}

export async function uploadPremiumDocument(
  clientId: string,
  file: File,
  kind: "document" | "planning",
  title: string,
  year: number | null,
): Promise<{ document: PremiumDocument; extractedCount: number }> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Le fichier dépasse la taille maximale de 25 Mo.");
  }
  if (kind === "planning" && file.type !== "application/pdf") {
    throw new Error("Le calendrier Premium doit être un fichier PDF.");
  }

  let extractedRows: Awaited<ReturnType<typeof parsePlanning>> = [];
  if (kind === "planning") {
    extractedRows = await parsePlanning(file);
  }

  const path = `${clientId}/${crypto.randomUUID()}-${file.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  )}`;

  const { error: uploadError } = await supabase.storage
    .from("client-premium")
    .upload(path, file, { upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await db
    .from("client_premium_documents")
    .insert({
      client_id: clientId,
      kind,
      title,
      filename: file.name,
      storage_path: path,
      size_bytes: file.size,
      year,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const extractedCount = extractedRows.length;
  if (extractedRows.length > 0) {
    try {
      await createPlanningItems(clientId, data.id, extractedRows);
    } catch (error) {
      await supabase.storage.from("client-premium").remove([path]);
      await db.from("client_premium_documents").delete().eq("id", data.id);
      throw error instanceof Error
        ? error
        : new Error("Impossible d’enregistrer le planning extrait.");
    }
  }

  return {
    document: data as PremiumDocument,
    extractedCount,
  };
}

export async function signedPremiumDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("client-premium")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Lien indisponible");
  }

  return data.signedUrl;
}

export async function sharedPremiumDocumentUrl(
  token: string,
  documentId: string,
): Promise<string> {
  const { data, error } = await db.rpc(
    "get_shared_premium_document_url",
    {
      p_token: token,
      p_document_id: documentId,
    },
  );

  if (error || !data) {
    throw new Error(error?.message ?? "Document indisponible");
  }

  return data as string;
}

export async function getSharedPremium(token: string) {
  const { data, error } = await db.rpc("get_shared_premium", {
    p_token: token,
  });

  if (error) throw new Error(error.message);

  return data as {
    client: any;
    enabled: boolean;
    google_review_url: string | null;
    commercial_note: string | null;
    documents: PremiumDocument[];
    planning: PremiumPlanningItem[];
  } | null;
}

export async function listPremiumPhotos(clientId: string) {
  const { data: interventions, error: interventionError } = await db
    .from("interventions")
    .select("id,title,intervention_date")
    .eq("client_id", clientId);

  if (interventionError) throw new Error(interventionError.message);

  const interventionIds = (interventions ?? []).map(
    (intervention: { id: string }) => intervention.id,
  );

  if (!interventionIds.length) return [];

  const { data: photos, error: photoError } = await db
    .from("intervention_photos")
    .select("id,intervention_id,storage_path,caption,created_at")
    .in("intervention_id", interventionIds);

  if (photoError) throw new Error(photoError.message);

  const interventionMap = new Map<string, PremiumIntervention>(
    (interventions ?? []).map((intervention: PremiumIntervention) => [
      intervention.id,
      intervention,
    ]),
  );

  const rows = await Promise.all(
    (photos ?? []).map(async (photo: PremiumPhoto): Promise<PremiumPhotoRow> => {
      const intervention = interventionMap.get(photo.intervention_id);
      let url: string | null = null;

      try {
        url =
          (
            await supabase.storage
              .from("chantier-photos")
              .createSignedUrl(photo.storage_path, 3600)
          ).data?.signedUrl ?? null;
      } catch {
        // A missing photo URL should not block the Premium workspace.
      }

      return {
        id: photo.id,
        storage_path: photo.storage_path,
        caption: photo.caption,
        created_at: photo.created_at,
        intervention_date:
          intervention?.intervention_date ?? photo.created_at?.slice(0, 10) ?? null,
        intervention_title: intervention?.title ?? null,
        url,
      };
    }),
  );

  return rows.sort((a, b) =>
    String(b.intervention_date).localeCompare(String(a.intervention_date)),
  );
}
