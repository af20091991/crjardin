// prettier-ignore
import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Envoie une vraie notification push (FCM) aux téléphones enregistrés de l'utilisateur connecté.
 * Aucune ligne n'est créée dans la cloche : la notification s'affiche sur le téléphone,
 * appli fermée ou ouverte.
 */
// prettier-ignore
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { readServiceAccount, sendPush } = await import("@/lib/push-fcm.server");

    const sa = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!sa) throw new Error("Push non configuré (secret FIREBASE_SERVICE_ACCOUNT absent).");

    // Table push_tokens absente des types générés
    type LooseDb = {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => Promise<{ data: unknown; error: unknown }>;
        };
        delete: () => { in: (col: string, vals: string[]) => Promise<unknown> };
      };
    };
    const db = supabaseAdmin as unknown as LooseDb;
    const { data: rows, error } = await db
      .from("push_tokens")
      .select("token")
      .eq("user_id", context.userId);
    if (error) throw error;
    const tokens = ((rows ?? []) as Array<{ token: string }>).map((r) => r.token);
    if (tokens.length === 0) {
      throw new Error("Aucun téléphone enregistré pour ce compte. Ouvrez l'APK en étant connecté.");
    }

    const { sent, invalid } = await sendPush(sa, tokens, {
      title: "Test de notification APK PUSH",
      body: "Touchez cette notification : l'application doit ouvrir la page SST.",
      // Page distincte de l'accueil : si l'app était déjà sur « / », le toucher ne se voit pas.
      url: "/pilot/sst",
    });
    if (invalid.length > 0) {
      await db.from("push_tokens").delete().in("token", invalid);
    }
    return { sent, invalid: invalid.length };
  });
