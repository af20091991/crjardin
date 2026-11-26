import { describe, expect, test } from "bun:test";
import { clusterPixelPoints, initials } from "../mapping-markers";

describe("repères du module Mapping", () => {
  test("regroupe les points proches et isole les autres", () => {
    const clusters = clusterPixelPoints([
      { id: "a", x: 10, y: 10 },
      { id: "b", x: 20, y: 15 },
      { id: "c", x: 400, y: 300 },
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((c) => c.ids.length === 2)?.ids.sort()).toEqual(["a", "b"]);
    expect(clusters.find((c) => c.ids.length === 1)?.ids).toEqual(["c"]);
  });

  test("deux clients à la même adresse restent regroupés", () => {
    const clusters = clusterPixelPoints([
      { id: "a", x: 123.4, y: 55.5 },
      { id: "b", x: 123.4, y: 55.5 },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.ids).toHaveLength(2);
  });

  test("initiales lisibles", () => {
    expect(initials("M. Jean Dupont")).toBe("JD");
    expect(initials("SCI Les Oliviers")).toBe("LO");
    expect(initials("Martin")).toBe("M");
  });
});
