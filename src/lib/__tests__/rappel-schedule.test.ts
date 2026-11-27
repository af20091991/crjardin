import { describe, expect, it } from "vitest";
import { dueReminders } from "@/lib/rappel-schedule";

const item = {
  id: "a",
  scheduled_at: "2026-12-03T06:30:00.000Z", // 03/12/2026 07h30 heure de Paris
  reminder_hours: [48],
};

describe("dueReminders", () => {
  it("rappel 48 h dû à partir de J-2 à 07h30", () => {
    expect(dueReminders([item], new Set(), new Date("2026-12-01T06:29:00Z"))).toEqual([]);
    expect(dueReminders([item], new Set(), new Date("2026-12-01T06:30:00Z"))).toHaveLength(1);
  });

  it("ignore un rappel déjà notifié", () => {
    const due = dueReminders([item], new Set(["a:48"]), new Date("2026-12-02T00:00:00Z"));
    expect(due).toEqual([]);
  });

  it("ne notifie pas une intervention passée", () => {
    expect(dueReminders([item], new Set(), new Date("2026-12-04T00:00:00Z"))).toEqual([]);
  });

  it("gère les rappels 24 h puis 12 h (Chauveau)", () => {
    const chauveau = { ...item, reminder_hours: [24, 12] };
    const at24 = dueReminders([chauveau], new Set(), new Date("2026-12-02T06:30:00Z"));
    expect(at24.map((d) => d.hours)).toEqual([24]);
    const at12 = dueReminders([chauveau], new Set(["a:24"]), new Date("2026-12-02T18:30:00Z"));
    expect(at12.map((d) => d.hours)).toEqual([12]);
  });

  it("ignore les interventions sans date", () => {
    expect(dueReminders([{ ...item, scheduled_at: null }], new Set(), new Date())).toEqual([]);
  });
});
