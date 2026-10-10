import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown }> }; userId: string };

async function assertAdmin(context: Ctx) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux administrateurs");
}

export const getCaBackupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listBackupFiles, newestBackupFiles } = await import("@/lib/pp-ca-backup.server");
    const { data: runs } = await supabaseAdmin
      .from("pp_backup_runs")
      .select("id, created_at, trigger, status, file_path, size_bytes, error_message")
      .order("created_at", { ascending: false })
      .limit(10);
    const files = newestBackupFiles(await listBackupFiles());
    return { runs: runs ?? [], files };
  });

export const runCaBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { runCaBackup } = await import("@/lib/pp-ca-backup.server");
    return runCaBackup("manual", context.userId);
  });

export const getCaBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().regex(/^Backup_CA_\d{4}-S\d{2}\.xlsx$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("pp-backups")
      .createSignedUrl(`ca/${data.name}`, 60, { download: data.name });
    if (error || !signed) throw new Error("Lien de téléchargement indisponible");
    return { url: signed.signedUrl };
  });
