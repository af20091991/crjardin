import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL_LABEL = "Addala";

// prettier-ignore
type PremiumCalendarRow = {
  client_id: string;
  user_id: string;
  document_id: string | null;
  period_label: string;
  year: number | null;
  month: number | null;
  sequence: number;
  title: string;
  details: string | null;
  position: number;
  source: "pdf";
};

// prettier-ignore
type PremiumCalendarDb = {
  from: (table: "client_premium_work_calendar_items") => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        limit: (count: number) => Promise<{
          data: Array<Pick<PremiumCalendarRow, "client_id">> | null;
          error: Error | null;
        }>;
      };
    };
    insert: (rows: PremiumCalendarRow[]) => Promise<{ error: Error | null }>;
  };
};

// prettier-ignore
export const provisionPremiumAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) => {
    if (!data?.clientId || typeof data.clientId !== "string") {
      throw new Error("Client Premium invalide");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isEditor, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isEditor) {
      const { data: editor, error: editorError } = await context.supabase.rpc("is_editor", {
        _user_id: context.userId,
      });
      if (editorError) throw editorError;
      if (!editor) throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { parsePlanningPdf } = await import("@/lib/premium-planning-parser");

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, contract_type, ceev_planning_path, ceev_planning_filename")
      .eq("id", data.clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) throw new Error("Client introuvable");
    if (client.contract_type !== "Entretien annuel") {
      throw new Error("Le Compte Premium est réservé aux clients en entretien annuel.");
    }

    const calendarDb = supabaseAdmin as unknown as PremiumCalendarDb;
    const { data: existingCalendar, error: calendarError } = await calendarDb
      .from("client_premium_work_calendar_items")
      .select("client_id")
      .eq("client_id", client.id)
      .limit(1);
    if (calendarError) throw calendarError;

    if ((existingCalendar ?? []).length > 0) {
      return {
        ok: true,
        calendarImported: false,
        alreadyProvisioned: true,
        model: MODEL_LABEL,
      };
    }

    if (!client.ceev_planning_path) {
      return {
        ok: true,
        calendarImported: false,
        alreadyProvisioned: false,
        model: MODEL_LABEL,
      };
    }

    const { data: planningFile, error: planningError } = await supabaseAdmin.storage
      .from("client-plannings")
      .download(client.ceev_planning_path);

    if (planningError || !planningFile) {
      return {
        ok: true,
        calendarImported: false,
        alreadyProvisioned: false,
        model: MODEL_LABEL,
        warning: "Calendrier CEEV indisponible",
      };
    }

    const parsed = await parsePlanningPdf(
      new Uint8Array(await planningFile.arrayBuffer()),
    );
    if (parsed.length === 0) {
      return {
        ok: true,
        calendarImported: false,
        alreadyProvisioned: false,
        model: MODEL_LABEL,
        warning: "Aucune intervention exploitable dans le calendrier CEEV",
      };
    }

    const { data: existingDocument, error: documentLookupError } = await supabaseAdmin
      .from("client_premium_documents")
      .select("id")
      .eq("client_id", client.id)
      .eq("title", "Calendrier travaux")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (documentLookupError) throw documentLookupError;

    let documentId = existingDocument?.id ?? null;

    if (!documentId) {
      const filename = client.ceev_planning_filename || "calendrier-travaux.pdf";
      const storagePath = `${client.id}/calendrier-travaux-${Date.now()}.pdf`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("client-premium")
        .upload(storagePath, planningFile, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: document, error: documentError } = await supabaseAdmin
        .from("client_premium_documents")
        .insert({
          client_id: client.id,
          user_id: context.userId,
          title: "Calendrier travaux",
          filename,
          storage_path: storagePath,
          size_bytes: planningFile.size,
          uploaded_by: "gardener",
          visible_to_client: true,
        })
        .select("id")
        .single();

      if (documentError) {
        await supabaseAdmin.storage.from("client-premium").remove([storagePath]);
        throw documentError;
      }
      documentId = document.id;
    }

    const rows = parsed.map((item) => ({
      client_id: client.id,
      user_id: context.userId,
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

    const { error: insertError } = await calendarDb
      .from("client_premium_work_calendar_items")
      .insert(rows);
    if (insertError) throw insertError;

    return {
      ok: true,
      calendarImported: true,
      alreadyProvisioned: false,
      model: MODEL_LABEL,
      importedItems: rows.length,
    };
  });
