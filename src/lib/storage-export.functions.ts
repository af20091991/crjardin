import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StorageExportFile {
  path: string;
  size: number;
  url: string;
}

/** Admin uniquement : liste des buckets du stockage. */
export const listStorageBuckets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({ name: b.name, public: b.public }));
  });

/** Admin uniquement : tous les fichiers d'un bucket avec un lien signé valable 2 h. */
export const listBucketFilesForExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bucket: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw roleError;
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: buckets, error: bErr } = await supabaseAdmin.storage.listBuckets();
    if (bErr) throw new Error(bErr.message);
    if (!(buckets ?? []).some((b) => b.name === data.bucket)) {
      throw new Response("Bucket inconnu", { status: 404 });
    }
    const store = supabaseAdmin.storage.from(data.bucket);
    const files: { path: string; size: number }[] = [];
    const queue: string[] = [""];
    while (queue.length) {
      const prefix = queue.shift()!;
      for (let offset = 0; ; offset += 1000) {
        const { data: items, error } = await store.list(prefix, {
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) throw new Error(error.message);
        for (const it of items ?? []) {
          const full = prefix ? `${prefix}/${it.name}` : it.name;
          if (it.id === null) queue.push(full);
          else {
            const meta = (it.metadata ?? {}) as { size?: number };
            files.push({ path: full, size: Number(meta.size ?? 0) });
          }
        }
        if (!items || items.length < 1000) break;
      }
    }
    const result: StorageExportFile[] = [];
    for (let i = 0; i < files.length; i += 500) {
      const chunk = files.slice(i, i + 500);
      const { data: signed, error } = await store.createSignedUrls(
        chunk.map((f) => f.path),
        7200,
      );
      if (error) throw new Error(error.message);
      chunk.forEach((f, j) => {
        const url = signed?.[j]?.signedUrl;
        if (url) result.push({ ...f, url });
      });
    }
    return result;
  });
