/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";

// Appelé par le déclencheur SQL à chaque nouvelle notification : envoie le push (FCM) aux
// téléphones de l'utilisateur concerné. Aucune donnée n'est lue dans la requête : seule
// l'identifiant de notification compte, et chaque notification n'est poussée qu'une fois.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          notification_id?: string;
        } | null;
        const id = body?.notification_id;
        if (!id || !UUID.test(id)) return new Response("bad request", { status: 400 });

        const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
        // Colonne push_sent_at et table push_tokens absentes des types générés
        const supabaseAdmin = admin as any;
        const { readServiceAccount, sendPush, notificationUrl } =
          await import("@/lib/push-fcm.server");
        const sa = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (!sa) return new Response("push not configured", { status: 202 });

        // Réserve la notification (une seule émission, seulement si récente)
        const since = new Date(Date.now() - 10 * 60_000).toISOString();
        const { data: claimed } = await supabaseAdmin
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", id)
          .is("push_sent_at", null)
          .gte("created_at", since)
          .select("user_id,type,title,body,client_id")
          .maybeSingle();
        if (!claimed) return new Response("ok", { status: 200 });

        const { data: rows } = await supabaseAdmin
          .from("push_tokens")
          .select("token")
          .eq("user_id", claimed.user_id);
        const tokens = ((rows ?? []) as Array<{ token: string }>).map((r) => r.token);
        if (tokens.length === 0) return new Response("ok", { status: 200 });

        const { invalid } = await sendPush(sa, tokens, {
          title: claimed.title as string,
          body: claimed.body as string | null,
          url: notificationUrl(claimed as { type: string; client_id: string | null }),
        });
        if (invalid.length > 0) {
          await supabaseAdmin.from("push_tokens").delete().in("token", invalid);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
