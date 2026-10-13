import { describe, expect, test } from "bun:test";
import {
  formatChange,
  parseTopPages,
  parseTotals,
  pickProperty,
  relativeChange,
  statisticsPeriods,
} from "../site-web-statistics";

describe("site-web-statistics", () => {
  test("parseTotals renvoie null sans ligne (pas de faux zéro)", () => {
    expect(parseTotals({ rows: [] })).toBeNull();
    expect(parseTotals(null)).toBeNull();
  });

  test("parseTotals conserve un vrai zéro", () => {
    const report = {
      rows: [{ metricValues: [{ value: "0" }, { value: "0" }, { value: "0" }, { value: "0" }] }],
    };
    expect(parseTotals(report)).toEqual({
      users: 0,
      pageViews: 0,
      engagedSessions: 0,
      engagementRate: 0,
    });
  });

  test("parseTopPages trie et limite", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      dimensionValues: [{ value: `/p${i}` }],
      metricValues: [{ value: String(i) }, { value: "1" }],
    }));
    const pages = parseTopPages({ rows }, 3);
    expect(pages.map((p) => p.path)).toEqual(["/p9", "/p8", "/p7"]);
  });

  test("relativeChange est null si la période précédente est vide", () => {
    expect(relativeChange(10, 0)).toBeNull();
    expect(relativeChange(null, 5)).toBeNull();
    expect(relativeChange(15, 10)).toBeCloseTo(0.5);
    expect(formatChange(null)).toBeNull();
  });

  test("statisticsPeriods : deux fenêtres de 30 jours contiguës", () => {
    const { current, previous } = statisticsPeriods(new Date("2026-10-13T10:00:00"));
    expect(current).toEqual({ startDate: "2026-09-13", endDate: "2026-10-12" });
    expect(previous).toEqual({ startDate: "2026-08-14", endDate: "2026-09-12" });
  });

  test("pickProperty ne devine pas entre plusieurs propriétés", () => {
    const props = [{ name: "properties/1" }, { name: "properties/2" }];
    expect(pickProperty(props, null)).toBeNull();
    expect(pickProperty(props, "2")?.name).toBe("properties/2");
    expect(pickProperty([props[0]], null)?.name).toBe("properties/1");
    expect(pickProperty([], null)).toBeNull();
  });
});
