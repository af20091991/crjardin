import { describe, expect, test } from "bun:test";
import {
  measureEffect,
  newStrongOpportunities,
  previousMonth,
  type Snapshot,
  type SnapshotOpportunity,
} from "@/lib/visibilite-locale-follow";

const opp = (over: Partial<SnapshotOpportunity> = {}): SnapshotOpportunity => ({
  key: "AP|Jacou",
  prestation: "AP",
  commune: "Jacou",
  score: 50,
  impressions: 100,
  clicks: 5,
  position: 12,
  ...over,
});
const snap = (taken_on: string, o: SnapshotOpportunity): Snapshot => ({
  taken_on,
  opportunities: [o],
});

describe("suivi du radar", () => {
  test("alerte seulement sur score fort et jamais signalé", () => {
    const list = [opp({ score: 75 }), opp({ key: "b", score: 40 }), opp({ key: "c", score: 90 })];
    expect(newStrongOpportunities(list, new Set(["c"])).map((o) => o.key)).toEqual(["AP|Jacou"]);
  });

  test("mesure en attente puis disponible après 28 jours", () => {
    const snaps = [snap("2026-10-20", opp())];
    const waiting = measureEffect(snaps, "AP|Jacou", "2026-10-24T10:00:00Z");
    expect(waiting.status).toBe("attente");
    expect(waiting.availableOn).toBe("2026-11-21");
    const done = measureEffect(
      [...snaps, snap("2026-11-22", opp({ clicks: 12, impressions: 300, position: 8.5 }))],
      "AP|Jacou",
      "2026-10-24T10:00:00Z",
    );
    expect(done.status).toBe("mesure");
    expect(done.deltaClicks).toBe(7);
    expect(done.deltaImpressions).toBe(200);
    expect(done.deltaPosition).toBe(-3.5);
  });

  test("mois précédent", () => {
    expect(previousMonth("2026-11-02")).toBe("2026-10");
    expect(previousMonth("2027-01-05")).toBe("2026-12");
  });
});
