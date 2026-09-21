import { describe, expect, it } from "bun:test";
import {
  groupByDate,
  isoDate,
  monthGridDates,
  monthWindow,
  type SstAvailabilityWithUser,
} from "@/lib/calendrier-sst";

describe("calendrier SST — disponibilités partagées", () => {
  it("calcule la fenêtre du mois", () => {
    expect(monthWindow(2026, 8)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("construit une grille de 42 jours commençant un lundi", () => {
    const grid = monthGridDates(2026, 8);
    expect(grid).toHaveLength(42);
    const first = grid.at(0);
    expect(first?.getDay()).toBe(1);
    expect(first ? isoDate(first) : null).toBe("2026-08-31");
  });

  it("regroupe les disponibilités par date et trie par nom", () => {
    const entries = [
      {
        id: "1",
        user_id: "u1",
        date: "2026-09-02",
        comment: null,
        created_at: "",
        updated_at: "",
        userLabel: "Zoé",
      },
      {
        id: "2",
        user_id: "u2",
        date: "2026-09-02",
        comment: "Matin",
        created_at: "",
        updated_at: "",
        userLabel: "Alex",
      },
      {
        id: "3",
        user_id: "u1",
        date: "2026-09-03",
        comment: null,
        created_at: "",
        updated_at: "",
        userLabel: "Zoé",
      },
    ] satisfies SstAvailabilityWithUser[];
    const grouped = groupByDate(entries);
    expect(grouped.get("2026-09-02")?.map((e) => e.userLabel)).toEqual(["Alex", "Zoé"]);
    expect(grouped.get("2026-09-03")).toHaveLength(1);
  });
});
