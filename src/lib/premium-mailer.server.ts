import { render } from "@react-email/render";
import React from "react";
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";
import { resolvePremiumClientIdentity } from "@/lib/premium-client-name";

const FROM = "De la graine au jardin <contact@delagraineaujardin.com>";
const SENDER_DOMAIN = "notify.delagraineaujardin.com";
export const PREMIUM_TRACKING_ORIGIN = "https://crjardin.lovable.app";

export type PremiumMailStatus = "sent" | "skipped" | "suppressed" | "failed";

export interface PremiumMailResult {
  recipient: string;
  status: PremiumMailStatus;
  error?: string;
}

export function collectClientEmails(client: {
  email?: string | null;
  emails?: string[] | null;
}): string[] {
  return Array.from(
    new Set(
      [...(client.emails ?? []), ...(client.email ? [client.email] : [])]
        .map((email) => email.trim())
        .filter(Boolean),
    ),
  );
}

interface MailClient {
  id: string;
  name: string;
  civility: string | null;
  email: string | null;
  emails: string[] | null;
  share_token: string;
  default_contact_id: string | null;
}

interface SendOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any;
  client: MailClient;
  templateName: string;
  subject: string;
  component: React.ComponentType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Ne pas renvoyer aux adresses déjà prévenues avec ce même objet. */
  skipAlreadySent: boolean;
}

/** Envoie le même e-mail Premium à toutes les adresses de la fiche client, une par une. */
export async function sendPremiumMailToAll(options: SendOptions): Promise<PremiumMailResult[]> {
  const { supabaseAdmin, client, templateName, subject, component, skipAlreadySent } = options;
  const recipients = collectClientEmails(client);
  if (recipients.length === 0)
    throw new Error("Aucune adresse e-mail n'est renseignée pour ce client.");

  let contact: {
    civility: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null = null;
  if (client.default_contact_id) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("civility, first_name, last_name")
      .eq("id", client.default_contact_id)
      .maybeSingle();
    contact = data;
  }
  const identity = resolvePremiumClientIdentity({
    name: client.name,
    civility: contact?.civility ?? client.civility,
    firstName: contact?.first_name,
    lastName: contact?.last_name,
  });

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const premiumUrl = `${PREMIUM_TRACKING_ORIGIN}/partage/${client.share_token}`;

  const alreadySent = new Set<string>();
  if (skipAlreadySent) {
    const { data } = await supabaseAdmin
      .from("premium_email_log")
      .select("recipient_email")
      .eq("client_id", client.id)
      .eq("subject", subject)
      .eq("status", "sent");
    for (const row of (data ?? []) as Array<{ recipient_email: string }>) {
      alreadySent.add(row.recipient_email.toLowerCase());
    }
  }

  const results: PremiumMailResult[] = [];
  for (const recipient of recipients) {
    if (alreadySent.has(recipient.toLowerCase())) {
      results.push({ recipient, status: "skipped" });
      continue;
    }
    const messageId = crypto.randomUUID();
    try {
      const { data: unsubscribeToken, error: unsubscribeError } = await supabaseAdmin.rpc(
        "get_or_create_unsubscribe_token",
        { p_email: recipient },
      );
      if (unsubscribeError || !unsubscribeToken) {
        throw unsubscribeError ?? new Error("Impossible de préparer le désabonnement.");
      }
      const element = React.createElement(component, {
        civility: identity.title || undefined,
        firstName: identity.firstName || undefined,
        lastName: identity.lastName || undefined,
        premiumUrl,
        unsubscribeUrl: `https://api.lovable.dev/v1/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`,
      });
      let html = await render(element);
      const text = await render(element, { plainText: true });
      const pixel = `<img src="${PREMIUM_TRACKING_ORIGIN}/api/public/email-open?m=${messageId}" width="1" height="1" alt="" style="display:none" />`;
      html = html.includes("</body>")
        ? html.replace("</body>", `${pixel}</body>`)
        : `${html}${pixel}`;

      const { error: logError } = await supabaseAdmin.from("premium_email_log").insert({
        message_id: messageId,
        client_id: client.id,
        recipient_email: recipient,
        civility: contact?.civility ?? client.civility,
        first_name: identity.firstName || null,
        last_name: identity.lastName || null,
        subject,
        premium_url: premiumUrl,
        html_body: html,
        text_body: text,
        status: "pending",
      });
      if (logError) throw logError;

      try {
        await sendLovableEmail(
          {
            to: recipient,
            from: FROM,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: "transactional",
            label: templateName,
            idempotency_key: messageId,
          },
          { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const suppressed = error instanceof EmailAPIError && error.code === "recipient_suppressed";
        await supabaseAdmin
          .from("premium_email_log")
          .update({
            status: suppressed ? "suppressed" : "failed",
            error_message: message.slice(0, 1000),
          })
          .eq("message_id", messageId);
        results.push({ recipient, status: suppressed ? "suppressed" : "failed", error: message });
        continue;
      }

      await supabaseAdmin
        .from("premium_email_log")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("message_id", messageId);
      results.push({ recipient, status: "sent" });
    } catch (error) {
      results.push({
        recipient,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
