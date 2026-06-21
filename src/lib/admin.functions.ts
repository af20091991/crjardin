import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-only: permanently delete a user account.
 * Removes the user's storage photos, all their app data, then the auth account.
 */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId || typeof data.userId !== "string") {
      throw new Error("userId requis");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    if (data.userId === context.userId) {
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Remove the user's stored photos from the bucket.
    const { data: photos } = await supabaseAdmin
      .from("intervention_photos")
      .select("storage_path")
      .eq("user_id", data.userId);
    const paths = (photos ?? [])
      .map((p) => p.storage_path)
      .filter((p): p is string => Boolean(p));
    if (paths.length) {
      await supabaseAdmin.storage.from("chantier-photos").remove(paths);
    }

    // 2. Delete all app data (admin-only DB function, runs as the calling admin).
    const { error: dataError } = await context.supabase.rpc("admin_delete_user", {
      p_user_id: data.userId,
    });
    if (dataError) throw dataError;

    // 3. Delete the auth account.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (authError) throw authError;

    return { success: true };
  });
