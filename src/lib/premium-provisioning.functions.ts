import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL_LABEL = "Addala";

// prettier-ignore
export const provisionPremiumAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { clientId: string }) => {
    if (!data?.clientId || typeof data.clientId !== "string") {
      throw new Error("Client Premium invalide");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: isEditor, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isEditor) {
      const { data: editor, error: editorError } = await context.supabase.rpc("is_editor", {
        _user_id: context.userId,
      });
      if (editorError) throw editorError;
      if (!editor) throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { importPremiumPlanning } = await import("@/lib/premium-planning-import.server");

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, contract_type, ceev_planning_path, ceev_planning_filename")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) throw new Error("Client introuvable");
    if (client.contract_type !== "Entretien annuel") {
      throw new Error("Le Compte Premium est réservé aux clients en entretien annuel.");
    }

    const result = await importPremiumPlanning(supabaseAdmin, client);
    return {
      ok: true,
      model: MODEL_LABEL,
      status: result.status,
      calendarImported: result.status === "imported",
      alreadyProvisioned: result.status === "already_imported",
      importedItems: result.importedItems ?? 0,
    };
  });
