import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BrevoEmailLogEntry {
  message_id: string;
  sender_email: string | null;
  recipient_email: string;
  subject: string | null;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  first_clicked_at: string | null;
  click_count: number;
  error_message: string | null;
  last_event_at: string;
}

/** Admin-only : historique des emails envoyés via Brevo. */
export const listBrevoEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fullQuery = () =>
      supabaseAdmin
        .from("brevo_email_log")
        .select(
          "message_id, sender_email, recipient_email, subject, status, sent_at, delivered_at, first_opened_at, open_count, first_clicked_at, click_count, error_message, last_event_at",
        )
        .order("sent_at", { ascending: false })
        .limit(500);

    const { data, error } = await fullQuery();

    if (!error) {
      return (data ?? []) as unknown as BrevoEmailLogEntry[];
    }

    // Compatibility fallback for an older production schema where the
    // status column is not yet visible to PostgREST. The previous query
    // shape is known to work and status can be reconstructed from events.
    const { data: legacyData, error: legacyError } = await supabaseAdmin
      .from("brevo_email_log")
      .select(
        "message_id, sender_email, recipient_email, subject, sent_at, delivered_at, first_opened_at, open_count, first_clicked_at, click_count, error_message, last_event_at",
      )
      .order("sent_at", { ascending: false })
      .limit(500);

    if (legacyError) throw error;

    return (legacyData ?? []).map((row) => ({
      ...row,
      status: row.error_message
        ? "error"
        : row.first_clicked_at
          ? "clicked"
          : row.first_opened_at
            ? "opened"
            : row.delivered_at
              ? "delivered"
              : "sent",
    })) as unknown as BrevoEmailLogEntry[];
  });
