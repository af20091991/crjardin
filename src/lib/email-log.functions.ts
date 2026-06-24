import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EmailLogEntry {
  id: string;
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  opened_at: string | null;
  open_count: number | null;
}

/** Admin-only: latest status per email (deduplicated by message_id). */
export const listEmailLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    // Deduplicate by message_id, keeping the latest row (already sorted desc).
    const seen = new Set<string>();
    const result: EmailLogEntry[] = [];
    for (const row of (data ?? []) as Omit<EmailLogEntry, "opened_at" | "open_count">[]) {
      const key = row.message_id ?? row.id;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...row, opened_at: null, open_count: null });
    }

    // Merge open-tracking data keyed by message_id.
    const messageIds = result
      .map((r) => r.message_id)
      .filter((id): id is string => Boolean(id));
    if (messageIds.length) {
      const { data: opens } = await supabaseAdmin
        .from("email_opens")
        .select("message_id, opened_at, open_count")
        .in("message_id", messageIds);
      const byId = new Map(
        (opens ?? []).map((o) => [o.message_id, o]),
      );
      for (const row of result) {
        if (!row.message_id) continue;
        const open = byId.get(row.message_id);
        if (open) {
          row.opened_at = open.opened_at;
          row.open_count = open.open_count;
        }
      }
    }

    return result;
  });
