import { createServerFn } from "@tanstack/react-start";
import { PLANNING_MAX_BYTES as MAX_BYTES, validateClientId as validateId } from "./client-portal-validation";

export const createOrUpdateClient = createServerFn({ method: "POST" })
  .inputValidator((data: { mode: "create" | "update"; id?: string; userId?: string; payload: Record<string, unknown> }) => {
    if (data.mode === "update") validateId(data.id!);
    if (data.mode === "create" && !data.userId) throw new Error("Utilisateur invalide");
    if (!data.payload?.name || typeof data.payload.name !== "string") throw new Error("Le nom du client est requis");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin } = await import("./client-portal.server");
    const db = admin();
    const result = data.mode === "create"
      ? await db.from("clients").insert({ ...data.payload, id: data.id ?? crypto.randomUUID(), user_id: data.userId }).select().single()
      : await db.from("clients").update(data.payload).eq("id", data.id!).select().single();
    if (result.error) throw new Error(`Enregistrement client impossible : ${result.error.message}`);
    return result.data;
  });

export const createCeevPlanningUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string; filename: string; size: number }) => {
    validateId(data.clientId);
    if (!data.filename?.toLowerCase().endsWith(".pdf")) throw new Error("Le calendrier doit être un PDF");
    if (!Number.isFinite(data.size) || data.size <= 0 || data.size > MAX_BYTES) throw new Error("Le PDF ne doit pas dépasser 15 Mo");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, ensurePlanningBucket, BUCKET } = await import("./client-portal.server");
    const db = admin();
    const { data: client, error } = await db.from("clients").select("id").eq("id", data.clientId).single();
    if (error || !client) throw new Error("Client introuvable");
    await ensurePlanningBucket(db);
    const path = `${data.clientId}/planning-${Date.now()}.pdf`;
    const { data: signed, error: signedError } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
    if (signedError || !signed?.token) throw new Error(`Préparation de l'import impossible : ${signedError?.message ?? "URL signée indisponible"}`);
    return { path, token: signed.token };
  });

export const finalizeCeevPlanningUpload = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string; path: string; filename: string; size: number }) => {
    validateId(data.clientId);
    if (!data.filename?.toLowerCase().endsWith(".pdf")) throw new Error("Le calendrier doit être un PDF");
    if (!Number.isFinite(data.size) || data.size <= 0 || data.size > MAX_BYTES) throw new Error("PDF invalide ou supérieur à 15 Mo");
    if (!data.path.startsWith(`${data.clientId}/`)) throw new Error("Chemin de fichier invalide");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./client-portal.server");
    const db = admin();
    const { data: client, error } = await db.from("clients").select("id,ceev_planning_path").eq("id", data.clientId).single();
    if (error || !client) throw new Error("Client introuvable");
    const filename = data.path.split("/").pop()!;
    const { data: listed, error: listError } = await db.storage.from(BUCKET).list(data.clientId, { search: filename, limit: 1 });
    if (listError || !listed?.some((f) => f.name === filename)) throw new Error("Le fichier n'a pas été reçu par le stockage");
    const { error: saveError } = await db.from("clients").update({
      ceev_enabled: true,
      ceev_planning_path: data.path,
      ceev_planning_filename: data.filename,
      ceev_planning_updated_at: new Date().toISOString(),
    }).eq("id", data.clientId);
    if (saveError) {
      await db.storage.from(BUCKET).remove([data.path]);
      throw new Error(`PDF importé mais association impossible : ${saveError.message}`);
    }
    if (client.ceev_planning_path && client.ceev_planning_path !== data.path) await db.storage.from(BUCKET).remove([client.ceev_planning_path]);
    return { path: data.path, filename: data.filename };
  });

export const uploadCeevPlanning = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string; filename: string; contentBase64: string }) => {
    validateId(data.clientId);
    if (!data.filename?.toLowerCase().endsWith(".pdf")) throw new Error("Le calendrier doit être un PDF");
    if (!data.contentBase64) throw new Error("Fichier vide");
    return data;
  })
  .handler(async ({ data }) => {
    const { admin, ensurePlanningBucket, BUCKET } = await import("./client-portal.server");
    const bytes = Buffer.from(data.contentBase64, "base64");
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("PDF invalide ou supérieur à 15 Mo");
    const db = admin();
    const { data: client, error } = await db.from("clients").select("id,ceev_planning_path").eq("id", data.clientId).single();
    if (error || !client) throw new Error("Client introuvable");
    await ensurePlanningBucket(db);
    const path = `${data.clientId}/planning-${Date.now()}.pdf`;
    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw new Error(`Import PDF impossible : ${uploadError.message}`);
    const { error: saveError } = await db.from("clients").update({ ceev_enabled: true, ceev_planning_path: path, ceev_planning_filename: data.filename, ceev_planning_updated_at: new Date().toISOString() }).eq("id", data.clientId);
    if (saveError) { await db.storage.from(BUCKET).remove([path]); throw new Error(`PDF importé mais association impossible : ${saveError.message}`); }
    if (client.ceev_planning_path) await db.storage.from(BUCKET).remove([client.ceev_planning_path]);
    return { path, filename: data.filename };
  });

export const deleteCeevPlanning = createServerFn({ method: "POST" })
  .inputValidator((data: { clientId: string }) => { validateId(data.clientId); return data; })
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./client-portal.server");
    const db = admin();
    const { data: client, error } = await db.from("clients").select("ceev_planning_path").eq("id", data.clientId).single();
    if (error) throw error;
    if (client.ceev_planning_path) await db.storage.from(BUCKET).remove([client.ceev_planning_path]);
    const { error: updateError } = await db.from("clients").update({ ceev_planning_path: null, ceev_planning_filename: null, ceev_planning_updated_at: null }).eq("id", data.clientId);
    if (updateError) throw updateError;
    return { ok: true };
  });

export const getCeevPlanningUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => { if (!data?.token) throw new Error("Lien invalide"); return data; })
  .handler(async ({ data }) => {
    const { admin, BUCKET } = await import("./client-portal.server");
    const db = admin();
    const { data: client, error } = await db.from("clients").select("ceev_enabled,ceev_planning_path").eq("share_token", data.token).single();
    if (error || !client?.ceev_enabled || !client.ceev_planning_path) throw new Error("Aucun calendrier disponible");
    const { data: signed, error: signedError } = await db.storage.from(BUCKET).createSignedUrl(client.ceev_planning_path, 3600);
    if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Impossible d'ouvrir le calendrier");
    return { url: signed.signedUrl };
  });
