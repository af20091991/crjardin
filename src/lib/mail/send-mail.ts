// Envoi d'e-mails transactionnels via l'API Resend (remplace @lovable.dev/email-js).
// Variable requise côté serveur : RESEND_API_KEY. L'expéditeur doit être un domaine vérifié dans Resend.

export class EmailAPIError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "EmailAPIError";
    this.code = code;
    this.status = status;
  }
}

export type SendMailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  sender_domain?: string;
  purpose?: string;
  reply_to?: string;
  idempotency_key?: string;
  [key: string]: unknown;
};

export async function sendLovableEmail(
  input: SendMailInput,
  _config?: { apiKey?: string; sendUrl?: string },
): Promise<{ id?: string; message_id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailAPIError("RESEND_API_KEY non configurée", "not_configured", 500);
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.reply_to,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    const code = res.status === 422 && /suppress/i.test(body.message ?? "") ? "recipient_suppressed" : (body.name ?? "send_failed");
    throw new EmailAPIError(body.message ?? `Envoi refusé (${res.status})`, code, res.status);
  }
  return { id: body.id, message_id: body.id };
}
