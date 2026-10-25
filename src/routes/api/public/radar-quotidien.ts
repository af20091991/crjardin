import { createFileRoute } from "@tanstack/react-router";

// Actualisation quotidienne du Radar Visibilité locale — appelée par pg_cron + pg_net.
// En-tête requis : x-pp-backup-key (clé du Vault, vérifiée côté base par pp_ca_backup_key_ok).
// N'exécute que si l'heure Europe/Paris est 06h, une seule fois par jour.

function parisHour(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .find((p) => p.type === "hour")?.value;
}

export const Route = createFileRoute("/api/public/radar-quotidien")({
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

        if (parisHour(new Date()) !== "06") {
          return Response.json({ skipped: "hors créneau 06h Europe/Paris" });
        }

        const { parisDate, loose } = await import("@/lib/visibilite-locale-follow.server");
        const { data: done } = await loose(supabaseAdmin)
          .from("radar_snapshots")
          .select("taken_on")
          .eq("taken_on", parisDate());
        if (((done as unknown[] | null) ?? []).length > 0) {
          return Response.json({ skipped: "déjà exécuté aujourd'hui" });
        }

        const { runDailyRadar } = await import("@/lib/visibilite-locale-daily.server");
        try {
          const result = await runDailyRadar();
          return Response.json(result, { status: result.ok ? 200 : 500 });
        } catch (error) {
          console.error("[radar-quotidien]", error);
          return Response.json({ ok: false, reason: "erreur" }, { status: 500 });
        }
      },
    },
  },
});
