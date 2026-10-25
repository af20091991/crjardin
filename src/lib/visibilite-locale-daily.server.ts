import { fetchAllCaRows } from "@/lib/pilot-ca-fetch";
import { SITE_WEB_SITE_URL } from "@/lib/site-web-config";
import { TARGET_COMMUNES } from "@/lib/visibilite-locale";
import { SALE_COLUMNS, loadVisibilityRadar, type SaleRow } from "@/lib/visibilite-locale-data";
import type { CommuneTravel } from "@/lib/visibilite-locale-geo";
import type { Snapshot, SnapshotOpportunity } from "@/lib/visibilite-locale-follow";
import { loadSnapshots, loose, runRadarFollowUp } from "@/lib/visibilite-locale-follow.server";

/** Propriétaire de la connexion Search Console qui est aussi administrateur. */
async function findOwner(admin: unknown): Promise<string | null> {
  const { data: connections } = await loose(admin)
    .from("site_web_connections")
    .select("user_id, provider, status");
  const candidates = (
    (connections as Array<{ user_id: string; provider: string; status: string }> | null) ?? []
  )
    .filter((c) => c.provider === "google_search_console" && c.status === "connected")
    .map((c) => c.user_id);
  for (const userId of candidates) {
    const { data: roles } = await loose(admin)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (((roles as unknown[] | null) ?? []).length > 0) return userId;
  }
  return null;
}

/** Trajets conservés dans le dernier instantané (le calcul d'itinéraire exige une session). */
function travelFromSnapshots(snapshots: Snapshot[]): CommuneTravel {
  const minutes: Record<string, number | null> = {};
  const km: Record<string, number | null> = {};
  for (const c of TARGET_COMMUNES) {
    minutes[c.name] = null;
    km[c.name] = null;
  }
  const sorted = [...snapshots].sort((a, b) => b.taken_on.localeCompare(a.taken_on));
  for (const snap of sorted) {
    for (const o of snap.opportunities) {
      if (minutes[o.commune] == null && typeof o.travelMinutes === "number") {
        minutes[o.commune] = o.travelMinutes;
      }
      if (km[o.commune] == null && typeof o.travelKm === "number") km[o.commune] = o.travelKm;
    }
  }
  return { minutes, km, estimated: false };
}

export interface DailyResult {
  ok: boolean;
  reason?: string;
  alerts?: number;
  reportSent?: boolean;
}

export async function runDailyRadar(): Promise<DailyResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { ok: false, reason: "configuration serveur incomplète" };

  const ownerId = await findOwner(admin);
  if (!ownerId) return { ok: false, reason: "aucune connexion Search Console administrateur" };

  const snapshots = await loadSnapshots(admin);
  const radar = await loadVisibilityRadar(undefined, {
    searchConsole: async (period) => {
      const response = await fetch(`${supabaseUrl}/functions/v1/site-web-api`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "x-act-as-user": ownerId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "google_search_console",
          action: "search_analytics",
          siteUrl: SITE_WEB_SITE_URL,
          ...period,
          dimensions: ["query"],
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        rows?: Array<{
          keys?: string[];
          clicks: number;
          impressions: number;
          ctr: number;
          position: number;
        }>;
        error?: string;
      } | null;
      if (!response.ok || !payload || payload.error) {
        return { data: null, error: payload?.error ?? `Search Console ${response.status}` };
      }
      return { data: payload, error: null };
    },
    sales: () => fetchAllCaRows<SaleRow>(SALE_COLUMNS, { kind: "vente" }, undefined, supabaseAdmin),
    travel: async () => travelFromSnapshots(snapshots),
  });

  const opportunities: SnapshotOpportunity[] = radar.opportunities.map((o) => ({
    key: o.key,
    prestation: o.prestation,
    commune: o.commune,
    score: o.score,
    impressions: o.impressions,
    clicks: o.clicks,
    position: o.position,
    travelMinutes: o.travelMinutes,
    travelKm: o.travelKm,
  }));
  const result = await runRadarFollowUp(ownerId, opportunities);
  return result.ok
    ? { ok: true, alerts: result.alerts, reportSent: result.reportSent }
    : { ok: false, reason: "instantané non enregistré" };
}
