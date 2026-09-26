import { createFileRoute } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";

type BrevoLogPatch = Database["public"]["Tables"]["brevo_email_log"]["Update"];

/**
 * Webhook public Brevo : reçoit un événement par appel (request, delivered,
 * opened, click, hard_bounce, soft_bounce, blocked, spam, invalid_email,
 * deferred, unsubscribed, error) pour les emails envoyés depuis
 * contact@delagraineaujardin.com, et met à jour public.brevo_email_log.
 *
 * Sécurité : le token partagé BREVO_WEBHOOK_SECRET doit être ajouté en
 * paramètre de requête (?token=...) dans l'URL du webhook configurée côté
 * Brevo — Brevo ne signe pas ses webhooks nativement.
 */

interface BrevoEvent {
  event: string;
  email?: string;
  ["message-id"]?: string;
  subject?: string;
  date?: string;
  reason?: string;
}

const BOUNCE_EVENTS = new Set([
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "invalid_email",
  "deferred",
]);

function ok() {
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/public/brevo-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["BREVO_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("BREVO_WEBHOOK_SECRET is not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== secret) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let payload: BrevoEvent;
        try {
          payload = (await request.json()) as BrevoEvent;
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        const messageId = payload["message-id"];
        const email = payload.email?.toLowerCase();
        if (!messageId || !email) {
          // Rien à rattacher (ex: événement de test Brevo sans message-id) — on acquitte quand même.
          return ok();
        }

        const now = new Date().toISOString();
        const eventDate = payload.date ? new Date(payload.date).toISOString() : now;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: existing } = await supabaseAdmin
            .from("brevo_email_log")
            .select("open_count, click_count, first_opened_at, first_clicked_at, status")
            .eq("message_id", messageId)
            .maybeSingle();

          const patch: BrevoLogPatch = { last_event_at: now };

          switch (payload.event) {
            case "request":
              patch.status = existing?.status ?? "sent";
              patch.sent_at = eventDate;
              patch.subject = payload.subject ?? null;
              break;
            case "delivered":
              if (!existing || existing.status === "sent") patch.status = "delivered";
              patch.delivered_at = eventDate;
              break;
            case "opened":
            case "unique_opened":
              // Brevo envoie "unique_opened" pour la toute première ouverture d'un
              // message, et "opened" pour celle-ci et les suivantes : les deux
              // comptent comme une ouverture.
              patch.status = existing?.status === "clicked" ? "clicked" : "opened";
              patch.open_count = (existing?.open_count ?? 0) + 1;
              if (!existing?.first_opened_at) patch.first_opened_at = eventDate;
              break;
            case "click":
              patch.status = "clicked";
              patch.click_count = (existing?.click_count ?? 0) + 1;
              if (!existing?.first_clicked_at) patch.first_clicked_at = eventDate;
              break;
            case "spam":
              patch.status = "spam";
              break;
            case "unsubscribed":
              patch.status = "unsubscribed";
              break;
            case "error":
              patch.status = "error";
              patch.error_message = payload.reason ?? "Erreur inconnue";
              break;
            default:
              if (BOUNCE_EVENTS.has(payload.event)) {
                patch.status = "bounced";
                patch.error_message = payload.reason ?? payload.event;
              } else {
                // Type d'événement non géré : on ignore sans échouer.
                return ok();
              }
          }

          if (existing) {
            const { error } = await supabaseAdmin
              .from("brevo_email_log")
              .update(patch)
              .eq("message_id", messageId);
            if (error) throw error;
          } else {
            const { error } = await supabaseAdmin.from("brevo_email_log").insert({
              message_id: messageId,
              recipient_email: email,
              ...patch,
            });
            if (error) throw error;
          }
        } catch (err) {
          console.error("brevo-webhook processing failed", err);
          // On acquitte quand même pour éviter que Brevo ne boucle en retry infini
          // sur un événement qu'on ne saura de toute façon pas traiter.
        }

        return ok();
      },
    },
  },
});
