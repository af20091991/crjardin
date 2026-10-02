import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ORIGIN = "https://crjardin.lovable.app";

interface ChangeRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  summary: string;
  details: Array<{ label: string; from: string | null; to: string | null }> | null;
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Envoie aux administrateurs un e-mail récapitulant les modifications du calendrier SST
 * pas encore notifiées. Appelée après chaque modification (par n'importe quel utilisateur) :
 * les lignes sont « réservées » de façon atomique, donc aucun doublon même en cas d'appels simultanés.
 */
export const flushSstCalendarChangeEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendReportEmail } = await import("@/lib/email/report-send.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: claimed, error } = await db
      .from("sst_calendar_changes")
      .update({ emailed_at: new Date().toISOString() })
      .is("emailed_at", null)
      .select("id, created_at, actor_id, summary, details");
    if (error || !claimed || claimed.length === 0) return { sent: 0, changes: 0 };
    const changes = claimed as ChangeRow[];

    const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "admin");
    const admins = ((roles ?? []) as Array<{ user_id: string }>).map((row) => row.user_id);

    let sent = 0;
    let failures = 0;
    for (const adminId of admins) {
      const mine = changes
        .filter((change) => change.actor_id !== adminId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
      if (mine.length === 0) continue;
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(adminId);
      const email = userData?.user?.email?.trim();
      if (!email) {
        failures += 1;
        continue;
      }
      try {
        await sendReportEmail({
          templateName: "sst-calendar-change",
          recipientEmail: email,
          templateData: {
            calendarUrl: `${APP_ORIGIN}/pilot/calendrier`,
            changes: mine.map((change) => ({
              summary: change.summary,
              whenLabel: whenLabel(change.created_at),
              lines: change.details ?? [],
            })),
          },
        });
        sent += 1;
      } catch (mailError) {
        failures += 1;
        console.error("[sst-calendar] e-mail de modification non envoyé", mailError);
      }
    }

    // Aucun e-mail parti : on remet les lignes en attente pour le prochain passage.
    if (sent === 0 && failures > 0) {
      await db
        .from("sst_calendar_changes")
        .update({ emailed_at: null })
        .in(
          "id",
          changes.map((change) => change.id),
        );
    }
    return { sent, changes: changes.length };
  });
