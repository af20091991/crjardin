// prettier-ignore
import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { render } from "@react-email/render";
// prettier-ignore
import React from "react";
// prettier-ignore
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// prettier-ignore
import { template as premiumWelcomeTemplate } from "@/lib/email-templates/premium-welcome";

// prettier-ignore
// Premium invitation sender configuration.
const FROM = "De la graine au jardin <noreply@delagraineaujardin.com>";
// prettier-ignore
const SENDER_DOMAIN = "notify.delagraineaujardin.com";
// prettier-ignore
const TRACKING_ORIGIN = "https://crjardin.lovable.app";
// prettier-ignore
const TEMPLATE_NAME = "premium-welcome";

// prettier-ignore
export interface PremiumEmailLogEntry {
  id: string;
  message_id: string;
  client_id: string;
  recipient_email: string;
  civility: string | null;
  first_name: string | null;
  last_name: string | null;
  subject: string;
  premium_url: string;
  html_body: string;
  text_body: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  opened_at: string | null;
  open_count: number;
}

// prettier-ignore
function assertAdmin(isAdmin: boolean | null | undefined) {
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

// prettier-ignore
export const sendPremiumWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    assertAdmin(isAdmin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, civility, email, emails, share_token, contract_type, default_contact_id")
      .eq("id", data.clientId)
      .is("merged_into_client_id", null)
      .single();
    if (clientError) throw clientError;

    let contact: { civility: string | null; first_name: string | null; last_name: string | null } | null = null;
    if (client.default_contact_id) {
      const { data: contactData, error: contactError } = await supabaseAdmin
        .from("contacts")
        .select("civility, first_name, last_name")
        .eq("id", client.default_contact_id)
        .maybeSingle();
      if (contactError) throw contactError;
      contact = contactData;
    }

    if (client.contract_type !== "Entretien annuel") {
      throw new Error("Le Compte Premium est réservé aux clients ayant un entretien annuel.");
    }

    const { data: premium, error: premiumError } = await supabaseAdmin
      .from("client_premium")
      .select("enabled")
      .eq("client_id", client.id)
      .maybeSingle();
    if (premiumError) throw premiumError;
    if (!premium?.enabled) throw new Error("Le Compte Premium n’est pas actif pour ce client.");

    const recipient = (client.email ?? client.emails?.[0] ?? "").trim();
    if (!recipient) throw new Error("Aucune adresse e-mail n’est renseignée pour ce client.");

    const premiumUrl = `${TRACKING_ORIGIN}/partage/${client.share_token}`;
    const subject = "Votre Compte Premium est prêt — De la graine au jardin";
    const messageId = crypto.randomUUID();
    const templateData = {
      civility: contact?.civility ?? client.civility ?? undefined,
      firstName: contact?.first_name ?? undefined,
      lastName: contact?.last_name ?? client.name,
      premiumUrl,
    };
    const element = React.createElement(premiumWelcomeTemplate.component, templateData);
    let html = await render(element);
    const text = await render(element, { plainText: true });
    const trackingPixel = `<img src="${TRACKING_ORIGIN}/api/public/email-open?m=${messageId}" width="1" height="1" alt="" style="display:none" />`;
    html = html.includes("</body>") ? html.replace("</body>", `${trackingPixel}</body>`) : `${html}${trackingPixel}`;

    const { error: logError } = await supabaseAdmin.from("premium_email_log" as never).insert({
      message_id: messageId,
      client_id: client.id,
      recipient_email: recipient,
      civility: contact?.civility ?? client.civility,
      first_name: contact?.first_name,
      last_name: contact?.last_name ?? client.name,
      subject,
      premium_url: premiumUrl,
      html_body: html,
      text_body: text,
      status: "pending",
    } as never);
    if (logError) throw logError;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

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
          label: TEMPLATE_NAME,
          idempotency_key: messageId,
        },
        { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await supabaseAdmin
        .from("premium_email_log" as never)
        .update({ status: error instanceof EmailAPIError && error.code === "recipient_suppressed" ? "suppressed" : "failed", error_message: errorMessage.slice(0, 1000) } as never)
        .eq("message_id", messageId);
      throw error;
    }

    await supabaseAdmin
      .from("premium_email_log" as never)
      .update({ status: "sent", sent_at: new Date().toISOString() } as never)
      .eq("message_id", messageId);

    return { messageId, recipient, subject };
  });

// prettier-ignore
export const listPremiumEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    assertAdmin(isAdmin);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("premium_email_log" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = (data ?? []) as unknown as PremiumEmailLogEntry[];
    const messageIds = rows.map((row) => row.message_id);
    if (!messageIds.length) return rows;

    const { data: opens } = await supabaseAdmin
      .from("email_opens")
      .select("message_id, opened_at, open_count")
      .in("message_id", messageIds);
    const byId = new Map((opens ?? []).map((open) => [open.message_id, open]));
    return rows.map((row) => {
      const open = byId.get(row.message_id);
      return {
        ...row,
        opened_at: open?.opened_at ?? null,
        open_count: open?.open_count ?? 0,
      };
    });
  });
