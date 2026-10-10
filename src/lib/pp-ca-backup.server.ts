// Exécution d'un backup PP CA (serveur uniquement, service_role).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { yearTotals, type CaEntry } from "@/lib/pilot-ca";
import { fetchAllCaRows } from "@/lib/pilot-ca-fetch";
import type { AsOfOptions } from "@/lib/pilot-realized";
import { backupFileName, filesToDelete, newestBackupFiles } from "@/lib/pp-ca-backup";
import { buildCaBackupWorkbook } from "@/lib/pp-ca-backup-excel.server";

export const BUCKET = "pp-backups";
export const FOLDER = "ca";

const ORDER = [
  { column: "month", ascending: true },
  { column: "position", ascending: true },
  { column: "created_at", ascending: true },
];

/** Compte admin propriétaire des lignes de CA (celui qui en détient le plus). */
export async function resolveDataOwner(): Promise<string> {
  const { data: admins, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) throw error;
  let best: { id: string; n: number } | null = null;
  for (const a of admins ?? []) {
    const { count } = await supabaseAdmin
      .from("pilot_ca_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", a.user_id);
    if ((count ?? 0) > (best?.n ?? 0)) best = { id: a.user_id, n: count ?? 0 };
  }
  if (!best) throw new Error("Aucun compte administrateur ne détient de lignes de CA");
  return best.id;
}

export async function listBackupFiles() {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(FOLDER, { limit: 100 });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.name.endsWith(".xlsx"))
    .map((f) => ({
      name: f.name,
      createdAt: f.updated_at ?? f.created_at ?? null,
      size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
    }));
}

export async function runCaBackup(trigger: "auto" | "manual", triggeredBy: string | null) {
  const now = new Date();
  const year = now.getUTCFullYear();
  try {
    const owner = await resolveDataOwner();
    const read = (y: number) =>
      fetchAllCaRows<CaEntry>("*", { year: y, userId: owner }, ORDER, supabaseAdmin);
    const options: AsOfOptions = { period: "a_date", now };
    const [entries, previousEntries] = await Promise.all([read(year), read(year - 1)]);
    const history: { year: number; benefice: number }[] = [];
    for (let y = year - 6; y < year; y++) {
      const rows = y === year - 1 ? previousEntries : await read(y);
      if (rows.length) history.push({ year: y, benefice: yearTotals(rows, options).benefice });
    }
    const buffer = await buildCaBackupWorkbook({ year, entries, previousEntries, history, options });
    const name = backupFileName(now, year);
    const path = `${FOLDER}/${name}`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (upErr) throw upErr;

    // Rotation seulement après upload réussi.
    const files = await listBackupFiles();
    const stale = filesToDelete(files).map((f) => `${FOLDER}/${f.name}`);
    if (stale.length) await supabaseAdmin.storage.from(BUCKET).remove(stale);

    const size = buffer.byteLength;
    const { error: logErr } = await supabaseAdmin.from("pp_backup_runs").insert({
      trigger,
      status: "success",
      file_path: path,
      size_bytes: size,
      triggered_by: triggeredBy,
    });
    if (logErr) throw logErr;
    return { ok: true as const, path, size };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
    console.error("[pp-ca-backup]", message);
    await supabaseAdmin.from("pp_backup_runs").insert({
      trigger,
      status: "error",
      error_message: message.slice(0, 1000),
      triggered_by: triggeredBy,
    });
    await supabaseAdmin.rpc("notify_admins_backup_failure", { p_message: message });
    return { ok: false as const, error: message };
  }
}

export { newestBackupFiles };
