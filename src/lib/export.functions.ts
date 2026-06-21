import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXPORT_TABLES = [
  "profiles",
  "user_roles",
  "clients",
  "interventions",
  "intervention_tasks",
  "intervention_photos",
  "recommendations",
  "garden_health",
  "client_messages",
  "notifications",
  "reminders",
  "report_templates",
  "favorite_tasks",
  "planning_notes",
  "email_settings",
  "email_send_log",
  "admin_audit_log",
] as const;

/**
 * Admin-only: full data export of the application as a single JSON document,
 * so the app can be duplicated elsewhere.
 */
export const exportFullData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const db = supabaseAdmin as unknown as {
      from: (t: string) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
    };
    const tables: Record<string, unknown> = {};
    for (const table of EXPORT_TABLES) {
      const { data, error } = await db.from(table).select("*");
      if (error) throw new Error(`${table}: ${error.message}`);
      tables[table] = data ?? [];
    }

    const payload = {
      exported_at: new Date().toISOString(),
      version: 1,
      tables,
    };
    // Return as a JSON string to keep the RPC return type serializable.
    return { json: JSON.stringify(payload) };
  });
