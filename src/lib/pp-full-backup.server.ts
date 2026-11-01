// Sauvegarde complète quotidienne (serveur uniquement, service_role).
// Une copie JSON de chaque table publique + index du stockage, dans pp-backups/full/AAAA-MM-JJ/.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "pp-backups";
const ROOT = "full";
const RETENTION_DAYS = 60;

// Les fonctions pp_backup_* et pp_full_backup_runs ne sont pas dans les types générés.
const db = supabaseAdmin as unknown as SupabaseClient;

function parisDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

async function upload(path: string, data: unknown): Promise<number> {
  const body = new TextEncoder().encode(JSON.stringify(data));
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, body, { upsert: true, contentType: "application/json" });
  if (error) throw error;
  return body.byteLength;
}

async function purgeOld(now: Date) {
  const { data, error } = await db.storage.from(BUCKET).list(ROOT, { limit: 1000 });
  if (error) throw error;
  const limit = parisDate(new Date(now.getTime() - RETENTION_DAYS * 86_400_000));
  for (const f of data ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.name) || f.name >= limit) continue;
    const { data: files } = await db.storage
      .from(BUCKET)
      .list(`${ROOT}/${f.name}`, { limit: 1000 });
    const paths = (files ?? []).map((x) => `${ROOT}/${f.name}/${x.name}`);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
  }
}

export async function runFullBackup() {
  const now = new Date();
  const folder = `${ROOT}/${parisDate(now)}`;
  try {
    const { data: tables, error: tErr } = await db.rpc("pp_backup_table_names");
    if (tErr) throw tErr;
    let size = 0;
    let rows = 0;
    const manifest: { table: string; rows: number }[] = [];
    for (const t of tables as string[]) {
      const { data, error } = await db.rpc("pp_backup_table_json", { p_table: t });
      if (error) throw new Error(`${t} : ${error.message}`);
      const arr = (data ?? []) as unknown[];
      size += await upload(`${folder}/${t}.json`, arr);
      rows += arr.length;
      manifest.push({ table: t, rows: arr.length });
    }
    const { data: idx, error: iErr } = await db.rpc("pp_backup_storage_index");
    if (iErr) throw iErr;
    size += await upload(`${folder}/_storage_index.json`, idx);
    // Le manifeste est écrit en dernier : sa présence prouve que la sauvegarde est complète.
    size += await upload(`${folder}/_manifest.json`, {
      created_at: now.toISOString(),
      tables: manifest,
      rows,
    });
    await purgeOld(now);
    const { error: logErr } = await db.from("pp_full_backup_runs").insert({
      status: "success",
      folder,
      tables_count: manifest.length,
      rows_count: rows,
      size_bytes: size,
    });
    if (logErr) throw logErr;
    return { ok: true as const, folder, tables: manifest.length, rows, size };
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
    console.error("[pp-full-backup]", message);
    await db.from("pp_full_backup_runs").insert({
      status: "error",
      folder,
      error_message: message.slice(0, 1000),
    });
    await db.rpc("notify_admins_backup_failure", { p_message: `Sauvegarde complète : ${message}` });
    return { ok: false as const, error: message };
  }
}
