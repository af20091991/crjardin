import { describe, expect, test } from "bun:test";
import { chantierFinance, posteFinance, type FinanceLine } from "../predevis-finance";
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

describe("posteFinance — données manquantes : signalées, jamais bloquantes", () => {
  test("prix d'achat manquant : le calcul porte sur les lignes renseignées", () => {
    const r = posteFinance([f(60, 40), f(40, null)]);
    expect(r.prixAchatHt).toBe(40);
    expect(r.margeHt).toBe(60);
    expect(r.tauxMarge).toBe(60);
    expect(r.pvHt).toBe(100);
    expect(r.complete).toBe(false);
    expect(r.issues).toContain("Prix d'achat manquant.");
  });

  test("aucun prix connu : indicateurs d'achat à null, jamais 0", () => {
    const r = posteFinance([f(60, null)]);
    expect(r.prixAchatHt).toBeNull();
    expect(r.achatFournituresHt).toBeNull();
    expect(r.margeHt).toBeNull();
  });

  test("montant HT manquant : signalé, PV HT calculé sur le reste", () => {
    const r = posteFinance([f(60, 40), { ...f(0, 10), ht: null }]);
    expect(r.pvHt).toBe(60);
    expect(r.issues).toContain("Montant HT manquant.");
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
    expect(text).toContain("- Terre végétale criblée enrichie - 35L\n  Quantité : 22 pièce");
    expect(text).toContain("- Billes d'argile 20 L, calibrées\n  Quantité : 5 unité à préciser");
    expect(text.split("\n\n")).toHaveLength(2);
    expect(text).not.toContain("€");
    expect(text).not.toContain("Main d'oeuvre");
  });

  test("donnée absente signalée, jamais inventée", () => {
    const text = clientBlock([
      { kind: "fourniture", designation: "X", clientDescription: null, quantity: null, unit: null },
    ]);
    expect(text).toBe("- X\n  Quantité : à préciser");
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
    expect(r.prixAchatHt).toBe(50);
    expect(r.issues).toContain("Coût de main-d'œuvre manquant.");
  });
  test("une fourniture sans prix : achat fournitures non calculé", () => {
    const r = posteFinance([
      { kind: "fourniture", ht: 100, ttc: 120, costHt: null, zeroCostReason: null },
      { kind: "mo", ht: 80, ttc: 96, costHt: 30, zeroCostReason: null },
    ]);
    expect(r.achatFournituresHt).toBeNull();
  });
});

describe("coût SST (rentabilité SST incluse)", () => {
  const lines = [
    { kind: "fourniture" as const, ht: 1000, ttc: 1200, costHt: 600, zeroCostReason: null },
  ];
  test("sans coût SST saisi : marge SST-incluse non calculée", () => {
    const f = posteFinance(lines);
    expect(f.sstCostHt ?? null).toBeNull();
    expect(f.margeAvecSstHt ?? null).toBeNull();
    expect(f.tauxMargeAvecSst ?? null).toBeNull();
  });
  test("coût SST déduit de la marge nette et reporté en taux", () => {
    const f = posteFinance(lines, { sstCostHt: 150 });
    expect(f.margeHt).toBe(400);
    expect(f.margeAvecSstHt).toBe(250);
    expect(f.tauxMargeAvecSst).toBe(25);
  });
});

describe("synthèse chantier", () => {
  test("somme des postes, SST inclus, taux sur PV total", () => {
    const a = posteFinance(
      [{ kind: "fourniture", ht: 1000, ttc: 1200, costHt: 600, zeroCostReason: null }],
      { sstCostHt: 100 },
    );
    const b = posteFinance(
      [{ kind: "fourniture", ht: 1000, ttc: 1200, costHt: 400, zeroCostReason: null }],
      { sstCostHt: 200 },
    );
    const c = chantierFinance([a, b]);
    expect(c.pvHt).toBe(2000);
    expect(c.margeHt).toBe(1000);
    expect(c.sstCostHt).toBe(300);
    expect(c.margeAvecSstHt).toBe(700);
    expect(c.tauxMarge).toBe(50);
    expect(c.tauxMargeAvecSst).toBe(35);
    expect(c.postesAvecSst).toBe(2);
  });
  test("sans SST saisi : coût SST null, marge après SST null", () => {
    const c = chantierFinance([
      posteFinance([
        { kind: "fourniture", ht: 1000, ttc: 1200, costHt: 600, zeroCostReason: null },
      ]),
    ]);
    expect(c.sstCostHt).toBeNull();
    expect(c.margeAvecSstHt).toBeNull();
    expect(c.postesAvecSst).toBe(0);
  });
});
