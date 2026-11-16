// prettier-ignore
import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// prettier-ignore
import { template as premiumNotificationTemplate } from "@/lib/email-templates/premium-notification";

/**
 * File de validation des notifications Premium.
 * Les lignes sont créées automatiquement par la base (migration 20261116100000) ;
 * seul le gérant décide, ligne par ligne, de les envoyer ou de ne pas les envoyer.
 */

// La table client_notifications n'est pas encore dans types.ts (généré) :
// accès non typé volontairement, à remplacer après resynchronisation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseDb = { from: (table: string) => any; rpc: (fn: string, args?: unknown) => any };

function assertAdmin(isAdmin: boolean | null | undefined) {
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  assertAdmin(isAdmin as boolean);
}

export interface ClientNotificationRow {
  id: string;
  client_id: string;
  kind: "cr" | "recommendation" | "document" | "photos" | "calendar" | "garden" | "message";
  title: string;
  body: string | null;
  status: "pending" | "sent" | "dismissed";
  created_at: string;
  sent_at: string | null;
}

// prettier-ignore
export const listClientNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LooseDb;
    const { data: rows, error } = await db
      .from("client_notifications")
      .select("id, client_id, kind, title, body, status, created_at, sent_at")
      .eq("client_id", data.clientId)
      .or(`status.eq.pending,and(status.eq.sent,sent_at.gt.${since})`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (rows ?? []) as ClientNotificationRow[];
  });

// prettier-ignore
export const decideClientNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; action: "send" | "dismiss" }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LooseDb;
    const { data: row, error: rowError } = await db
      .from("client_notifications")
      .select("id, client_id, title, body, status")
      .eq("id", data.id)
      .maybeSingle();
    if (rowError) throw rowError;
    if (!row) throw new Error("Notification introuvable.");
    if (row.status !== "pending") throw new Error("Cette notification a déjà été traitée.");

    const decidedAt = new Date().toISOString();
    if (data.action === "dismiss") {
      const { error } = await db
        .from("client_notifications")
        .update({ status: "dismissed", decided_at: decidedAt, decided_by: context.userId })
        .eq("id", row.id)
        .eq("status", "pending");
      if (error) throw error;
      return { ok: true, status: "dismissed" as const };
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, civility, email, emails, share_token, contract_type, default_contact_id")
      .eq("id", row.client_id)
      .is("merged_into_client_id", null)
      .single();
    if (clientError) throw clientError;

    const { sendPremiumMailToAll } = await import("@/lib/premium-mailer.server");
    const results = await sendPremiumMailToAll({
      supabaseAdmin,
      client,
      templateName: "premium-notification",
      subject: `${row.title} — De la graine au jardin`,
      component: premiumNotificationTemplate.component,
      skipAlreadySent: false,
      extraProps: { title: row.title, body: row.body },
    });
    const anySent = results.some((r) => r.status === "sent");
    if (!anySent) {
      throw new Error("Aucun e-mail n'a pu être envoyé. La notification reste en attente.");
    }

    const { error } = await db
      .from("client_notifications")
      .update({ status: "sent", sent_at: decidedAt, decided_at: decidedAt, decided_by: context.userId })
      .eq("id", row.id)
      .eq("status", "pending");
    if (error) throw error;
    return { ok: true, status: "sent" as const, results };
  });

// prettier-ignore
export const getSharedNotifications = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) => {
    if (!input?.token || typeof input.token !== "string") throw new Error("Lien invalide");
    return { token: input.token };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as LooseDb;
    const { data: rows, error } = await db.rpc("get_shared_notifications", { p_token: data.token });
    if (error) throw error;
    return (rows ?? []) as Array<{ id: string; kind: string; title: string; body: string | null; sent_at: string }>;
  });
