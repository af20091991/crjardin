import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function validateId(id: string) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Client invalide");
}

export const uploadCeevPlanning = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string; filename: string; contentBase64: string }) => {
    validateId(data.clientId);
    if (!data.filename?.toLowerCase().endsWith(".pdf")) throw new Error("Le calendrier doit être un PDF");
    if (!data.contentBase64) throw new Error("Fichier vide");
    return data;
  })
  .handler(async ({ data }) => {
    const db = admin();
    const { data: client, error: clientError } = await db.from("clients").select("id,ceev_enabled,ceev_planning_path").eq("id", data.clientId).single();
    if (clientError) throw clientError;
    if (!client.ceev_enabled) throw new Error("Le client doit être marqué CEEV");

    const bytes = Buffer.from(data.contentBase64, "base64");
    if (bytes.length > 15 * 1024 * 1024) throw new Error("Le PDF ne doit pas dépasser 15 Mo");
    const path = `${data.clientId}/planning-${Date.now()}.pdf`;
    const { error: uploadError } = await db.storage.from("client-plannings").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;

    if (client.ceev_planning_path) await db.storage.from("client-plannings").remove([client.ceev_planning_path]);
    const { error: updateError } = await db.from("clients").update({ ceev_planning_path: path, ceev_planning_filename: data.filename, ceev_planning_updated_at: new Date().toISOString() }).eq("id", data.clientId);
    if (updateError) throw updateError;
    return { path, filename: data.filename };
  });

export const deleteCeevPlanning = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string }) => { validateId(data.clientId); return data; })
  .handler(async ({ data }) => {
    const db = admin();
    const { data: client, error } = await db.from("clients").select("ceev_planning_path").eq("id", data.clientId).single();
    if (error) throw error;
    if (client.ceev_planning_path) await db.storage.from("client-plannings").remove([client.ceev_planning_path]);
    const { error: updateError } = await db.from("clients").update({ ceev_planning_path: null, ceev_planning_filename: null, ceev_planning_updated_at: null }).eq("id", data.clientId);
    if (updateError) throw updateError;
    return { ok: true };
  });

export const getCeevPlanningUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => { if (!data?.token) throw new Error("Lien invalide"); return data; })
  .handler(async ({ data }) => {
    const db = admin();
    const { data: client, error } = await db.from("clients").select("ceev_enabled,ceev_planning_path").eq("share_token", data.token).single();
    if (error || !client?.ceev_enabled || !client.ceev_planning_path) throw new Error("Aucun calendrier disponible");
    const { data: signed, error: signError } = await db.storage.from("client-plannings").createSignedUrl(client.ceev_planning_path, 60 * 60);
    if (signError || !signed?.signedUrl) throw signError ?? new Error("Impossible d'ouvrir le calendrier");
    return { url: signed.signedUrl };
  });
