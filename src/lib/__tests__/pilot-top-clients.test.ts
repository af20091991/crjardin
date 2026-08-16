// TOP clients : pondérations 50 / 30 / 20 et refus d'inventer un taux horaire.
import { describe, expect, test } from "bun:test";
import { TOP_CLIENT_WEIGHTS, topClients, type TopClientInput } from "@/lib/pilot-top-clients";

function input(over: Partial<TopClientInput> & { key: string }): TopClientInput {
  return {
    clientId: over.key,
    name: over.key,
    ca: 0,
    share: 0,
    hourlyRate: null,
    ...over,
  };
}

describe("topClients", () => {
  test("pondérations sanctuarisées", () => {
    expect(TOP_CLIENT_WEIGHTS).toEqual({ ca: 0.5, share: 0.3, rate: 0.2 });
  });

  test("aucune donnée : aucun classement", () => {
    expect(topClients([])).toEqual([]);
  });

  test("retourne un TOP 5 et pas un TOP 3", () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      input({ key: `c${i}`, ca: 1000 * (8 - i), share: 10, hourlyRate: 50 }),
    );
    const top = topClients(rows);
    expect(top).toHaveLength(5);
    expect(top.map((r) => r.key)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
    expect(top[0].rank).toBe(1);
  });

  test("client leader sur les 3 composantes : score 100", () => {
    const top = topClients([
      input({ key: "a", ca: 10_000, share: 60, hourlyRate: 80 }),
      input({ key: "b", ca: 5_000, share: 30, hourlyRate: 40 }),
    ]);
    expect(top[0].key).toBe("a");
    expect(top[0].score).toBeCloseTo(100, 6);
    expect(top[0].caPoints).toBeCloseTo(50, 6);
    expect(top[0].sharePoints).toBeCloseTo(30, 6);
    expect(top[0].ratePoints).toBeCloseTo(20, 6);
    expect(top[1].score).toBeCloseTo(50, 6);
  });

  test("taux horaire inconnu : aucune invention, 0 point sur cette composante", () => {
    const top = topClients([input({ key: "a", ca: 10_000, share: 100, hourlyRate: null })]);
    expect(top[0].ratePoints).toBe(0);
    expect(top[0].score).toBeCloseTo(80, 6);
  });

  test("clients sans CA positif exclus", () => {
    const top = topClients([
      input({ key: "a", ca: 0, share: 0, hourlyRate: 90 }),
      input({ key: "b", ca: -500, share: 0 }),
      input({ key: "c", ca: 100, share: 100 }),
    ]);
    expect(top.map((r) => r.key)).toEqual(["c"]);
  });

  test("à score égal, le CA le plus élevé passe devant", () => {
    const top = topClients([
      input({ key: "petit", ca: 1_000, share: 50, hourlyRate: 50 }),
      input({ key: "gros", ca: 1_000, share: 50, hourlyRate: 50 }),
    ]);
    expect(top[0].score).toBeCloseTo(top[1].score, 6);
    expect(top).toHaveLength(2);
  });
});