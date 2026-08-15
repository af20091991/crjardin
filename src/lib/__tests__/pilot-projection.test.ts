// ---------------------------------------------------------------------------
// KPI « projection_annuelle » — contrat NORMALISÉ.
//
// `projectYear` reçoit désormais son mode EXPLICITEMENT (jamais déduit de
// `new Date()` ni d'un état secondaire) :
//   · mode "reel"       → uniquement les données jusqu'à la date de référence,
//                         aucun mois futur, aucune extrapolation ;
//   · mode "projection" → réalisé à date (identique au mode réel) + règle de
//                         projection existante sur les mois restants.
//
// Base réelle commune aux deux modes : entriesForMode / chargeRowsForMode en
// « reel » avec la date de référence transmise. Une saisie future ne devient
// donc jamais du réalisé, même en mode projection.
//
// Investissements : EXCLUS dans les deux chemins d'appel (règle du moteur
// analytique officiel `buildAnalytics`), comme la rémunération dirigeant.
// ---------------------------------------------------------------------------
import { describe, expect, test } from "bun:test";
import { projectYear } from "@/lib/pilot-projection";
import { buildAnalytics } from "@/lib/pilot-engine";
import {
  charge,
  engineInputs,
  ledgerSale,
  NOW,
  sale,
  scope,
  statuses,
  YEAR,
} from "./pilot-fixtures";

const ENTRIES = [
  sale({ id: "s1", entry_date: `${YEAR}-01-15`, amount_ht: 1_000, hours: 10, client_id: "c1" }),
  sale({ id: "s2", entry_date: `${YEAR}-02-15`, amount_ht: 1_000, hours: 10, client_id: "c1" }),
];
const CHARGES = [
  charge({ id: "ch1", year: YEAR, month: 1, amount_ht: 400 }),
  charge({ id: "ch2", year: YEAR, month: 2, amount_ht: 400 }),
  charge({ id: "inv", year: YEAR, month: 2, amount_ht: 5_000, is_investment: true }),
  charge({ id: "rem", year: YEAR, month: 2, amount_ht: 2_000, kind: "remuneration" }),
];

describe("projectYear — extrapolation d'exercice", () => {
  test("aucune donnée : aucune projection produite", () => {
    const p = projectYear({ entries: [], charges: [], year: YEAR, mode: "projection" });
    expect(p.method).toBe("aucune");
    expect(p.confidence).toBe("faible");
    expect(p.caProjete).toBe(0);
    expect(p.explanation).toContain("Aucune donnée");
  });

  test("sans historique saisonnier : moyenne mensuelle des mois observés", () => {
    const p = projectYear({
      entries: ENTRIES,
      charges: CHARGES,
      year: YEAR,
      mode: "projection",
      currentMonth: 2,
    });
    expect(p.method).toBe("moyenne");
    expect(p.monthsObserved).toBe(2);
    expect(p.caReel).toBe(2_000);
    expect(p.caProjete).toBe(12_000); // 1 000 €/mois × 12
    expect(p.monthly.filter((m) => m.projected)).toHaveLength(10);
  });

  test("rémunération dirigeant ET investissements exclus des charges", () => {
    const p = projectYear({
      entries: ENTRIES,
      charges: CHARGES,
      year: YEAR,
      mode: "projection",
      currentMonth: 2,
    });
    // 400 + 400 = 800 € (rémunération et investissement exclus).
    expect(p.chargesReelles).toBe(800);
  });

  test("mois sans donnée : aucun montant réel inventé", () => {
    const p = projectYear({
      entries: ENTRIES,
      charges: CHARGES,
      year: YEAR,
      mode: "projection",
      currentMonth: 2,
    });
    expect(p.monthly[2].projected).toBe(true);
    expect(p.monthly[0].ca).toBe(1_000);
    expect(p.monthly[0].projected).toBe(false);
  });
});

describe("projection_annuelle — cohérence des deux chemins d'appel", () => {
  const direct = projectYear({
    entries: ENTRIES,
    charges: CHARGES,
    year: YEAR,
    mode: "projection",
    currentMonth: 2,
  });
  const snap = buildAnalytics(
    engineInputs({
      scope: scope({ mode: "projection" }),
      entries: ENTRIES,
      chargeRows: CHARGES,
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 20, month: 1, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
    }),
    NOW,
  );

  test("le CA réel de base est identique dans les deux lectures", () => {
    expect(snap.projection.caReel).toBe(direct.caReel);
  });

  test("les investissements suivent la même règle dans les deux chemins", () => {
    expect(direct.chargesReelles).toBe(800);
    expect(snap.projection.chargesReelles).toBe(direct.chargesReelles);
  });

  test("le KPI CA et la projection partagent la date de référence", () => {
    expect(snap.kpis.ca_annuel.value).toBe(2_000);
    expect(snap.projection.caReel).toBe(2_000);
    expect(snap.projection.method).toBe("moyenne");
    // Mois observés : mois de la date de référence (août ⇒ 8).
    expect(snap.projection.monthsObserved).toBe(8);
    expect(snap.projection.caProjete).toBe(3_000);
  });

  test("mode réel : réalisé identique au chemin central, sans extrapolation", () => {
    const directReel = projectYear({
      entries: ENTRIES,
      charges: CHARGES,
      year: YEAR,
      mode: "reel",
      now: NOW,
    });
    const snapReel = buildAnalytics(
      engineInputs({
        scope: scope({ mode: "reel" }),
        entries: ENTRIES,
        chargeRows: CHARGES,
        ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 20, month: 1, clientId: "c1" })],
        statuses: statuses({ c1: "certified_client" }),
      }),
      NOW,
    );
    expect(directReel.caReel).toBe(snapReel.projection.caReel);
    expect(directReel.chargesReelles).toBe(snapReel.projection.chargesReelles);
    expect(directReel.caProjete).toBe(directReel.caReel);
    expect(directReel.monthly.every((m) => !m.projected)).toBe(true);
  });
});

describe("projectYear — séparation réalisé / projection (date de référence fixe)", () => {
  const WITH_FUTURE = [
    ...ENTRIES,
    // Saisie future du mois en cours (août) et d'un mois futur (octobre).
    sale({ id: "f1", entry_date: `${YEAR}-08-31`, amount_ht: 9_000, hours: 1, client_id: "c1" }),
    sale({ id: "f2", entry_date: `${YEAR}-10-10`, amount_ht: 7_000, hours: 1, client_id: "c1" }),
  ];

  test("mode réel : dates futures du mois en cours exclues", () => {
    const p = projectYear({
      entries: WITH_FUTURE,
      charges: [],
      year: YEAR,
      mode: "reel",
      now: NOW,
    });
    expect(p.caReel).toBe(2_000);
    expect(p.monthly[7].ca).toBe(0);
  });

  test("mode réel : aucun mois futur comptabilisé", () => {
    const p = projectYear({
      entries: WITH_FUTURE,
      charges: [],
      year: YEAR,
      mode: "reel",
      now: NOW,
    });
    expect(p.monthly[9].ca).toBe(0);
    expect(p.caProjete).toBe(p.caReel);
    expect(p.method).toBe("aucune");
  });

  test("mode projection : une saisie future ne devient jamais du réalisé", () => {
    const p = projectYear({
      entries: WITH_FUTURE,
      charges: [],
      year: YEAR,
      mode: "projection",
      now: NOW,
    });
    expect(p.caReel).toBe(2_000);
    expect(p.monthly[9].projected).toBe(true);
    expect(p.monthly[9].ca).not.toBe(7_000);
  });

  test("la projection ne modifie pas la valeur du réalisé", () => {
    const reel = projectYear({
      entries: WITH_FUTURE,
      charges: CHARGES,
      year: YEAR,
      mode: "reel",
      now: NOW,
    });
    const proj = projectYear({
      entries: WITH_FUTURE,
      charges: CHARGES,
      year: YEAR,
      mode: "projection",
      now: NOW,
    });
    expect(proj.caReel).toBe(reel.caReel);
    expect(proj.chargesReelles).toBe(reel.chargesReelles);
    expect(proj.caProjete > proj.caReel).toBe(true);
  });

  test("un vrai zéro reste zéro dans les deux modes", () => {
    const reel = projectYear({ entries: [], charges: [], year: YEAR, mode: "reel", now: NOW });
    const proj = projectYear({
      entries: [],
      charges: [],
      year: YEAR,
      mode: "projection",
      now: NOW,
    });
    expect(reel.caReel).toBe(0);
    expect(reel.caProjete).toBe(0);
    expect(proj.caReel).toBe(0);
    expect(proj.caProjete).toBe(0);
  });
});
