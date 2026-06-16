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
// Compresse une image côté client (max 1600px, JPEG qualité 0.8)
export async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", quality);
  });
}

// Upload une photo compressée, renvoie le chemin de stockage
export async function uploadInterventionPhoto(file: File): Promise<string> {
  const blob = await compressImage(file);
  const path = `interventions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error) throw error;
  return path;
}
