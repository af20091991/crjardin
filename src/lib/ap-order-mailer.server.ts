// Assistant AP — envoi d'une commande fournisseur par e-mail (gabarit + lien PDF + accusé de réception).
// Server-only. Pas de pixel de suivi, pas de raccourcisseur d'URL.
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";
import { buildApOrderEmail, AP_ORDER_SITE_NAME } from "@/lib/ap-order-email";

const SENDER_DOMAIN = "notify.delagraineaujardin.com";
const FROM_DOMAIN = "delagraineaujardin.com";
const CONTACT = "contact@delagraineaujardin.com";
const APP_ORIGIN = "https://crjardin.lovable.app";

export interface ApOrderEmailInput {
  to: string;
  pdfUrl: string;
  ackToken: string;
  idempotencyKey: string;
}

export async function sendApOrderEmail(
  input: ApOrderEmailInput,
): Promise<
  { sent: true; messageId: string | null } | { sent: false; reason: "recipient_suppressed" }
> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const ackUrl = `${APP_ORIGIN}/api/public/ap-order-ack?t=${encodeURIComponent(input.ackToken)}`;
  const { subject, text, html } = buildApOrderEmail({ pdfUrl: input.pdfUrl, ackUrl });
  try {
    const response = await sendLovableEmail(
      {
        to: input.to,
        from: `${AP_ORDER_SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        reply_to: CONTACT,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "ap-supplier-order",
        idempotency_key: input.idempotencyKey,
      },
      { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
    );
    return { sent: true, messageId: response?.message_id ?? null };
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      return { sent: false, reason: "recipient_suppressed" };
    }
    throw error;
  }
}
