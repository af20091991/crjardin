import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminCtx = {
  supabase: {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: unknown }>;
  };
  userId: string;
};

async function assertAdmin(context: unknown) {
  const ctx = context as AdminCtx;
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux administrateurs");
}

export const getCaBackupStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listBackupFiles, listBackupRuns, newestBackupFiles } =
      await import("@/lib/pp-ca-backup.server");
    const [runs, files] = await Promise.all([listBackupRuns(10), listBackupFiles()]);
    return { runs, files: newestBackupFiles(files) };
  });

export const runCaBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runCaBackup } = await import("@/lib/pp-ca-backup.server");
    return runCaBackup("manual", (context as unknown as AdminCtx).userId);
  });

export const getCaBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().regex(/^Backup_CA_\d{4}-S\d{2}\.xlsx$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("pp-backups")
      .createSignedUrl(`ca/${data.name}`, 60, { download: data.name });
    if (error || !signed) throw new Error("Lien de téléchargement indisponible");
    return { url: signed.signedUrl };
  });
