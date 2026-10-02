// prettier-ignore
import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// prettier-ignore
import { template as premiumWelcomeTemplate } from "@/lib/email-templates/premium-welcome";
import { template as premiumReplyTemplate } from "@/lib/email-templates/premium-reply";

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
  .inputValidator((input: { clientId: string; resend?: boolean }) => input)
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

    const { sendPremiumMailToAll } = await import("@/lib/premium-mailer.server");
    const results = await sendPremiumMailToAll({
      supabaseAdmin,
      client,
      templateName: TEMPLATE_NAME,
      subject: "Votre Compte Premium est prêt — De la graine au jardin",
      component: premiumWelcomeTemplate.component,
      skipAlreadySent: !data.resend,
    });
    return { results };
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

// prettier-ignore
export const sendPremiumReplyNotification = createServerFn({ method: "POST" })
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
    const { data: premium } = await supabaseAdmin
      .from("client_premium")
      .select("enabled")
      .eq("client_id", client.id)
      .maybeSingle();
    if (!premium?.enabled) throw new Error("Le Compte Premium n’est pas actif pour ce client.");
    const { sendPremiumMailToAll } = await import("@/lib/premium-mailer.server");
    const results = await sendPremiumMailToAll({
      supabaseAdmin,
      client,
      templateName: "premium-reply",
      subject: "J'ai répondu à votre message — De la graine au jardin",
      component: premiumReplyTemplate.component,
      skipAlreadySent: false,
    });
    return { results };
  });
