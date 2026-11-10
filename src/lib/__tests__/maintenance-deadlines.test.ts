import { describe, expect, test } from "bun:test";
import { mergeMaintenanceDeadlines } from "@/lib/maintenance-deadlines";

describe("maintenance deadlines", () => {
  const manual = {
    id: "legacy",
    equipment_id: "van",
    next_due_date: "2026-10-01",
    description: "Révision",
    equipment: { name: "Expert" },
  };
  test("historical manual maintenance deadlines remain visible without recurring rules", () => {
    expect(mergeMaintenanceDeadlines([], [manual])[0]?.next_due_date).toBe("2026-10-01");
  });
  test("a linked recurring schedule replaces its original deadline without duplicating it", () => {
    const schedule = {
      id: "schedule",
      equipment_id: "van",
      next_due_date: "2026-12-01",
      equipment_name: "Expert",
      maintenance_type_name: "Révision",
      last_maintenance_id: "legacy",
    };
    expect(mergeMaintenanceDeadlines([schedule], [manual]).map((row) => row.id)).toEqual([
      "schedule",
    ]);
  });
  test("missing deadlines are not invented", () => {
    expect(mergeMaintenanceDeadlines([], [{ ...manual, next_due_date: null }])).toEqual([]);
  });
});
