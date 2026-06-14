import { supabase } from "@/integrations/supabase/client";

const BUCKET = "chantier-photos";

export interface UploadedPhoto {
  path: string;
  url: string;
  name: string;
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  // URL signée longue durée (1 an) pour intégration dans l'email
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signErr) throw signErr;
  return { path, url: data.signedUrl, name: file.name };
}