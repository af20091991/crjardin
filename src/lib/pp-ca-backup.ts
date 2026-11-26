export interface BackupFile {
  name: string;
  createdAt?: string | null;
}

export function isoWeek(date: Date): { year: number; week: number } {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const year = utc.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 1));
  return { year, week: Math.ceil(((utc.getTime() - first.getTime()) / 86_400_000 + 1) / 7) };
}

export function backupFileName(date: Date, exerciseYear = date.getUTCFullYear()): string {
  const { week } = isoWeek(date);
  return `Backup_CA_${exerciseYear}-S${String(week).padStart(2, "0")}.xlsx`;
}

export function newestBackupFiles<T extends BackupFile>(files: T[], keep = 2): T[] {
  return [...files]
    .sort((a, b) => {
      const byDate = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      return byDate || b.name.localeCompare(a.name);
    })
    .filter(
      (file, index, all) => all.findIndex((candidate) => candidate.name === file.name) === index,
    )
    .slice(0, keep);
}

export function filesToDelete<T extends BackupFile>(files: T[], keep = 2): T[] {
  const retained = new Set(newestBackupFiles(files, keep).map((file) => file.name));
  return files.filter((file) => !retained.has(file.name));
}

export function nextParisSundayAtThree(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const localDate = new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00Z`);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const days = (7 - weekday) % 7 || 7;
  localDate.setUTCDate(localDate.getUTCDate() + days);
  const targetDate = localDate.toISOString().slice(0, 10);
  for (let hour = 0; hour < 6; hour += 1) {
    const candidate = new Date(`${targetDate}T${String(hour).padStart(2, "0")}:00:00Z`);
    const parisHour = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(candidate);
    if (parisHour === "03") return candidate;
  }
  throw new Error("Impossible de calculer la prochaine exécution");
}
