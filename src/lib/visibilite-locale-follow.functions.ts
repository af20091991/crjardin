import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SnapshotOpportunity } from "@/lib/visibilite-locale-follow";

function validate(data: { opportunities: SnapshotOpportunity[] }) {
  if (!Array.isArray(data?.opportunities)) throw new Error("Données invalides");
  return {
    opportunities: data.opportunities.slice(0, 200).map((o) => ({
      key: String(o.key),
      prestation: String(o.prestation),
      commune: String(o.commune),
      score: Number(o.score) || 0,
      impressions: Number(o.impressions) || 0,
      clicks: Number(o.clicks) || 0,
      position: Number(o.position) || 0,
      travelMinutes: typeof o.travelMinutes === "number" ? o.travelMinutes : null,
      travelKm: typeof o.travelKm === "number" ? o.travelKm : null,
    })),
  };
}

async function assertAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Response("Forbidden", { status: 403 });
}

/** À chaque ouverture du Radar par l'admin : instantané, alertes et rapport mensuel. */
export const syncRadarFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runRadarFollowUp } = await import("@/lib/visibilite-locale-follow.server");
    return runRadarFollowUp(context.userId, data.opportunities);
  });

/** Suivi avant/après des pages préparées. */
export const listPageFollowUp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadSnapshots, followUpPages } = await import("@/lib/visibilite-locale-follow.server");
    return followUpPages(supabaseAdmin, await loadSnapshots(supabaseAdmin));
  });
