// Exécution d'un backup PP CA (serveur uniquement, service_role).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { yearTotals, type CaEntry } from "@/lib/pilot-ca";
import { fetchAllCaRows } from "@/lib/pilot-ca-fetch";
import type { AsOfOptions } from "@/lib/pilot-realized";
import { backupFileName, filesToDelete, newestBackupFiles } from "@/lib/pp-ca-backup";
import { buildCaBackupWorkbook } from "@/lib/pp-ca-backup-excel.server";

export const BUCKET = "pp-backups";
export const FOLDER = "ca";
/** Première année de l'historique PP. */
const FIRST_YEAR = 2020;

// pp_backup_runs et notify_admins_backup_failure sont absents des types générés
// tant qu'ils ne sont pas régénérés : client volontairement non typé ici.
const db = supabaseAdmin as unknown as SupabaseClient;

export interface BackupRun {
  id: string;
  created_at: string;
  trigger: "auto" | "manual";
  status: "success" | "error";
  file_path: string | null;
  size_bytes: number | null;
  error_message: string | null;
}

const ORDER = [
  { column: "month", ascending: true },
  { column: "position", ascending: true },
  { column: "created_at", ascending: true },
];

/** Année et mois courants à Paris (le backup tourne le dimanche à 03h, heure de Paris). */
function parisYearMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") };
}

/** Compte admin propriétaire des lignes de CA (celui qui en détient le plus). */
export async function resolveDataOwner(): Promise<string> {
  const { data: admins, error } = await db.from("user_roles").select("user_id").eq("role", "admin");
  if (error) throw error;
  let best: { id: string; n: number } | null = null;
  for (const a of (admins ?? []) as { user_id: string }[]) {
    const { count } = await db
      .from("pilot_ca_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", a.user_id);
    if ((count ?? 0) > (best?.n ?? 0)) best = { id: a.user_id, n: count ?? 0 };
  }
  if (!best) throw new Error("Aucun compte administrateur ne détient de lignes de CA");
  return best.id;
}

export async function listBackupFiles() {
  const { data, error } = await db.storage.from(BUCKET).list(FOLDER, { limit: 100 });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => /^Backup_CA_\d{4}-S\d{2}\.xlsx$/.test(f.name))
    .map((f) => ({
      name: f.name,
      createdAt: f.updated_at ?? f.created_at ?? null,
      size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
    }));
}

export async function listBackupRuns(limit = 10): Promise<BackupRun[]> {
  const { data, error } = await db
    .from("pp_backup_runs")
    .select("id, created_at, trigger, status, file_path, size_bytes, error_message")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BackupRun[];
}

export async function runCaBackup(trigger: "auto" | "manual", triggeredBy: string | null) {
  const now = new Date();
  try {
    const { year, month } = parisYearMonth(now);
    const owner = await resolveDataOwner();
    const read = (y: number) =>
      fetchAllCaRows<CaEntry>("*", { year: y, userId: owner }, ORDER, db as never);
    // Même périmètre que la page /pilot/ca : « à date ».
    const options: AsOfOptions = { period: "a_date", now };
    const years: number[] = [];
    for (let y = FIRST_YEAR; y < year; y++) years.push(y);
    const [entries, ...past] = await Promise.all([read(year), ...years.map(read)]);
    const previousEntries = past[past.length - 1] ?? [];
    const history = years
      .map((y, i) => ({ y, rows: past[i] }))
      .filter((h) => h.rows.length > 0)
      .map((h) => {
        const t = yearTotals(h.rows, options);
        return { year: h.y, ventesHt: t.ventesHt, benefice: t.benefice };
      });

    const buffer = await buildCaBackupWorkbook({
      year,
      monthsElapsed: month,
      entries,
      previousEntries,
      history,
      options,
    });
    const name = backupFileName(now, year);
    const path = `${FOLDER}/${name}`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (upErr) throw upErr;

    // Rotation uniquement après un upload réussi : on garde les 2 plus récents.
    const files = await listBackupFiles();
    const stale = filesToDelete(files).map((f) => `${FOLDER}/${f.name}`);
    if (stale.length) {
      const { error: rmErr } = await db.storage.from(BUCKET).remove(stale);
      if (rmErr) throw rmErr;
    }

    const size = buffer.byteLength;
    const { error: logErr } = await db.from("pp_backup_runs").insert({
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
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String((e as { message: unknown }).message)
          : String(e);
    console.error("[pp-ca-backup]", message);
    await db.from("pp_backup_runs").insert({
      trigger,
      status: "error",
      error_message: message.slice(0, 1000),
      triggered_by: triggeredBy,
    });
    await db.rpc("notify_admins_backup_failure", { p_message: message });
    return { ok: false as const, error: message };
  }
}

export { newestBackupFiles };
