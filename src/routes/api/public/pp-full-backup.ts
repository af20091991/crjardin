import { createFileRoute } from "@tanstack/react-router";

// Sauvegarde complète quotidienne — appelée par pg_cron + pg_net (01:30 UTC).
// En-tête requis : x-pp-backup-key (même clé Vault que le backup CA, vérifiée par pp_ca_backup_key_ok).
export const Route = createFileRoute("/api/public/pp-full-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("x-pp-backup-key") ?? "";
        if (!key) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: allowed, error: keyErr } = await (
          supabaseAdmin as unknown as {
            rpc: (
              fn: string,
              args: Record<string, unknown>,
            ) => PromiseLike<{ data: unknown; error: unknown }>;
          }
        ).rpc("pp_ca_backup_key_ok", { p_key: key });
        if (keyErr) return Response.json({ error: "not configured" }, { status: 503 });
        if (allowed !== true) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { runFullBackup } = await import("@/lib/pp-full-backup.server");
        const result = await runFullBackup();
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
