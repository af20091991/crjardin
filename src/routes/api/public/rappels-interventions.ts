import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dueReminders, type ReminderItem } from "@/lib/rappel-schedule";
import {
  buildClientRappelMail,
  splitWorks,
  RAPPEL_SENDER,
} from "@/lib/rappel-intervention-client-mail";

// Rappels d'intervention Premium — alerte de l'utilisateur (aucun envoi au client).
// Appel quotidien (ou horaire) par un planificateur externe :
//   POST /api/public/rappels-interventions  avec l'en-tête  x-rappels-key: <RAPPELS_INTERVENTIONS_SECRET>
// Pour chaque rappel dû : une alerte dans PP + un mail à l'utilisateur, avec le texte prêt à envoyer.
// Unicité garantie par client_premium_reminder_log (clé : intervention + délai).

const PP_PUBLIC_URL = "https://pp.delagraineaujardin.com";
const SENDER_DOMAIN = "notify.delagraineaujardin.com";
const FROM_DOMAIN = "delagraineaujardin.com";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const hourFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

function timeLabel(d: Date): string {
  const parts = hourFmt.formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}h${m}`;
}

interface Row {
  id: string;
  title: string;
  scheduled_at: string;
  reminder_hours: number[];
  user_id: string;
  clients: { name: string; share_token: string | null } | null;
}

export const Route = createFileRoute("/api/public/rappels-interventions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAPPELS_INTERVENTIONS_SECRET"];
        if (!secret) {
          return Response.json(
            { error: "RAPPELS_INTERVENTIONS_SECRET not configured" },
            { status: 503 },
          );
        }
        if (request.headers.get("x-rappels-key") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const apiKey = process.env["RESEND_API_KEY"];
        if (!apiKey)
          return Response.json({ error: "RESEND_API_KEY not configured" }, { status: 503 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendLovableEmail } = await import("@/lib/mail/send-mail");
        // Tables récentes absentes des types générés : client typé à la main.
        const db = supabaseAdmin as unknown as SupabaseClient<any>;

        const { data: rows, error } = await db
          .from("client_premium_work_calendar_items")
          .select("id,title,scheduled_at,reminder_hours,user_id,clients(name,share_token)")
          .not("scheduled_at", "is", null)
          .returns<Row[]>();
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const { data: logs, error: logError } = await db
          .from("client_premium_reminder_log")
          .select("item_id,reminder_hours");
        if (logError) return Response.json({ error: logError.message }, { status: 500 });
        const notified = new Set((logs ?? []).map((l) => `${l.item_id}:${l.reminder_hours}`));

        const items: ReminderItem[] = (rows ?? []).map((r) => ({
          id: r.id,
          scheduled_at: r.scheduled_at,
          reminder_hours: r.reminder_hours,
        }));
        const byId = new Map((rows ?? []).map((r) => [r.id, r]));
        const due = dueReminders(items, notified, new Date());

        let alerted = 0;
        const failures: string[] = [];
        for (const d of due) {
          const row = byId.get(d.itemId);
          if (!row || !row.clients) continue;

          // Réserve le rappel avant d'alerter : évite un doublon si l'appel est relancé.
          const { error: claimError } = await db
            .from("client_premium_reminder_log")
            .insert({ item_id: row.id, reminder_hours: d.hours });
          if (claimError) {
            failures.push(`${row.id}:${d.hours} — ${claimError.message}`);
            continue;
          }

          const start = new Date(row.scheduled_at);
          const premiumUrl = row.clients.share_token
            ? `${PP_PUBLIC_URL}/partage/${row.clients.share_token}`
            : PP_PUBLIC_URL;
          const mail = buildClientRappelMail({
            clientName: row.clients.name,
            dateLabel: dateFmt.format(start),
            timeLabel: timeLabel(start),
            works: splitWorks(row.title),
            premiumUrl,
          });
          const title = `Rappel à envoyer : ${row.clients.name}, intervention ${dateFmt.format(start)}`;

          await supabaseAdmin.from("notifications").insert({
            user_id: row.user_id,
            type: "rappel_intervention",
            title,
            body: `Rappel ${d.hours} h avant l'intervention. Mail prêt, à envoyer depuis ${RAPPEL_SENDER}.`,
            client_id: null,
          });

          const { data: owner } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          const to = owner?.user?.email;
          if (to) {
            try {
              await sendLovableEmail(
                {
                  to,
                  from: `PP rappels <noreply@${FROM_DOMAIN}>`,
                  sender_domain: SENDER_DOMAIN,
                  subject: `À envoyer : ${mail.subject}`,
                  html: `<p>Rappel ${d.hours} h avant l'intervention de ${row.clients.name}. Mail prêt, à envoyer depuis ${RAPPEL_SENDER} :</p><hr>${mail.html}`,
                  text: `Rappel ${d.hours} h avant l'intervention de ${row.clients.name}. Mail prêt, à envoyer depuis ${RAPPEL_SENDER} :\n\n${mail.text}`,
                  purpose: "transactional",
                  label: "rappel-intervention-alerte",
                  idempotency_key: `rappel-alerte-${row.id}-${d.hours}`,
                },
                { apiKey, sendUrl: process.env["LOVABLE_SEND_URL"] },
              );
            } catch (e) {
              failures.push(`${row.id}:${d.hours} mail — ${(e as Error).message}`);
            }
          }
          alerted++;
        }

        return Response.json({ due: due.length, alerted, failures });
      },
    },
  },
});
