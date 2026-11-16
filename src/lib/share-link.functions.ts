// prettier-ignore
import { createServerFn } from "@tanstack/react-start";
// prettier-ignore
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Génère un nouveau lien client et invalide l'ancien.
 * La mise à jour passe par le client de l'utilisateur : les règles RLS décident
 * qui peut modifier la fiche.
 */
// prettier-ignore
export const regenerateClientShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => {
    if (!input?.clientId || typeof input.clientId !== "string") throw new Error("Client invalide");
    return input;
  })
  .handler(async ({ context, data }) => {
    const newToken = crypto.randomUUID().replace(/-/g, "");
    const { data: rows, error } = await context.supabase
      .from("clients")
      .update({ share_token: newToken })
      .eq("id", data.clientId)
      .select("share_token");
    if (error) throw error;
    if (!rows || rows.length === 0) throw new Error("Modification non autorisée.");
    return { token: newToken };
  });
