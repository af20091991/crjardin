import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PremiumPlanningDb = SupabaseClient<any>;

export type PremiumPlanningImportStatus =
  | "imported"
  | "already_imported"
  | "no_pdf"
  | "pdf_unavailable"
  | "pdf_unreadable";

export interface PremiumPlanningImportResult {
  status: PremiumPlanningImportStatus;
  importedItems?: number;
}

type ClientRow = {
  id: string;
  user_id: string;
  ceev_planning_path: string | null;
  ceev_planning_filename: string | null;
};

const DOCUMENT_TITLE = "Calendrier travaux";

/**
 * Importe le calendrier PDF CEEV d'un client dans l'espace Premium :
 * 1. copie le PDF dans la page Documents (une seule fois) ;
 * 2. remplace les lignes du calendrier travaux issues du PDF.
 * Ne touche jamais aux lignes saisies à la main (source <> 'pdf').
 */
export async function importPremiumPlanning(
  db: PremiumPlanningDb,
  client: ClientRow,
  options: { replace?: boolean } = {},
): Promise<PremiumPlanningImportResult> {
  if (!options.replace) {
    const { data: existing, error } = await db
      .from("client_premium_work_calendar_items")
      .select("id")
      .eq("client_id", client.id)
      .limit(1);
    if (error) throw error;
    if ((existing ?? []).length > 0) return { status: "already_imported" };
  }

  if (!client.ceev_planning_path) return { status: "no_pdf" };

  const { data: file, error: downloadError } = await db.storage
    .from("client-plannings")
    .download(client.ceev_planning_path);
  if (downloadError || !file) return { status: "pdf_unavailable" };

  const { parsePlanningPdf } = await import("@/lib/premium-planning-parser");
  let parsed: Awaited<ReturnType<typeof parsePlanningPdf>> = [];
  try {
    parsed = await parsePlanningPdf(new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    console.error("[premium-planning] lecture PDF impossible", error);
    return { status: "pdf_unreadable" };
  }
  if (parsed.length === 0) return { status: "pdf_unreadable" };

  const filename = client.ceev_planning_filename || "calendrier-travaux.pdf";
  const { data: existingDoc, error: lookupError } = await db
    .from("client_premium_documents")
    .select("id, filename, storage_path")
    .eq("client_id", client.id)
    .eq("title", DOCUMENT_TITLE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;

  let documentId: string | null = existingDoc?.id ?? null;

  if (options.replace && existingDoc) {
    await db.storage.from("client-premium").remove([existingDoc.storage_path]);
    await db.from("client_premium_documents").delete().eq("id", existingDoc.id);
    documentId = null;
  }

  if (!documentId) {
    const storagePath = `${client.id}/calendrier-travaux-${Date.now()}.pdf`;
    const { error: uploadError } = await db.storage
      .from("client-premium")
      .upload(storagePath, file, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
    const { data: doc, error: docError } = await db
      .from("client_premium_documents")
      .insert({
        client_id: client.id,
        user_id: client.user_id,
        title: DOCUMENT_TITLE,
        filename,
        storage_path: storagePath,
        size_bytes: file.size,
        uploaded_by: "gardener",
        visible_to_client: true,
      })
      .select("id")
      .single();
    if (docError) {
      await db.storage.from("client-premium").remove([storagePath]);
      throw docError;
    }
    documentId = doc.id;
  }

  const { error: deleteError } = await db
    .from("client_premium_work_calendar_items")
    .delete()
    .eq("client_id", client.id)
    .eq("source", "pdf");
  if (deleteError) throw deleteError;

  const rows = parsed.map((item) => ({
    client_id: client.id,
    user_id: client.user_id,
    document_id: documentId,
    period_label: item.period_label,
    year: item.year,
    month: item.month,
    sequence: item.sequence,
    title: item.title,
    details: item.details,
    position: item.position,
    source: "pdf" as const,
  }));
  const { error: insertError } = await db.from("client_premium_work_calendar_items").insert(rows);
  if (insertError) throw insertError;

  return { status: "imported", importedItems: rows.length };
}
