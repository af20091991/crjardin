import { createFileRoute } from "@tanstack/react-router";

// Backup PP CA hebdomadaire — appelé par pg_cron (dimanche 01:00 et 02:00 UTC).
// En-tête requis : x-pp-backup-key: <PP_CA_BACKUP_CRON_SECRET>.
// N'exécute que si l'heure Europe/Paris est 03h un dimanche, une fois par semaine.

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

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
        const secret = process.env["PP_CA_BACKUP_CRON_SECRET"];
        if (!secret) return Response.json({ error: "not configured" }, { status: 503 });
        const key = request.headers.get("x-pp-backup-key") ?? "";
        if (!safeEqual(key, secret)) return Response.json({ error: "unauthorized" }, { status: 401 });

        const now = new Date();
        const { weekday, hour } = parisNow(now);
        if (weekday !== "Sun" || hour !== "03") {
          return Response.json({ skipped: "hors créneau dimanche 03h Europe/Paris" });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(now.getTime() - 6 * 86_400_000).toISOString();
        const { count } = await supabaseAdmin
          .from("pp_backup_runs")
          .select("id", { count: "exact", head: true })
          .eq("trigger", "auto")
          .eq("status", "success")
          .gte("created_at", since);
        if ((count ?? 0) > 0) return Response.json({ skipped: "déjà exécuté cette semaine" });

        const { runCaBackup } = await import("@/lib/pp-ca-backup.server");
        const result = await runCaBackup("auto", null);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
