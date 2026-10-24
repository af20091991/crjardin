import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  MEASURE_DAYS,
  MEASURE_DAYS_LONG,
  measureEffect,
  newStrongOpportunities,
  previousMonth,
  topOpportunities,
  type Effect,
  type Snapshot,
  type SnapshotOpportunity,
} from "@/lib/visibilite-locale-follow";

const APP_ORIGIN = "https://crjardin.lovable.app";

// Tables du suivi absentes des types générés tant que Lovable ne les a pas régénérés.
type Result = PromiseLike<{ data: unknown; error: unknown }>;
type Chain = Result & { [method: string]: (...args: unknown[]) => Chain };
interface LooseDb {
  from: (table: string) => Chain;
}
const loose = (client: unknown) => client as LooseDb;

const parisDate = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);

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

const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const opportunityLabel = (o: SnapshotOpportunity) => `${o.prestation} · ${o.commune}`;

function pageStatus(effect: Effect): string {
  if (effect.status === "attente") {
    return `mesure disponible le ${effect.availableOn.split("-").reverse().join("/")}`;
  }
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return `clics ${sign(effect.deltaClicks ?? 0)}, impressions ${sign(effect.deltaImpressions ?? 0)}, position ${sign(effect.deltaPosition ?? 0)}`;
}

async function loadSnapshots(admin: unknown): Promise<Snapshot[]> {
  const { data } = await loose(admin).from("radar_snapshots").select("taken_on, opportunities");
  return (data as Snapshot[] | null) ?? [];
}

export interface PageFollowUp {
  slug: string;
  prestation: string;
  commune: string;
  createdAt: string;
  editUrl: string | null;
  effect: Effect;
  longEffect: Effect;
}

async function followUpPages(admin: unknown, snapshots: Snapshot[]): Promise<PageFollowUp[]> {
  const { data } = await loose(admin)
    .from("local_pages")
    .select("slug, prestation, commune, created_at, wp_edit_url");
  const rows =
    (data as Array<{
      slug: string;
      prestation: string;
      commune: string;
      created_at: string;
      wp_edit_url: string | null;
    }> | null) ?? [];
  return rows.map((r) => {
    const key = `${r.prestation}|${r.commune}`;
    return {
      slug: r.slug,
      prestation: r.prestation,
      commune: r.commune,
      createdAt: r.created_at,
      editUrl: r.wp_edit_url,
      effect: measureEffect(snapshots, key, r.created_at, MEASURE_DAYS),
      longEffect: measureEffect(snapshots, key, r.created_at, MEASURE_DAYS_LONG),
    };
  });
}

/**
 * À chaque ouverture du Radar par l'admin : enregistre l'instantané du jour,
 * signale (cloche) les nouvelles opportunités fortes et envoie le rapport du mois précédent (une fois).
 */
export const syncRadarFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown;
    const today = parisDate();

    const snapshotError = (
      await loose(admin)
        .from("radar_snapshots")
        .upsert({ taken_on: today, opportunities: data.opportunities })
    ).error;
    if (snapshotError) return { ok: false as const, alerts: 0, reportSent: false };

    // Alertes cloche : nouvelles opportunités fortes.
    const { data: alerted } = await loose(admin).from("radar_alerts").select("opportunity_key");
    const alertedKeys = new Set(
      ((alerted as Array<{ opportunity_key: string }> | null) ?? []).map((r) => r.opportunity_key),
    );
    const fresh = newStrongOpportunities(data.opportunities, alertedKeys);
    if (fresh.length > 0) {
      await loose(admin)
        .from("radar_alerts")
        .insert(fresh.map((o) => ({ opportunity_key: o.key, score: o.score })));
      await supabaseAdmin.from("notifications").insert({
        user_id: context.userId,
        type: "system_alert",
        title:
          fresh.length === 1
            ? `Opportunité forte : ${opportunityLabel(fresh[0])}`
            : `${fresh.length} opportunités fortes dans le Radar`,
        body: fresh
          .slice(0, 5)
          .map((o) => `${opportunityLabel(o)} (score ${Math.round(o.score)})`)
          .join(" · "),
      });
    }

    // Rapport mensuel (mois précédent), une seule fois, à l'utilisateur uniquement.
    let reportSent = false;
    const month = previousMonth(today);
    const { data: done } = await loose(admin)
      .from("radar_reports")
      .select("month")
      .eq("month", month);
    if (((done as unknown[] | null) ?? []).length === 0) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const email = userData?.user?.email?.trim();
      if (email) {
        // Réserve le mois avant l'envoi : évite un double envoi si deux onglets s'ouvrent.
        const claim = await loose(admin).from("radar_reports").insert({ month });
        if (!claim.error) {
          try {
            const snapshots = await loadSnapshots(admin);
            const pages = await followUpPages(admin, snapshots);
            const { sendReportEmail } = await import("@/lib/email/report-send.server");
            await sendReportEmail({
              templateName: "radar-monthly",
              recipientEmail: email,
              templateData: {
                monthLabel: monthLabel(month),
                radarUrl: `${APP_ORIGIN}/pilot/site-web`,
                top: topOpportunities(data.opportunities).map((o) => ({
                  label: opportunityLabel(o),
                  score: Math.round(o.score),
                  impressions: o.impressions,
                  clicks: o.clicks,
                })),
                pages: pages.map((p) => ({
                  label: `${p.prestation} · ${p.commune}`,
                  status: pageStatus(p.effect),
                })),
              },
            });
            reportSent = true;
          } catch (error) {
            console.error("[radar] rapport mensuel non envoyé", error);
            await loose(admin).from("radar_reports").delete().eq("month", month);
          }
        }
      }
    }
    return { ok: true as const, alerts: fresh.length, reportSent };
  });

/** Suivi avant/après des pages préparées. */
export const listPageFollowUp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const snapshots = await loadSnapshots(supabaseAdmin);
    return followUpPages(supabaseAdmin, snapshots);
  });
