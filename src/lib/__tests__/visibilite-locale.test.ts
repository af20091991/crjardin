import { describe, expect, test } from "bun:test";
import {
  CAPACITY_FACTOR,
  WEIGHTS,
  computeCapacity,
  monthlyHours,
  detectCommune,
  detectPrestation,
  groupQueries,
  monthlyCaByPrestation,
  monthsAhead,
  potentialExtraClicks,
  progressionScore,
  proximityScore,
  scoreOpportunities,
  seasonalityScore,
  visibilityGaps,
} from "../visibilite-locale";

describe("Radar Visibilité locale", () => {
  test("reconnaît les communes ciblées et ignore les communes exclues", () => {
    expect(detectCommune("Paysagiste Castelnau-le-Lez")?.name).toBe("Castelnau-le-Lez");
    expect(detectCommune("jardinier castelnau")?.name).toBe("Castelnau-le-Lez");
    expect(detectCommune("création jardin le crès")?.name).toBe("Le Crès");
    expect(detectCommune("saint aunès paysagiste")?.name).toBe("Saint-Aunès");
    expect(detectCommune("paysagiste saint-jean-de-védas")).toBeNull();
    expect(detectCommune("paysagiste juvignac castries")).toBeNull();
    expect(detectCommune("paysagiste nantes")).toBeNull();
  });

  test("rattache les requêtes à une prestation", () => {
    expect(detectPrestation("visite conseil jardin castries")).toBe("Conseil");
    expect(detectPrestation("création jardin méditerranéen jacou")).toBe("AP");
    expect(detectPrestation("taille de haie baillargues")).toBe("SAP");
    expect(detectPrestation("remise en état jardin vendargues")).toBe("Remise en état");
    expect(detectPrestation("castries mairie")).toBeNull();
  });

  test("regroupe par prestation × commune avec position pondérée", () => {
    const { opportunities, unattached } = groupQueries([
      { query: "paysagiste castries", clicks: 2, impressions: 100, position: 8 },
      { query: "création jardin castries", clicks: 1, impressions: 300, position: 12 },
      { query: "castries mairie", clicks: 0, impressions: 50, position: 3 },
      { query: "paysagiste nantes", clicks: 0, impressions: 500, position: 4 },
    ]);
    expect(unattached).toBe(1);
    expect(opportunities).toHaveLength(1);
    const o = opportunities[0]!;
    expect(o.impressions).toBe(400);
    expect(o.position).toBeCloseTo((8 * 100 + 12 * 300) / 400, 5);
    expect(o.topQueries[0]!.query).toBe("création jardin castries");
  });

  test("clics potentiels : 0 si déjà dans le top 3", () => {
    expect(potentialExtraClicks(1000, 10, 2)).toBe(0);
    expect(potentialExtraClicks(1000, 10, 9)).toBe(100);
  });

  test("scores de progression et de proximité", () => {
    expect(progressionScore(2)).toBeLessThan(progressionScore(9));
    expect(progressionScore(9)).toBeGreaterThan(progressionScore(35));
    expect(progressionScore(null)).toBe(40);
    expect(proximityScore(0)).toBe(100);
    expect(proximityScore(15)).toBe(10);
    expect(proximityScore(null)).toBe(60);
  });

  test("saisonnalité : mois fort > 50, historique court = null", () => {
    const monthly = monthlyCaByPrestation([
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => ({
        date: `2025-${String(m).padStart(2, "0")}-10`,
        amount: m === 11 ? 3000 : 1000,
        prestation: "AP",
      })),
      { date: "2026-01-05", amount: 500, prestation: "Conseil" },
    ]);
    expect(seasonalityScore(monthly["AP"], [11])).toBeGreaterThan(50);
    expect(seasonalityScore(monthly["AP"], [3])).toBeLessThan(50);
    expect(seasonalityScore(monthly["Conseil"], [11])).toBeNull();
    expect(monthsAhead(new Date(2026, 9, 23))).toEqual([10, 11, 12]);
  });

  test("score pondéré : poids = 100 %, tri décroissant, critères neutres signalés", () => {
    expect(Object.values(WEIGHTS).reduce((s, w) => s + w, 0)).toBeCloseTo(1, 10);
    const { opportunities } = groupQueries([
      { query: "création jardin castries", clicks: 1, impressions: 800, position: 9 },
      { query: "visite conseil jacou", clicks: 0, impressions: 40, position: 25 },
    ]);
    const scored = scoreOpportunities({
      opportunities,
      hourlyRates: { AP: 80, Conseil: 40 },
      travelMinutes: { Castries: 8, Jacou: 12 },
      monthly: {},
      promoted: ["AP"],
      today: new Date(2026, 9, 23),
    });
    expect(scored[0]!.prestation).toBe("AP");
    expect(scored[0]!.score).toBeGreaterThan(scored[1]!.score);
    expect(scored[0]!.promoted).toBe(true);
    expect(scored[1]!.promoted).toBe(false);
    expect(scored[0]!.neutral).toContain("saisonnalite");
  });

  test("lacunes : combinaisons promues sans impression", () => {
    const { opportunities } = groupQueries([
      { query: "création jardin castries", clicks: 1, impressions: 100, position: 9 },
    ]);
    const gaps = visibilityGaps(opportunities, ["AP"]);
    expect(gaps).toHaveLength(7);
    expect(gaps.some((g) => g.commune === "Castries")).toBe(false);
  });

  const opp = (prestation: "AP" | "Conseil" | "SAP", commune: string) => ({
    key: `${prestation}|${commune}`,
    prestation,
    commune,
    impressions: 100,
    clicks: 5,
    position: 8,
    topQueries: [],
    potentialClicks: 0,
  });

  test("entretien promu seulement à moins de 10 km", () => {
    const out = scoreOpportunities({
      opportunities: [opp("SAP", "Castries"), opp("SAP", "Jacou"), opp("AP", "Jacou")],
      hourlyRates: {},
      travelMinutes: { Castries: 8, Jacou: 12 },
      travelKm: { Castries: 6.5, Jacou: 11.2 },
      monthly: {},
      promoted: ["AP", "Conseil"],
    });
    const get = (k: string) => out.find((o) => o.key === k)!;
    expect(get("SAP|Castries").promoted).toBe(true);
    expect(get("SAP|Jacou").promoted).toBe(false);
    expect(get("AP|Jacou").promoted).toBe(true);
  });

  test("capacité : moyenne des 3 derniers mois et seuil de saturation", () => {
    const hours = monthlyHours(
      [
        { year: 2026, month: 8, hours: 90 },
        { year: 2026, month: 9, hours: 80 },
        { year: 2026, month: 10, hours: 100 },
        { year: 2025, month: 10, hours: 500 },
      ],
      2026,
    );
    const cap = computeCapacity(hours, new Date(2026, 9, 24));
    expect(cap.averageHours).toBe(90);
    expect(cap.saturated).toBe(true);
    expect(computeCapacity(hours, new Date(2026, 0, 5)).saturated).toBe(false);
  });

  test("saturation : freine les prestations gourmandes en heures, pas la visite conseil", () => {
    const params = {
      opportunities: [opp("AP", "Castries"), opp("Conseil", "Castries")],
      hourlyRates: {},
      travelMinutes: { Castries: 8 },
      monthly: {},
      promoted: ["AP", "Conseil"] as Array<"AP" | "Conseil">,
    };
    const free = scoreOpportunities(params);
    const sat = scoreOpportunities({
      ...params,
      capacity: { averageHours: 95, threshold: 80, saturated: true },
    });
    const ap = (list: typeof free) => list.find((o) => o.prestation === "AP")!;
    const conseil = (list: typeof free) => list.find((o) => o.prestation === "Conseil")!;
    expect(ap(sat).capacityFactor).toBe(CAPACITY_FACTOR);
    expect(ap(sat).score).toBeLessThan(ap(free).score);
    expect(conseil(sat).score).toBe(conseil(free).score);
  });
});
