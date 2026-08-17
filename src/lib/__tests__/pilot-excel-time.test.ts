import { describe, expect, test } from "bun:test";
import {
  buildTimeProof,
  excelRowsFromMatrix,
  matchKey,
  normalizeAmount,
  parseExcelHours,
  reconcileSaleTimes,
  restorationReason,
  type CaSaleRow,
  type ExcelSaleRow,
} from "@/lib/pilot-excel-time";
import { saleTimeKnown, saleTimeMissing, saleTimeState, saleRateEligible, saleRateScope } from "@/lib/pilot-sale-time";

const sale = (over: Partial<CaSaleRow> = {}): CaSaleRow => ({
  id: "s1",
  year: 2026,
  month: 3,
  clientName: "Château Bodard",
  designation: "Taille de haies",
  amountHt: 1200,
  interventionType: "interne",
  hours: null,
  ...over,
});

const xl = (over: Partial<ExcelSaleRow> = {}): ExcelSaleRow => ({
  rowIndex: 12,
  year: 2026,
  month: 3,
  client: "chateau  bodard",
  designation: "Taille de haies",
  amountHt: 1200,
  interventionType: null,
  time: parseExcelHours(0),
  ...over,
});

describe("0 h est une valeur valide", () => {
  test("0 h interne : temps connu", () => {
    expect(saleTimeState({ hours: 0, intervention_type: "interne" })).toBe("zero_saisi");
    expect(saleTimeKnown({ hours: 0, intervention_type: "interne" })).toBe(true);
  });
  test("0 h SST : temps connu", () => {
    expect(saleTimeKnown({ hours: 0, intervention_type: "sst" })).toBe(true);
  });
  test("null / vide : temps absent", () => {
    expect(saleTimeState({ hours: null })).toBe("absent");
    expect(saleTimeMissing({ hours: null })).toBe(true);
    expect(saleTimeMissing({})).toBe(true);
  });
  test("valeur négative ou non numérique : invalide, jamais connue", () => {
    expect(saleTimeState({ hours: -2 })).toBe("invalide");
    expect(saleTimeState({ hours: Number.NaN })).toBe("invalide");
    expect(saleTimeKnown({ hours: -2 })).toBe(false);
  });
  test("taux horaire : 0 h documenté n'ajoute rien au dénominateur", () => {
    const s = saleRateScope([
      { amount_ht: 1000, hours: 0, intervention_type: "interne" },
      { amount_ht: 500, hours: null },
    ]);
    expect(saleRateEligible({ amount_ht: 1000, hours: 0 })).toBe(true);
    expect(s.hours).toBe(0);
    expect(s.rate).toBeNull();
    expect(s.caTimed).toBe(1000);
    expect(s.caUntimed).toBe(500);
  });
});

describe("lecture stricte du Temps Excel", () => {
  test("0, 0,0 et 0.0 sont des zéros explicites", () => {
    for (const v of [0, "0", "0,0", "0.0", " 0 h "]) {
      expect(parseExcelHours(v).kind).toBe("zero");
    }
  });
  test("vide, tiret, texte : inconnu, jamais 0", () => {
    for (const v of [null, undefined, "", "-", "—", "n/a", "à voir"]) {
      expect(parseExcelHours(v).kind).toBe("inconnu");
    }
  });
  test("valeurs négatives ou infinies : invalides", () => {
    expect(parseExcelHours(-1).kind).toBe("invalide");
    expect(parseExcelHours(Number.POSITIVE_INFINITY).kind).toBe("invalide");
  });
  test("valeurs positives avec virgule décimale", () => {
    expect(parseExcelHours("3,5")).toEqual({ kind: "positive", hours: 3.5 });
  });
  test("montants normalisés pour comparaison", () => {
    expect(normalizeAmount("1 200,50 €")).toBe(1200.5);
    expect(normalizeAmount("1.200,50")).toBe(1200.5);
    expect(normalizeAmount("abc")).toBeNull();
  });
});

describe("rapprochement sûr", () => {
  test("clé déterministe : période + identité + montant", () => {
    expect(matchKey({ year: 2026, month: 3, client: "Bodard", designation: "Taille", amountHt: 1200 }))
      .toBe("2026|03|bodard|taille|1200.00");
  });

  test("correspondance unique à 0 : restauration démontrable et journalisable", () => {
    const p = buildTimeProof(sale(), [xl()], true);
    expect(p.verdict).toBe("zero_confirme");
    expect(p.restorable).toBe(true);
    expect(p.sourceHours).toBe(0);
    expect(p.confidence).toBe("certaine");
    expect(restorationReason(p)).toContain("ligne Excel 12");
    expect(restorationReason(p)).toContain("avant non renseigné");
  });

  test("correspondance multiple : rien n'est modifié", () => {
    const p = buildTimeProof(sale(), [xl(), xl({ rowIndex: 13 })], true);
    expect(p.verdict).toBe("ambigu");
    expect(p.restorable).toBe(false);
    expect(p.sourceHours).toBeNull();
  });

  test("aucune correspondance : le temps reste inconnu", () => {
    const p = buildTimeProof(sale(), [xl({ amountHt: 999 })], true);
    expect(p.verdict).toBe("absent_excel");
    expect(p.restorable).toBe(false);
  });

  test("cellule vide dans Excel : inconnu, jamais 0", () => {
    const p = buildTimeProof(sale(), [xl({ time: parseExcelHours("-") })], true);
    expect(p.verdict).toBe("absent_excel");
    expect(p.sourceHours).toBeNull();
  });

  test("valeur Excel invalide : signalée, pas appliquée", () => {
    const p = buildTimeProof(sale(), [xl({ time: parseExcelHours(-3) })], true);
    expect(p.verdict).toBe("valeur_invalide");
    expect(p.restorable).toBe(false);
  });

  test("Excel introuvable : verdict explicite, aucune écriture", () => {
    const p = buildTimeProof(sale(), [], false);
    expect(p.verdict).toBe("excel_introuvable");
    expect(p.restorable).toBe(false);
  });

  test("le nom seul ou le montant seul ne suffisent pas", () => {
    const wrongPeriod = buildTimeProof(sale(), [xl({ month: 4 })], true);
    expect(wrongPeriod.verdict).toBe("absent_excel");
    const wrongIdentity = buildTimeProof(
      sale(),
      [xl({ client: "Autre client", designation: "Autre prestation" })],
      true,
    );
    expect(wrongIdentity.verdict).toBe("absent_excel");
  });

  test("type de prestation divergent : pas de correspondance", () => {
    const p = buildTimeProof(sale({ interventionType: "sst" }), [xl({ interventionType: "interne" })], true);
    expect(p.verdict).toBe("absent_excel");
  });

  test("synthèse : chaque ligne est comptée une seule fois", () => {
    const r = reconcileSaleTimes({
      sales: [sale(), sale({ id: "s2", designation: "Tonte", amountHt: 300 })],
      excel: [xl(), xl({ rowIndex: 20, designation: "Tonte", amountHt: 300, time: parseExcelHours("2") })],
    });
    expect(r.proofs).toHaveLength(2);
    expect(r.counts.zero_confirme).toBe(1);
    expect(r.counts.temps_positif).toBe(1);
    expect(r.restorableZero).toBe(1);
    expect(r.restorablePositive).toBe(1);
  });

  test("les montants, périodes et libellés sources ne sont jamais réécrits", () => {
    const s = sale();
    const p = buildTimeProof(s, [xl({ designation: "TAILLE DE HAIES" })], true);
    expect(p.amountHt).toBe(1200);
    expect(p.year).toBe(2026);
    expect(p.month).toBe(3);
    expect(s.hours).toBeNull();
  });

  test("lecture d'une matrice Excel : en-têtes tolérants, zéro préservé", () => {
    const rows = excelRowsFromMatrix([
      ["Suivi mensuel"],
      ["Année", "Mois", "Client", "Désignation", "Montant HT", "Temps"],
      [2026, 3, "Bodard", "Taille", "1 200,00", "0,0"],
      [2026, 3, "Bodard", "Tonte", 300, "-"],
      [null, null, null, null, null, null],
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].time.kind).toBe("zero");
    expect(rows[0].amountHt).toBe(1200);
    expect(rows[1].time.kind).toBe("inconnu");
  });
});
