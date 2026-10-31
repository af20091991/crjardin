import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ORIGIN = "https://crjardin.lovable.app";

function cleanId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * E-mail au prestataire lorsqu'une mission lui est attribuée (création).
 * Seul cas e-mail : les autres notifications restent dans l'appli.
 * Destinataires : adresse de la fiche sous-traitant + adresse du compte lié.
 */
export const sendSstMissionAssignedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { missionId: string }) => ({ missionId: cleanId(d?.missionId) }))
  .handler(async ({ data }) => {
    if (!data.missionId) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendReportEmail } = await import("@/lib/email/report-send.server");
    const { uniqueEmails } = await import("@/lib/email/subcontractor-emails.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: mission, error } = await db
      .from("subcontractor_missions")
      .select("id, subcontractor_id, mission_date, service_requested, instructions")
      .eq("id", data.missionId)
      .maybeSingle();
    if (error || !mission?.subcontractor_id) return { sent: 0 };

    const { data: sub } = await db
      .from("subcontractors")
      .select("name, email, auth_user_id, active")
      .eq("id", mission.subcontractor_id)
      .maybeSingle();
    if (!sub?.active) return { sent: 0 };

    let accountEmail: string | null = null;
    if (sub.auth_user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(sub.auth_user_id);
      accountEmail = userData?.user?.email ?? null;
    }
    const emails = uniqueEmails([sub.email, accountEmail]);
    if (emails.length === 0) return { sent: 0 };

    let sent = 0;
    for (const email of emails) {
      try {
        await sendReportEmail({
          templateName: "sst-mission-assigned",
          recipientEmail: email,
          idempotencyKey: `sst-mission-assigned-${mission.id}-${email}`,
          templateData: {
            subcontractorName: sub.name,
            serviceRequested: mission.service_requested,
            dateLabel: dateLabel(mission.mission_date),
            instructions: mission.instructions ?? null,
            missionUrl: `${APP_ORIGIN}/sst`,
          },
        });
        sent += 1;
      } catch (mailError) {
        console.error("[sst-mission] e-mail d'attribution non envoyé", mailError);
      }
    }
    return { sent };
  });
