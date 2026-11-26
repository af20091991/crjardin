import { createFileRoute } from "@tanstack/react-router";

// Temps de développement de PP — déclaré par Claude et les autres IA.
//   POST /api/public/dev-time   en-tête  x-dev-time-key: <DEV_TIME_SECRET>
//   corps JSON : { "seconds": 1800, "description": "Correctif CR client", "source": "claude" }
// Chaque appel ajoute une ligne au journal dev_time_log et au total (app_dev_time).
// Le temps d'utilisation de PP n'est jamais compté ici.

const BASE_HOURS_FALLBACK = 695;
const MAX_SECONDS = 86400;

export const Route = createFileRoute("/api/public/dev-time")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["DEV_TIME_SECRET"];
        if (!secret) {
          return Response.json({ error: "DEV_TIME_SECRET not configured" }, { status: 503 });
        }
        if (request.headers.get("x-dev-time-key") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { seconds?: unknown; description?: unknown; source?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "JSON invalide" }, { status: 400 });
        }
        const seconds = Math.round(Number(body.seconds));
        const description = typeof body.description === "string" ? body.description.trim() : "";
        const source =
          typeof body.source === "string" && body.source.trim() ? body.source.trim() : "ia";
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SECONDS) {
          return Response.json({ error: "seconds doit être entre 1 et 86400" }, { status: 400 });
        }
        if (!description) {
          return Response.json({ error: "description obligatoire" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { error: logError } = await supabaseAdmin
          .from("dev_time_log")
          .insert({ seconds, description, source });
        if (logError) return Response.json({ error: logError.message }, { status: 500 });

        const { data: current, error: readError } = await supabaseAdmin
          .from("app_dev_time")
          .select("base_hours, measured_seconds")
          .eq("id", 1)
          .maybeSingle();
        if (readError) return Response.json({ error: readError.message }, { status: 500 });

        const measured = Number(current?.measured_seconds ?? 0) + seconds;
        const base = Number(current?.base_hours ?? BASE_HOURS_FALLBACK);
        const { error: updateError } = await supabaseAdmin
          .from("app_dev_time")
          .update({ measured_seconds: measured })
          .eq("id", 1);
        if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

        return Response.json({
          added_seconds: seconds,
          total_hours: Math.round(base + measured / 3600),
        });
      },
    },
  },
});
