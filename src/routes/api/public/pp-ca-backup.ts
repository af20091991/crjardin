import { createFileRoute } from "@tanstack/react-router";

// Backup PP CA hebdomadaire — appelé par pg_cron + pg_net (dimanche 01:00 et 02:00 UTC).
// En-tête requis : x-pp-backup-key (clé conservée dans Supabase Vault, vérifiée côté base
// par pp_ca_backup_key_ok ; elle n'apparaît ni dans le code ni dans les migrations).
// N'exécute que si l'heure Europe/Paris est 03h un dimanche, une seule fois par semaine.

function parisNow(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return {
    weekday: parts.find((p) => p.type === "weekday")?.value,
    hour: parts.find((p) => p.type === "hour")?.value,
  };
}

export const Route = createFileRoute("/api/public/pp-ca-backup")({
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

        const now = new Date();
        const { weekday, hour } = parisNow(now);
        if (weekday !== "Sun" || hour !== "03") {
          return Response.json({ skipped: "hors créneau dimanche 03h Europe/Paris" });
        }

        const { listBackupRuns, runCaBackup } = await import("@/lib/pp-ca-backup.server");
        const since = now.getTime() - 6 * 86_400_000;
        const recent = (await listBackupRuns(5)).some(
          (r) =>
            r.trigger === "auto" &&
            r.status === "success" &&
            new Date(r.created_at).getTime() >= since,
        );
        if (recent) return Response.json({ skipped: "déjà exécuté cette semaine" });

        const result = await runCaBackup("auto", null);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
