import { describe, expect, test } from "bun:test";
import { detectSstCalendarConflicts, type SstAvailability, type SstInterventionAssignment } from "@/lib/calendrier-sst";
import type { SubcontractorMission } from "@/lib/subcontractors";

const baseAssignment: SstInterventionAssignment = {
  id: "assignment-1",
  intervention_id: "intervention-1",
  mission_id: null,
  subcontractor_id: "sst-1",
  required_people: 1,
  starts_at: "2026-09-21T08:00:00.000Z",
  ends_at: "2026-09-21T12:00:00.000Z",
  status: "confirmed",
  planning_comment: null,
  response_comment: null,
  proposed_at: null,
  responded_at: null,
  created_by: "user-1",
  created_at: "2026-09-20T08:00:00.000Z",
  updated_at: "2026-09-20T08:00:00.000Z",
};

const baseAvailability: SstAvailability = {
  id: "availability-1",
  subcontractor_id: "sst-1",
  availability_date: "2026-09-21",
  start_time: null,
  end_time: null,
  status: "unavailable",
  comment: null,
  created_by: "user-1",
  created_at: "2026-09-20T08:00:00.000Z",
  updated_at: "2026-09-20T08:00:00.000Z",
};

const baseMission: SubcontractorMission = {
  id: "mission-1",
  user_id: "user-1",
  subcontractor_id: "sst-1",
  client_id: null,
  worksite_sheet_id: null,
  intervention_id: null,
  service_id: null,
  mission_date: "2026-09-21",
  service_requested: "Taille",
  objective: null,
  context_notes: null,
  instructions: null,
  status: "done",
  report_notes: null,
  anomalies: null,
  recommendations: null,
  hours_spent: null,
  internal_rating: null,
  agreed_price: null,
  invoiced_amount: null,
  client_price: null,
  archived_at: null,
  payment_method: null,
  category: null,
  prestation: null,
  invoice_ref: null,
  hours_saved: null,
  autonomy: null,
  parallel_worksite: null,
  import_source: null,
  created_at: "2026-09-20T08:00:00.000Z",
  updated_at: "2026-09-20T08:00:00.000Z",
};

describe("detectSstCalendarConflicts", () => {
  test("signale une affectation sur une journée indisponible", () => {
    const conflicts = detectSstCalendarConflicts({
      assignments: [baseAssignment],
      availabilities: [baseAvailability],
      missions: [],
    });

    expect(conflicts.some((conflict) => conflict.type === "unavailable")).toBe(true);
  });

  test("signale deux affectations qui se chevauchent pour le même SST", () => {
    const conflicts = detectSstCalendarConflicts({
      assignments: [
        baseAssignment,
        {
          ...baseAssignment,
          id: "assignment-2",
          starts_at: "2026-09-21T11:00:00.000Z",
          ends_at: "2026-09-21T15:00:00.000Z",
        },
      ],
      availabilities: [],
      missions: [],
    });

    expect(conflicts.some((conflict) => conflict.type === "overlap")).toBe(true);
  });

  test("signale une mission terminée sans compte-rendu", () => {
    const conflicts = detectSstCalendarConflicts({
      assignments: [],
      availabilities: [],
      missions: [baseMission],
    });

    expect(conflicts.some((conflict) => conflict.type === "missing_report")).toBe(true);
  });
});
