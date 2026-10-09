import { describe, expect, test } from "bun:test";
import { backupFileName, filesToDelete, isoWeek, newestBackupFiles } from "@/lib/pp-ca-backup";

describe("rotation des backups PP CA", () => {
  test("utilise l'année et la semaine ISO", () => {
    expect(isoWeek(new Date("2027-01-01T12:00:00Z"))).toEqual({ year: 2026, week: 53 });
    expect(backupFileName(new Date("2026-10-08T12:00:00Z"), 2026)).toBe(
      "Backup_CA_2026-S41.xlsx",
    );
  });

  test("conserve les deux copies les plus récentes", () => {
    const files = [
      { name: "Backup_CA_2026-S39.xlsx", createdAt: "2026-09-27T01:00:00Z" },
      { name: "Backup_CA_2026-S41.xlsx", createdAt: "2026-10-11T01:00:00Z" },
      { name: "Backup_CA_2026-S40.xlsx", createdAt: "2026-10-04T01:00:00Z" },
    ];
    expect(newestBackupFiles(files).map((file) => file.name)).toEqual([
      "Backup_CA_2026-S41.xlsx",
      "Backup_CA_2026-S40.xlsx",
    ]);
    expect(filesToDelete(files).map((file) => file.name)).toEqual(["Backup_CA_2026-S39.xlsx"]);
  });

  test("une relance dans la même semaine remplace la copie précédente", () => {
    const files = [
      { name: "Backup_CA_2026-S41.xlsx", createdAt: "2026-10-08T01:00:00Z" },
      { name: "Backup_CA_2026-S41.xlsx", createdAt: "2026-10-09T01:00:00Z" },
      { name: "Backup_CA_2026-S40.xlsx", createdAt: "2026-10-04T01:00:00Z" },
    ];
    expect(newestBackupFiles(files).map((file) => file.name)).toEqual([
      "Backup_CA_2026-S41.xlsx",
      "Backup_CA_2026-S40.xlsx",
    ]);
  });
});