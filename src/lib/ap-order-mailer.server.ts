// Assistant AP — envoi d'une commande fournisseur par e-mail (texte + lien vers le PDF).
// Server-only. Pas de pixel de suivi, pas de pièce jointe, pas de raccourcisseur d'URL :
// le message reste sobre pour limiter les risques de filtrage anti-spam.
import { EmailAPIError, sendLovableEmail } from "@lovable.dev/email-js";

const SENDER_DOMAIN = "notify.delagraineaujardin.com";
const FROM_DOMAIN = "delagraineaujardin.com";
const SITE_NAME = "De la graine au jardin";
const CONTACT = "contact@delagraineaujardin.com";

export interface ApOrderEmailInput {
  to: string;
  supplierName: string;
  worksiteLabel: string;
  orderText: string;
  pdfUrl: string;
  idempotencyKey: string;
}

export function buildApOrderEmail(input: Omit<ApOrderEmailInput, "to" | "idempotencyKey">) {
  const subject = `Commande de fournitures — ${input.worksiteLabel.trim() || input.supplierName}`;
  const confirm =
    "Merci de bien vouloir me confirmer le disponible et la prise en compte de la commande ci-dessus.";
  const text = [
    "Bonjour,",
    "",
    "Veuillez trouver notre commande de fournitures ci-dessous, ainsi qu'en PDF :",
    input.pdfUrl,
    "",
    input.orderText,
    "",
    confirm,
    "",
    "Cordialement,",
    SITE_NAME,
    CONTACT,
  ].join("\n");
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:14px;color:#222">
<p>Bonjour,</p>
<p>Veuillez trouver notre commande de fournitures ci-dessous, ainsi qu'en <a href="${esc(input.pdfUrl)}">PDF</a> :</p>
<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${esc(input.orderText)}</pre>
<p>${esc(confirm)}</p>
<p>Cordialement,<br>${esc(SITE_NAME)}<br>${esc(CONTACT)}</p>
</body></html>`;
  return { subject, text, html };
}

export async function sendApOrderEmail(
  input: ApOrderEmailInput,
): Promise<{ sent: true } | { sent: false; reason: "recipient_suppressed" }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const { subject, text, html } = buildApOrderEmail(input);
  try {
    await sendLovableEmail(
      {
        to: input.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
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
    return { sent: true };
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === "recipient_suppressed") {
      return { sent: false, reason: "recipient_suppressed" };
    }
    throw error;
  }
}
