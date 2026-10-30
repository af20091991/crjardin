import { describe, expect, it } from "bun:test";
import { upcomingWorks, workTasks, workYears, type WorkItem } from "@/lib/upcoming-works";

const item = (id: string, year: number | null, month: number | null, seq = 1): WorkItem => ({
  id,
  period_label: "",
  year,
  month,
  sequence: seq,
  title: "Entretien",
  details: "Taille · Tonte",
});

describe("upcoming-works", () => {
  const now = new Date(2026, 9, 30); // octobre 2026
  const items = [
    item("a", 2026, 3),
    item("b", 2026, 10),
    item("c", 2027, 2, 2),
    item("d", 2027, 2, 1),
    item("e", 2026, 12),
    item("f", null, null),
  ];
  it("garde le mois en cours et les suivants, triés", () => {
    expect(upcomingWorks(items, now).map((i) => i.id)).toEqual(["b", "e", "d", "c", "f"]);
  });
  it("liste les années", () => {
    expect(workYears(upcomingWorks(items, now), now)).toEqual([2026, 2027]);
  });
  it("découpe les tâches", () => {
    expect(workTasks(items[0])).toEqual(["Taille", "Tonte"]);
    expect(workTasks({ details: null })).toEqual([]);
  });
});
