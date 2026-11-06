import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

export interface SendApOrderInput {
  supplierId: string;
  worksiteLabel: string;
  pdfBase64: string;
  orderText: string;
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

    const bytes = decodePdf(data.pdfBase64);
    const attempt = data.attemptId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
    const path = `${context.userId}/${attempt}-${supplier.id}.pdf`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("ap-orders")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("ap-orders")
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (signError || !signed?.signedUrl) throw signError ?? new Error("Lien PDF indisponible.");

    const { sendApOrderEmail } = await import("@/lib/ap-order-mailer.server");
    return sendApOrderEmail({
      to,
      supplierName: supplier.name,
      worksiteLabel: data.worksiteLabel,
      orderText: data.orderText,
      pdfUrl: signed.signedUrl,
      idempotencyKey: `ap-order-${attempt}-${supplier.id}`,
    });
  });
