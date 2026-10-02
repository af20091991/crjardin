import { describe, expect, test } from "bun:test";
import {
  describeChangeLine,
  unseenCountByDate,
  type SstCalendarChange,
} from "@/lib/sst-calendar-changes";

const change = (id: string, date: string | null): SstCalendarChange => ({
  id,
  created_at: "2026-10-02T10:00:00Z",
  actor_id: null,
  actor_label: "SST",
  entity: "availability",
  entity_id: null,
  action: "updated",
  calendar_date: date,
  summary: "x",
  details: [],
  acknowledged_at: null,
});

describe("modifications du calendrier SST", () => {
  test("compte les modifications non vues par jour", () => {
    const map = unseenCountByDate([
      change("1", "2026-10-12"),
      change("2", "2026-10-12"),
      change("3", "2026-10-13"),
      change("4", null),
    ]);
    expect(map.get("2026-10-12")).toBe(2);
    expect(map.get("2026-10-13")).toBe(1);
    expect(map.size).toBe(2);
  });

  test("décrit clairement avant → après", () => {
    expect(describeChangeLine({ label: "Heures estimées", from: "4", to: "6" })).toBe(
      "Heures estimées : 4 → 6",
    );
    expect(describeChangeLine({ label: "Commentaire", from: null, to: "Taille" })).toBe(
      "Commentaire : — → Taille",
    );
    expect(describeChangeLine({ label: "Tâches", from: null, to: null })).toBe("Tâches");
  });
});
