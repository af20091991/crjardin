import { describe, expect, test } from "bun:test";
import {
  TIME_TRACKING_START_YEAR,
  isTimeTrackedYear,
  keepTimeRequests,
  timeRequestApplies,
  timeRequirementForYear,
} from "@/lib/pilot-time-scope";
import { buildControlQueue } from "@/lib/pilot-control-queue";
import {
  buildExcelNatureIndex,
  compareNatureWithExcel,
  lookupExcelNature,
} from "@/lib/pilot-excel-nature";
import { buildNatureQueue, type NatureQueueRow } from "@/lib/pilot-nature-validation";
import { reasonsForLine } from "@/lib/pilot-validation";

const emptyQueue = {
  integrity: null,
  reconciliation: null,
  anomalies: null,
  kpi: null,
  orphans: null,
  charges: null,
  salesMissingTime: null,
  sstMissingClient: null,
} as const;

const sale = (year: number) => ({
  id: `s-${year}`,
  label: "Entretien",
  clientName: "Client",
  amount: 1000,
  year,
});

describe("règle historique : le Temps n'existe pas avant 2026", () => {
  test("2026 est le premier exercice suivi", () => {
    expect(TIME_TRACKING_START_YEAR).toBe(2026);
  });

  test("Test 1 — une ligne 2024 sans temps ne produit aucune demande de Temps", () => {
    const q = buildControlQueue({ ...emptyQueue, salesMissingTime: [sale(2024)] });
    expect(q.actions.filter((a) => a.domain === "heures")).toHaveLength(0);
    expect(q.closed.filter((a) => a.domain === "heures")).toHaveLength(0);
    expect(q.summary.manualCount).toBe(0);
  });

  test("Test 2 — une ligne 2025 sans temps ne produit aucune demande de Temps", () => {
    const q = buildControlQueue({ ...emptyQueue, salesMissingTime: [sale(2025)] });
    expect(q.actions).toHaveLength(0);
    expect(q.closed).toHaveLength(0);
  });

  test("Test 3 — une ligne 2026 sans temps peut produire une demande", () => {
    const q = buildControlQueue({ ...emptyQueue, salesMissingTime: [sale(2026)] });
    const hours = q.actions.filter((a) => a.domain === "heures");
    expect(hours).toHaveLength(1);
    expect(hours[0]!.title).toContain("Temps manquant");
  });

  test("les années antérieures sont qualifiées « non applicable »", () => {
    for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) {
      expect(isTimeTrackedYear(y)).toBe(false);
      expect(timeRequirementForYear(y)).toBe("non_applicable");
      expect(timeRequestApplies({ year: y })).toBe(false);
    }
    expect(isTimeTrackedYear(2026)).toBe(true);
    expect(timeRequirementForYear(2027)).toBe("attendu");
  });

  test("Test 7 — le filtre écarte les demandes sans supprimer les lignes", () => {
    const rows = [{ year: 2023, id: "a" }, { year: 2026, id: "b" }];
    const kept = keepTimeRequests(rows);
    expect(kept.map((r) => r.id)).toEqual(["b"]);
    // La source reste intacte : aucune ligne financière supprimée.
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe("a");
  });

  test("2024 et 2025 sans Temps n'entrent pas dans la validation financière", () => {
    for (const year of [2024, 2025]) {
      expect(
        reasonsForLine({
          year,
          kind: "vente",
          designation: "Client historique",
          charge_class: null,
          charge_category: null,
          match_status: "rattachee",
          source_file: "Suivi_mensuel_CA_2026-2.xlsx",
          source_sheet: "Historique CA 2020-2025",
        }),
      ).toEqual([]);
    }
  });

  test("2026 sans Temps reste traité par la file Temps, pas par la nature", () => {
    expect(buildControlQueue({ ...emptyQueue, salesMissingTime: [sale(2026)] }).actions).toHaveLength(1);
    expect(
      reasonsForLine({
        year: 2026,
        kind: "vente",
        designation: "Entretien",
        charge_class: null,
        charge_category: null,
        match_status: "rattachee",
      }),
    ).toEqual([]);
  });
});

const workbook = [
  {
    name: "Suivi 2026",
    matrix: [
      ["VENTES"],
      ["Désignation", "Montant"],
      ["Taille de haie", 1200],
      ["Tonte de pelouse", 800],
      ["CHARGES"],
      ["Désignation", "Montant"],
      ["Carburant", 300],
      ["Assurance", 900],
    ] as unknown[][],
  },
];

describe("rapprochement Excel → Pilot Pro (nature)", () => {
  const index = buildExcelNatureIndex(workbook);

  test("les deux blocs sont identifiés", () => {
    expect(index.blocksFound.sort()).toEqual(["charge", "vente"]);
    expect(index.salesRows).toBeGreaterThanOrEqual(2);
    expect(index.chargeRows).toBeGreaterThanOrEqual(2);
  });

  test("Test 4 — désignation du bloc Ventes → Vente", () => {
    const found = lookupExcelNature(index, "  taille de HAIE ");
    expect(found.kind).toBe("trouve");
    expect(found.kind === "trouve" && found.nature).toBe("vente");
  });

  test("Test 5 — désignation du bloc Charges → Charge", () => {
    const found = lookupExcelNature(index, "Carburant");
    expect(found.kind === "trouve" && found.nature).toBe("charge");
  });

  test("une ressemblance approximative ne donne aucune correspondance", () => {
    expect(lookupExcelNature(index, "Taille de haies hautes").kind).toBe("absent");
  });

  test("Test 6 — conflit signalé, aucune modification automatique", () => {
    const cmp = compareNatureWithExcel({ kind: "vente", designation: "Carburant" }, index);
    expect(cmp.verdict).toBe("conflit");
    expect(cmp.pilot).toBe("vente");
    expect(cmp.excel).toBe("charge");
    expect(cmp.explanation).toContain("Pilot Pro : Ventes");
    expect(cmp.explanation).toContain("Excel : Charges");
  });

  test("accord Excel / Pilot Pro : rien à traiter", () => {
    const cmp = compareNatureWithExcel({ kind: "vente", designation: "Tonte de pelouse" }, index);
    expect(cmp.verdict).toBe("accord");
  });

  test("file de validation : conflits d'abord, lignes conformes exclues", () => {
    const rows: NatureQueueRow[] = [
      {
        id: "1",
        year: 2026,
        month: 3,
        designation: "Tonte de pelouse",
        amount: 800,
        kind: "vente",
        currentClass: "—",
        placement: "Encart Ventes",
        needsDecision: false,
      },
      {
        id: "2",
        year: 2026,
        month: 4,
        designation: "Carburant",
        amount: 300,
        kind: "vente",
        currentClass: "—",
        placement: "Encart Ventes",
        needsDecision: false,
      },
      {
        id: "3",
        year: 2023,
        month: 5,
        designation: "Divers",
        amount: 100,
        kind: "charge",
        currentClass: "a_classer",
        placement: "Encart Charges",
        needsDecision: true,
      },
    ];
    const queue = buildNatureQueue(rows, index);
    expect(queue.map((i) => i.line.id)).toEqual(["2", "3"]);
    expect(queue[0]!.reason).toBe("conflit");
    expect(queue[1]!.reason).toBe("a_classer");
  });
});
