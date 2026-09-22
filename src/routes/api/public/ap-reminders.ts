import { createFileRoute } from "@tanstack/react-router";

// Assistant AP — rappels approvisionnements J-10 / J-5 / J-3.
// Endpoint à appeler une fois par jour par un planificateur externe :
//   POST /api/public/ap-reminders  avec l'en-tête  x-ap-reminders-key: <AP_REMINDERS_SECRET>
// Un rappel n'est envoyé qu'une seule fois par chantier, échéance et destinataire
// (unicité garantie par la table ap_reminder_log).

const OFFSETS = [10, 5, 3] as const;

const STATUS_LABELS: Record<string, string> = {
  a_faire: "À faire",
  commande_reserve: "Commandé / réservé",
  retrait_livraison_prevu: "Retrait / livraison prévu",
  ok: "OK",
  a_relancer: "À relancer",
};
const MODE_LABELS: Record<string, string> = {
  retrait: "Retrait",
  livraison: "Livraison",
  stock: "Stock",
};

function frDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface SupplyRow {
  supplier: string;
  item: string;
  status: string;
  mode: string;
  fulfillment_date: string | null;
  comment: string | null;
}

function buildTemplateData(
  worksite: { client_label: string; scheduled_date: string; notes: string | null },
  supplies: SupplyRow[],
  offset: number,
) {
  const line = (s: SupplyRow) =>
    `${s.supplier} — ${s.item} (${STATUS_LABELS[s.status] ?? s.status}, ${MODE_LABELS[s.mode] ?? s.mode})`;
  return {
    clientLabel: worksite.client_label,
    dateLabel: frDate(worksite.scheduled_date),
    offsetLabel: `J-${offset}`,
    supplies: supplies.map(line),
    suppliers: Array.from(new Set(supplies.map((s) => s.supplier))),
    fulfillments: supplies
      .filter((s) => s.fulfillment_date && s.mode !== "stock")
      .map(
        (s) =>
          `${s.supplier} — ${s.item} : ${MODE_LABELS[s.mode] ?? s.mode} le ${frDate(s.fulfillment_date!)}`,
      ),
    okItems: supplies.filter((s) => s.status === "ok").map((s) => `${s.supplier} — ${s.item}`),
    todoItems: supplies
      .filter((s) => s.status !== "ok" && s.status !== "a_relancer")
      .map((s) => `${s.supplier} — ${s.item} (${STATUS_LABELS[s.status] ?? s.status})`),
    followUpItems: supplies
      .filter((s) => s.status === "a_relancer")
      .map((s) => `${s.supplier} — ${s.item}${s.comment ? ` — ${s.comment}` : ""}`),
    notes: worksite.notes,
  };
}

export const Route = createFileRoute("/api/public/ap-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AP_REMINDERS_SECRET"];
        if (!secret) {
          return Response.json({ error: "AP_REMINDERS_SECRET not configured" }, { status: 503 });
        }
        if (request.headers.get("x-ap-reminders-key") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendReportEmail } = await import("@/lib/email/report-send.server");

        // Destinataires : les comptes administrateurs de l'application.
        const { data: roles, error: rolesError } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (rolesError) {
          return Response.json({ error: rolesError.message }, { status: 500 });
        }
        const adminIds = new Set((roles ?? []).map((r) => r.user_id));
        const recipients: string[] = [];
        if (adminIds.size) {
          const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          if (usersError) {
            return Response.json({ error: usersError.message }, { status: 500 });
          }
          for (const u of users.users) {
            if (adminIds.has(u.id) && u.email) recipients.push(u.email);
          }
        }
        if (recipients.length === 0) {
          return Response.json({ sent: 0, skipped: 0, reason: "no_admin_recipient" });
        }

        const today = new Date().toISOString().slice(0, 10);
        let sent = 0;
        let skipped = 0;
        const failures: string[] = [];

        for (const offset of OFFSETS) {
          const target = addDays(today, offset);
          const { data: worksites, error } = await supabaseAdmin
            .from("ap_worksites")
            .select(
              "id, client_label, scheduled_date, notes, ap_supplies(supplier, item, status, mode, fulfillment_date, comment)",
            )
            .eq("scheduled_date", target);
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          for (const w of worksites ?? []) {
            const supplies = ((w as { ap_supplies?: SupplyRow[] }).ap_supplies ?? []) as SupplyRow[];
            const templateData = buildTemplateData(
              {
                client_label: w.client_label,
                scheduled_date: w.scheduled_date as string,
                notes: w.notes,
              },
              supplies,
              offset,
            );

            for (const recipient of recipients) {
              // Verrou d'unicité : si la ligne existe déjà, le rappel a déjà été envoyé.
              const { error: lockError } = await supabaseAdmin.from("ap_reminder_log").insert({
                worksite_id: w.id,
                offset_days: offset,
                recipient_email: recipient,
              });
              if (lockError) {
                skipped += 1;
                continue;
              }
              try {
                await sendReportEmail({
                  templateName: "ap-reminder",
                  recipientEmail: recipient,
                  idempotencyKey: `ap-reminder-${w.id}-${offset}-${recipient}`,
                  templateData,
                });
                sent += 1;
              } catch (e) {
                // L'envoi a échoué : on retire le verrou pour permettre un nouvel essai.
                await supabaseAdmin
                  .from("ap_reminder_log")
                  .delete()
                  .eq("worksite_id", w.id)
                  .eq("offset_days", offset)
                  .eq("recipient_email", recipient);
                failures.push(e instanceof Error ? e.message : String(e));
              }
            }
          }
        }

        return Response.json({ sent, skipped, failures });
      },
    },
  },
});
