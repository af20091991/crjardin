import { createClient } from "@supabase/supabase-js";

export const BUCKET = "client-plannings";
export const MAX_BYTES = 15 * 1024 * 1024;

export function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function ensurePlanningBucket(db: ReturnType<typeof admin>) {
  const { data: buckets, error } = await db.storage.listBuckets();
  if (error) throw new Error(`Stockage calendrier inaccessible : ${error.message}`);
  if (buckets?.some((b) => b.id === BUCKET)) return;
  const { error: createError } = await db.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_BYTES}`,
    allowedMimeTypes: ["application/pdf"],
  });
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    throw new Error(`Création du stockage calendrier impossible : ${createError.message}`);
  }
}
