import { describe, expect, test } from "bun:test";
import { moveLine, totalHtAll, unaffected, type MovableLine } from "../predevis-moves";

const lines: MovableLine[] = [
  { id: "a", poste_id: "p1", ht: 100 },
  { id: "b", poste_id: "p1", ht: 50.5 },
  { id: "c", poste_id: "p2", ht: 20 },
  { id: "d", poste_id: null, ht: 10 },
];

describe("moveLine", () => {
  test("déplace une ligne vers un autre poste", () => {
    const next = moveLine(lines, "a", "p2");
    expect(next.find((l) => l.id === "a")?.poste_id).toBe("p2");
  });

  test("sort une ligne d'un poste (zone non affectée)", () => {
    const next = moveLine(lines, "b", null);
    expect(unaffected(next).map((l) => l.id)).toEqual(["b", "d"]);
  });

  test("invariant : le total HT de toutes les lignes ne change pas", () => {
    const before = totalHtAll(lines);
    expect(totalHtAll(moveLine(lines, "a", null))).toBe(before);
    expect(totalHtAll(moveLine(moveLine(lines, "d", "p1"), "c", null))).toBe(before);
  });

  test("ne touche que la ligne demandée", () => {
    const next = moveLine(lines, "c", "p1");
    expect(next.filter((l) => l.id !== "c")).toEqual(lines.filter((l) => l.id !== "c"));
  });
});
