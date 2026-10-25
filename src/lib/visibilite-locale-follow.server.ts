import type { PageFollowUp, SnapshotOpportunity, Snapshot } from "@/lib/visibilite-locale-follow";
import {
  MEASURE_DAYS,
  MEASURE_DAYS_LONG,
  measureEffect,
  newStrongOpportunities,
  previousMonth,
  topOpportunities,
  type Effect,
} from "@/lib/visibilite-locale-follow";

const APP_ORIGIN = "https://crjardin.lovable.app";

// Tables du suivi absentes des types générés tant que Lovable ne les a pas régénérés.
type Result = PromiseLike<{ data: unknown; error: unknown }>;
type Chain = Result & { [method: string]: (...args: unknown[]) => Chain };
interface LooseDb {
  from: (table: string) => Chain;
}
export const loose = (client: unknown) => client as LooseDb;

export const parisDate = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);

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

export async function loadSnapshots(admin: unknown): Promise<Snapshot[]> {
  const { data } = await loose(admin).from("radar_snapshots").select("taken_on, opportunities");
  return (data as Snapshot[] | null) ?? [];
}

export async function followUpPages(
  admin: unknown,
  snapshots: Snapshot[],
): Promise<PageFollowUp[]> {
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

/** Instantané du jour, alertes cloche, rapport du mois précédent (une fois). Utilisé à l'ouverture du Radar et par la tâche quotidienne. */
export async function runRadarFollowUp(userId: string, opportunities: SnapshotOpportunity[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown;
  const today = parisDate();

  const snapshotError = (
    await loose(admin)
      .from("radar_snapshots")
      .upsert({ taken_on: today, opportunities: opportunities })
  ).error;
  if (snapshotError) return { ok: false as const, alerts: 0, reportSent: false };

  // Alertes cloche : nouvelles opportunités fortes.
  const { data: alerted } = await loose(admin).from("radar_alerts").select("opportunity_key");
  const alertedKeys = new Set(
    ((alerted as Array<{ opportunity_key: string }> | null) ?? []).map((r) => r.opportunity_key),
  );
  const fresh = newStrongOpportunities(opportunities, alertedKeys);
  if (fresh.length > 0) {
    await loose(admin)
      .from("radar_alerts")
      .insert(fresh.map((o) => ({ opportunity_key: o.key, score: o.score })));
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
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
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
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
              top: topOpportunities(opportunities).map((o) => ({
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
}
