// prettier-ignore
import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Crée une notification de test adressée uniquement à l'utilisateur connecté.
 * L'insertion déclenche le push vers ses téléphones enregistrés.
 */
// prettier-ignore
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: context.userId,
        type: "test",
        title: "Test de notification APK PUSH",
        body: "Si vous voyez ceci sur votre téléphone, les notifications fonctionnent.",
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id as string };
  });
