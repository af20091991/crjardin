// Classement de rentabilité client : identité économique + heures documentées.
import { describe, expect, test } from "bun:test";
import { classifyClients, strategicClients } from "@/lib/pilot-client-profitability";
import { DEFAULT_THRESHOLDS } from "@/lib/pilot-thresholds";
import { ledgerSale, sale, statuses, YEAR } from "./pilot-fixtures";

const BASE = {
  year: YEAR,
  targetHourlyRate: 50,
  thresholds: DEFAULT_THRESHOLDS,
};

describe("classifyClients", () => {
  test("aucune donnée : aucun client classé", () => {
    expect(classifyClients({ ...BASE, entries: [], ledger: [] })).toEqual([]);
  });

  test("client rentable : taux horaire au-dessus de la cible", () => {
    const rows = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "s1",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 5_500,
          hours: 100,
          client_id: "c1",
          client_name: "Adagios",
        }),
      ],
      ledger: [
        ledgerSale({
          id: "l1",
          year: YEAR,
          hours: 100,
          month: 4,
          clientId: "c1",
          clientName: "Adagios",
        }),
      ],
      statuses: statuses({ c1: "certified_client" }),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].tauxHoraire).toBe(55);
    expect(rows[0].classe).toBe("rentable");
    expect(rows[0].hoursSource).toBe("vente_temps");
    expect(rows[0].confidence).toBe("haute");
    expect(rows[0].interventions).toBe(1);
  });

  test("client chronophage : taux très en dessous de la cible", () => {
    const rows = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "s1",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 1_000,
          hours: 100,
          client_id: "c1",
          client_name: "Adagios",
        }),
      ],
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 100, month: 4, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
    });
    expect(rows[0].tauxHoraire).toBe(10);
    expect(rows[0].classe).toBe("chronophage");
  });

  test("heures inconnues : aucun classement, aucun taux inventé", () => {
    const rows = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "s1",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 8_000,
          hours: 0,
          hours_raw: null,
          client_id: "c1",
          client_name: "Adagios",
        }),
      ],
      ledger: [],
      statuses: statuses({ c1: "certified_client" }),
    });
    expect(rows[0].hours).toBe(0);
    expect(rows[0].hoursSource).toBe("aucune");
    expect(rows[0].tauxHoraire).toBeNull();
    expect(rows[0].classe).toBe("non_classe");
    expect(rows[0].confidence).toBe("faible");
  });

  test("heures insuffisantes (< seuil) : non classé malgré un taux calculable", () => {
    const rows = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "s1",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 900,
          hours: 2,
          client_id: "c1",
          client_name: "Adagios",
        }),
      ],
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 2, month: 4, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
    });
    expect(rows[0].hours).toBe(2);
    expect(rows[0].classe).toBe("non_classe");
  });

  test("doublon ou contact : exclu du classement stratégique, avec motif", () => {
    const rows = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "a",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 6_000,
          hours: 100,
          client_id: "c1",
          client_name: "Adagios",
        }),
        sale({
          id: "b",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 9_000,
          hours: 100,
          client_id: "c2",
          client_name: "Adagios (doublon)",
        }),
        sale({
          id: "c",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 7_000,
          hours: 100,
          client_id: "c3",
          client_name: "M. Dupont",
        }),
      ],
      ledger: [
        ledgerSale({ id: "l1", year: YEAR, hours: 100, month: 4, clientId: "c1" }),
        ledgerSale({ id: "l2", year: YEAR, hours: 100, month: 4, clientId: "c2" }),
        ledgerSale({ id: "l3", year: YEAR, hours: 100, month: 4, clientId: "c3" }),
      ],
      statuses: statuses({
        c1: "certified_client",
        c2: "duplicate_candidate",
        c3: "probable_contact",
      }),
    });
    expect(strategicClients(rows).map((r) => r.clientId)).toEqual(["c1"]);
    const dup = rows.find((r) => r.clientId === "c2")!;
    expect(dup.classe).toBe("non_classe");
    expect(dup.rankable).toBe(false);
    expect(dup.why).toContain("Doublon");
  });

  test("évolution N vs N-1 : nulle si l'exercice précédent est absent", () => {
    const rows = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "s1",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 1_200,
          hours: 20,
          client_id: "c1",
          client_name: "Adagios",
        }),
        sale({
          id: "s0",
          entry_date: `${YEAR - 1}-04-15`,
          amount_ht: 1_000,
          hours: 20,
          client_id: "c1",
          client_name: "Adagios",
        }),
      ],
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 20, month: 4, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
    });
    expect(rows[0].caYear).toBe(1_200);
    expect(rows[0].caPrevYear).toBe(1_000);
    expect(rows[0].evolutionPct).toBeCloseTo(20, 6);

    const noPrev = classifyClients({
      ...BASE,
      entries: [
        sale({
          id: "s1",
          entry_date: `${YEAR}-04-15`,
          amount_ht: 1_200,
          hours: 20,
          client_id: "c1",
        }),
      ],
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 20, month: 4, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
    });
    expect(noPrev[0].evolutionPct).toBeNull();
  });
});
