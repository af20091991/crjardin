import { describe, expect, test } from "bun:test";
import { posteFinance, type FinanceLine } from "../predevis-finance";
import { clientBlock, type ClientBlockLine } from "../predevis-client-block";

const f = (ht: number, costHt: number | null, ttc?: number): FinanceLine => ({
  kind: "fourniture",
  ht,
  ttc: ttc ?? Math.round(ht * 1.2 * 100) / 100,
  costHt,
  zeroCostReason: null,
});
const mo = (
  ht: number,
  costHt: number | null,
  zero: "remise" | "sav" | null = null,
): FinanceLine => ({
  kind: "mo",
  ht,
  ttc: Math.round(ht * 1.2 * 100) / 100,
  costHt,
  zeroCostReason: zero,
});

describe("posteFinance — exemple chiffré", () => {
  test("marge = PV HT − PAU HT, taux en %, parts MO et fournitures", () => {
    // PV HT 100 : fournitures 60 (coût 40), MO 40 (coût 20)
    const r = posteFinance([f(60, 40), mo(40, 20)]);
    expect(r.pvHt).toBe(100);
    expect(r.pvTtc).toBe(120);
    expect(r.prixAchatHt).toBe(60);
    expect(r.margeHt).toBe(40);
    expect(r.tauxMarge).toBe(40);
    expect(r.partMo).toBe(40);
    expect(r.partFournitures).toBe(60);
    expect(r.complete).toBe(true);
  });
});

describe("posteFinance — données manquantes (jamais 0)", () => {
  test("prix d'achat manquant : indicateurs liés à null", () => {
    const r = posteFinance([f(60, 40), f(40, null)]);
    expect(r.prixAchatHt).toBeNull();
    expect(r.margeHt).toBeNull();
    expect(r.tauxMarge).toBeNull();
    expect(r.pvHt).toBe(100);
    expect(r.complete).toBe(false);
    expect(r.issues).toContain("Prix d'achat manquant.");
  });

  test("MO à 0 € sans motif : signalée et bloque les indicateurs", () => {
    const r = posteFinance([f(60, 40), mo(40, 0)]);
    expect(r.issues.join(" ")).toContain("0 € sans motif");
    expect(r.prixAchatHt).toBeNull();
    expect(r.complete).toBe(false);
  });

  test("MO à 0 € avec motif (remise ou SAV) : accepté", () => {
    const r = posteFinance([f(60, 40), mo(40, 0, "remise")]);
    expect(r.issues).toEqual([]);
    expect(r.prixAchatHt).toBe(40);
    expect(r.margeHt).toBe(60);
  });

  test("PV HT nul : taux et parts à null", () => {
    const r = posteFinance([f(0, 0)]);
    expect(r.tauxMarge).toBeNull();
    expect(r.partMo).toBeNull();
  });
});

describe("clientBlock", () => {
  const lines: ClientBlockLine[] = [
    {
      kind: "fourniture",
      designation: "Terre végétale criblée enrichie - 35L",
      clientDescription: null,
      quantity: 22,
      unit: "pièce",
    },
    {
      kind: "fourniture",
      designation: "Billes d'argile - T5",
      clientDescription: "Billes d'argile 20 L, calibrées",
      quantity: 5,
      unit: null,
    },
    { kind: "mo", designation: "Main d'oeuvre", clientDescription: null, quantity: 1, unit: null },
  ];

  test("liste les fournitures avec quantité et unité, sans prix ni marge", () => {
    const text = clientBlock(lines);
    expect(text).toContain("- Terre végétale criblée enrichie - 35L : 22 pièce");
    expect(text).toContain("- Billes d'argile 20 L, calibrées : 5 unité à préciser");
    expect(text).not.toContain("€");
    expect(text).not.toContain("Main d'oeuvre");
  });

  test("donnée absente signalée, jamais inventée", () => {
    const text = clientBlock([
      { kind: "fourniture", designation: "X", clientDescription: null, quantity: null, unit: null },
    ]);
    expect(text).toBe("- X : quantité à préciser unité à préciser");
  });
});

describe("posteFinance : achat des fournitures indépendant de la main-d'œuvre", () => {
  test("fournitures chiffrées, MO non saisie : achat fournitures affiché, revient non calculé", () => {
    const r = posteFinance([
      { kind: "fourniture", ht: 100, ttc: 120, costHt: 40, zeroCostReason: null },
      { kind: "fourniture", ht: 50, ttc: 60, costHt: 10, zeroCostReason: null },
      { kind: "mo", ht: 80, ttc: 96, costHt: null, zeroCostReason: null },
    ]);
    expect(r.achatFournituresHt).toBe(50);
    expect(r.prixAchatHt).toBeNull();
  });
  test("une fourniture sans prix : achat fournitures non calculé", () => {
    const r = posteFinance([
      { kind: "fourniture", ht: 100, ttc: 120, costHt: null, zeroCostReason: null },
      { kind: "mo", ht: 80, ttc: 96, costHt: 30, zeroCostReason: null },
    ]);
    expect(r.achatFournituresHt).toBeNull();
  });
});
