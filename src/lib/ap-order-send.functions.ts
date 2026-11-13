import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

export interface SendApOrderInput {
  supplierId: string;
  worksiteId: string;
  worksiteLabel: string;
  pdfBase64: string;
  attemptId: string;
}

function decodePdf(base64: string): Uint8Array {
  const clean = base64.replace(/^data:application\/pdf;base64,/, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const header = String.fromCharCode(...bytes.subarray(0, 4));
  if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES || header !== "%PDF") {
    throw new Error("PDF de commande invalide.");
  }
  return bytes;
}

export const sendApSupplierOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SendApOrderInput) => input)
  .handler(async ({ context, data }) => {
    const { data: supplier, error } = await context.supabase
      .from("ap_suppliers")
      .select("id, name, email")
      .eq("id", data.supplierId)
      .maybeSingle();
    if (error) throw error;
    const to = supplier?.email?.trim();
    if (!supplier || !to) throw new Error("Aucune adresse e-mail pour ce fournisseur.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new Error("Adresse e-mail du fournisseur invalide.");
    }

    // Journal d'envoi dans PP (module Assistant AP) : une ligne par tentative, réussie ou non.
    const writeTrace = async (row: {
      status: "sent" | "suppressed" | "failed";
      pdfPath: string | null;
      messageId: string | null;
      errorMessage: string | null;
    }) => {
      // Table hors types générés courants : même accès que le reste de l'Assistant AP.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table hors types générés
      const { error: traceError } = await (context.supabase.from as any)("ap_order_sends").insert({
        worksite_id: data.worksiteId,
        worksite_label: data.worksiteLabel,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        recipient_email: to,
        pdf_path: row.pdfPath,
        message_id: row.messageId,
        status: row.status,
        error_message: row.errorMessage,
        sent_by: context.userId,
      });
      if (traceError) console.error("ap_order_sends insert failed", traceError.code);
    };

    const attempt = data.attemptId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
    let pdfPath: string | null = null;
    try {
      const bytes = decodePdf(data.pdfBase64);
      pdfPath = `${context.userId}/${attempt}-${supplier.id}.pdf`;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: uploadError } = await supabaseAdmin.storage
        .from("ap-orders")
        .upload(pdfPath, bytes, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;


      const { sendApOrderEmail } = await import("@/lib/ap-order-mailer.server");
      const result = await sendApOrderEmail({
        to,
        idempotencyKey: `ap-order-${attempt}-${supplier.id}`,
      });
      await writeTrace({
        status: result.sent ? "sent" : "suppressed",
        pdfPath,
        messageId: result.sent ? result.messageId : null,
        errorMessage: result.sent
          ? null
          : "Adresse désactivée côté envoi (désabonnée ou invalide).",
      });
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Envoi impossible";
      await writeTrace({ status: "failed", pdfPath, messageId: null, errorMessage: message });
      throw caught;
    }
  });
