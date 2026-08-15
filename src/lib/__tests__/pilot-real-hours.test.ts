import { describe, expect, test } from "bun:test";
import { resolveRealHours } from "@/lib/pilot-real-hours";
import { ledgerSale, YEAR } from "./pilot-fixtures";

describe("resolveRealHours — source unique Vente → Temps", () => {
  test("aucune ligne : heures nulles et source explicitement absente", () => {
    const r = resolveRealHours([], YEAR);
    expect(r.hours).toBe(0);
    expect(r.source).toBe("aucune");
    expect(r.confidence).toBe("faible");
    expect(r.byClient.size).toBe(0);
  });

  test("heures confirmées de vente : retenues avec confiance haute", () => {
    const r = resolveRealHours(
      [
        ledgerSale({ id: "l1", year: YEAR, hours: 12, clientId: "c1" }),
        ledgerSale({ id: "l2", year: YEAR, hours: 8, clientId: "c1" }),
        ledgerSale({ id: "l3", year: YEAR, hours: 5, clientId: "c2" }),
      ],
      YEAR,
    );
    expect(r.hours).toBe(25);
    expect(r.source).toBe("vente_temps");
    expect(r.confidence).toBe("haute");
    expect(r.byClient.get("c1")).toBe(20);
    expect(r.byClient.get("c2")).toBe(5);
  });

  test("les heures d'un autre exercice ne fuient jamais", () => {
    const r = resolveRealHours(
      [
        ledgerSale({ id: "l1", year: YEAR, hours: 10, clientId: "c1" }),
        ledgerSale({ id: "old", year: YEAR - 1, hours: 999, clientId: "c1" }),
      ],
      YEAR,
    );
    expect(r.hours).toBe(10);
  });

  test("historique et interventions restent informatifs, hors calcul métier", () => {
    const r = resolveRealHours(
      [
        ledgerSale({
          id: "h",
          year: YEAR,
          hours: 40,
          clientId: "c1",
          type: "historique",
          source: "import_excel",
        }),
        ledgerSale({
          id: "i",
          year: YEAR,
          hours: 30,
          clientId: "c1",
          type: "realisee",
          source: "interventions",
        }),
      ],
      YEAR,
    );
    expect(r.historiques).toBe(40);
    expect(r.realisees).toBe(30);
    expect(r.hours).toBe(0);
    expect(r.source).toBe("aucune");
    expect(r.byClient.size).toBe(0);
  });

  test("0 h documenté (SST) n'ajoute aucune heure et ne crée pas de client", () => {
    const r = resolveRealHours(
      [ledgerSale({ id: "sst", year: YEAR, hours: 0, clientId: "c1" })],
      YEAR,
    );
    expect(r.hours).toBe(0);
    expect(r.byClient.has("c1")).toBe(false);
  });

  test("heures vendues non rattachées : comptées globalement, pas par client", () => {
    const r = resolveRealHours(
      [ledgerSale({ id: "orphan", year: YEAR, hours: 7, clientId: null })],
      YEAR,
    );
    expect(r.vendues).toBe(7);
    expect(r.venduesIdentifiees).toBe(0);
    expect(r.byClient.size).toBe(0);
  });
});
