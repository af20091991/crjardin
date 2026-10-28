import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isConcernedBySstChange } from "@/lib/sst-calendar-recipients";

const APP_ORIGIN = "https://crjardin.lovable.app";

interface ChangeRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  entity: "availability" | "worksite";
  owner_id: string | null;
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

function describeLine(line: { label: string; from: string | null; to: string | null }): string {
  return line.from == null && line.to == null
    ? line.label
    : `${line.label} : ${line.from ?? "—"} → ${line.to ?? "—"}`;
}

const MAX_IDS = 200;

function cleanIds(ids: unknown): string[] {
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string").slice(0, MAX_IDS)
    : [];
}

/**
 * L'auteur choisit de notifier : les modifications indiquées (et qui lui appartiennent, encore en attente)
 * sont « réservées » de façon atomique (aucun doublon), puis alertes dans l'appli + e-mail partent
 * vers les utilisateurs concernés, hors auteur.
 */
export const notifySstCalendarChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; recipientIds: string[] }) => ({
    ids: cleanIds(d?.ids),
    recipientIds: cleanIds(d?.recipientIds),
  }))
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0 || data.recipientIds.length === 0) return { sent: 0, changes: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendReportEmail } = await import("@/lib/email/report-send.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const { data: claimed, error } = await db
      .from("sst_calendar_changes")
      .update({ notify_decision: "sent", emailed_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("actor_id", context.userId)
      .is("notify_decision", null)
      .select("id, created_at, actor_id, entity, owner_id, summary, details");
    if (error || !claimed || claimed.length === 0) return { sent: 0, changes: 0 };
    const changes = claimed as ChangeRow[];

    // Seuls les membres (rôle) et propriétaires de fiches peuvent être choisis ; jamais l'auteur.
    const { data: roles } = await db.from("user_roles").select("user_id");
    const eligible = new Set<string>([
      ...((roles ?? []) as Array<{ user_id: string }>).map((row) => row.user_id),
      ...changes.map((change) => change.owner_id).filter((id): id is string => !!id),
    ]);
    const recipients = Array.from(new Set(data.recipientIds)).filter(
      (id) => eligible.has(id) && id !== context.userId,
    );

    let sent = 0;
    let failures = 0;
    for (const recipientId of recipients) {
      const mine = [...changes].sort((a, b) => a.created_at.localeCompare(b.created_at));

      // Alerte dans l'appli (cloche).
      const { error: notifError } = await db.from("notifications").insert(
        mine.map((change) => ({
          user_id: recipientId,
          type: "sst_calendar",
          title: change.summary,
          body: (change.details ?? []).map(describeLine).join(" · ") || null,
        })),
      );
      if (notifError) console.error("[sst-calendar] alerte appli non créée", notifError.message);

      // E-mail : adresse du compte + adresse de la fiche sous-traitant éventuelle.
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(recipientId);
      const { data: profileRow } = await db
        .from("profiles")
        .select("display_name")
        .eq("id", recipientId)
        .maybeSingle();
      const { loadSubcontractorEmails, matchSubcontractorEmail, uniqueEmails } =
        await import("@/lib/email/subcontractor-emails.server");
      const ficheEmail = profileRow?.display_name
        ? matchSubcontractorEmail(await loadSubcontractorEmails(), profileRow.display_name)
        : null;
      const emails = uniqueEmails([userData?.user?.email, ficheEmail]);
      if (emails.length === 0) {
        failures += 1;
        continue;
      }
      let delivered = false;
      for (const email of emails) {
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
          delivered = true;
        } catch (mailError) {
          console.error("[sst-calendar] e-mail de modification non envoyé", mailError);
        }
      }
      if (delivered) sent += 1;
      else failures += 1;
    }

    return { sent, changes: changes.length, failures, recipients: recipients.length };
  });

export interface SstNotifyCandidate {
  id: string;
  label: string;
  /** Coché par défaut : la personne est directement concernée par au moins une des modifications. */
  concerned: boolean;
}

/** Destinataires proposables à l'auteur pour ses modifications en attente (auteur exclu). */
export const listSstNotifyCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => ({ ids: cleanIds(d?.ids) }))
  .handler(async ({ data, context }): Promise<SstNotifyCandidate[]> => {
    if (data.ids.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: rows } = await db
      .from("sst_calendar_changes")
      .select("id, created_at, actor_id, entity, owner_id, summary, details")
      .in("id", data.ids)
      .eq("actor_id", context.userId)
      .is("notify_decision", null);
    const changes = (rows ?? []) as ChangeRow[];
    if (changes.length === 0) return [];

    const { data: roles } = await db.from("user_roles").select("user_id, role");
    const roleRows = (roles ?? []) as Array<{ user_id: string; role: string }>;
    const adminIds = new Set(
      roleRows.filter((row) => row.role === "admin").map((row) => row.user_id),
    );
    const ids = Array.from(
      new Set([
        ...roleRows.map((row) => row.user_id),
        ...changes.map((change) => change.owner_id).filter((id): id is string => !!id),
      ]),
    ).filter((id) => id !== context.userId);
    if (ids.length === 0) return [];

    const { data: profiles } = await db
      .from("profiles")
      .select("id, display_name, company_name")
      .in("id", ids);
    const labels = new Map<string, string>();
    for (const p of (profiles ?? []) as Array<{
      id: string;
      display_name: string | null;
      company_name: string | null;
    }>) {
      const label = p.display_name?.trim() || p.company_name?.trim();
      if (label) labels.set(p.id, label);
    }
    return ids
      .map((id) => ({
        id,
        label: labels.get(id) ?? "Utilisateur PP",
        concerned: changes.some((change) => isConcernedBySstChange(change, id, adminIds)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  });

/** L'auteur choisit de ne pas notifier : les modifications ne sont plus proposées. */
export const skipSstCalendarChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => ({ ids: cleanIds(d?.ids) }))
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0) return { skipped: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data: rows } = await db
      .from("sst_calendar_changes")
      .update({ notify_decision: "skipped" })
      .in("id", data.ids)
      .eq("actor_id", context.userId)
      .is("notify_decision", null)
      .select("id");
    return { skipped: (rows ?? []).length };
  });
