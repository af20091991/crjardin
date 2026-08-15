// ---------------------------------------------------------------------------
// KPI « projection_annuelle » — statut du contrat : À DOCUMENTER.
//
// Deux lectures coexistent aujourd'hui, et ce chantier NE LES CORRIGE PAS :
//
//  1. `projectYear(...)` (src/lib/pilot-projection.ts)
//     · filtre TOUJOURS ses entrées et ses charges en mode « réel »
//       (entriesForMode / chargeRowsForMode, donc date ≤ aujourd'hui) ;
//     · exclut la rémunération dirigeant (kind = "remuneration") ;
//     · extrapole jusqu'au 31/12 par saisonnalité, sinon par moyenne mensuelle.
//
//  2. `buildAnalytics(...).projection` (src/lib/pilot-engine.ts, l. 446-451)
//     · appelle `projectYear` avec `inputs.entries` BRUTES (non filtrées par le
//       mode du périmètre) et les charges hors investissements uniquement ;
//     · dans un même écran, `kpis.ca_annuel` peut donc reposer sur un périmètre
//       filtré (mode réel : date ≤ aujourd'hui) tandis que `projection` repart
//       d'un jeu de lignes plus large avant re-filtrage interne.
//
// Différence observée et protégée par les tests ci-dessous :
//   · investissements : exclus dans l'appel du moteur, PAS exclus lors d'un
//     appel direct à `projectYear` (seule la rémunération l'est) ;
//   · une ligne future n'entre dans aucune des deux lectures, mais pour deux
//     raisons différentes (filtre appelant vs filtre interne).
// ---------------------------------------------------------------------------
import { describe, expect, test } from "bun:test";
import { projectYear } from "@/lib/pilot-projection";
import { buildAnalytics } from "@/lib/pilot-engine";
import { charge, engineInputs, ledgerSale, NOW, sale, scope, statuses, YEAR } from "./pilot-fixtures";

const ENTRIES = [
  sale({ id: "s1", entry_date: `${YEAR}-01-15`, amount_ht: 1_000, hours: 10, client_id: "c1" }),
  sale({ id: "s2", entry_date: `${YEAR}-02-15`, amount_ht: 1_000, hours: 10, client_id: "c1" }),
  // Ligne future : hors périmètre réel dans les deux lectures.
  sale({ id: "s3", entry_date: `${YEAR}-12-15`, amount_ht: 50_000, hours: 10, client_id: "c1" }),
];
const CHARGES = [
  charge({ id: "ch1", year: YEAR, month: 1, amount_ht: 400 }),
  charge({ id: "ch2", year: YEAR, month: 2, amount_ht: 400 }),
  charge({ id: "inv", year: YEAR, month: 2, amount_ht: 5_000, is_investment: true }),
  charge({ id: "rem", year: YEAR, month: 2, amount_ht: 2_000, kind: "remuneration" }),
];

describe("projectYear — extrapolation d'exercice", () => {
  test("aucune donnée : aucune projection produite", () => {
    const p = projectYear({ entries: [], charges: [], year: YEAR });
    expect(p.method).toBe("aucune");
    expect(p.confidence).toBe("faible");
    expect(p.caProjete).toBe(0);
    expect(p.explanation).toContain("Aucune donnée");
  });

  test("sans historique saisonnier : moyenne mensuelle des mois observés", () => {
    const p = projectYear({ entries: ENTRIES, charges: CHARGES, year: YEAR, currentMonth: 2 });
    expect(p.method).toBe("moyenne");
    expect(p.monthsObserved).toBe(2);
    expect(p.caReel).toBe(2_000);
    expect(p.caProjete).toBe(12_000); // 1 000 €/mois × 12
    expect(p.monthly.filter((m) => m.projected)).toHaveLength(10);
  });

  test("la rémunération dirigeant est exclue des charges projetées", () => {
    const p = projectYear({ entries: ENTRIES, charges: CHARGES, year: YEAR, currentMonth: 2 });
    // 400 + 400 + 5 000 d'investissement = 5 800 € réels (rémunération exclue).
    expect(p.chargesReelles).toBe(5_800);
  });

  test("les lignes futures ne gonflent jamais la base réelle", () => {
    const p = projectYear({ entries: ENTRIES, charges: CHARGES, year: YEAR, currentMonth: 2 });
    expect(p.caReel).toBe(2_000);
  });
});

describe("projection_annuelle — divergence de périmètre (à documenter)", () => {
  const direct = projectYear({ entries: ENTRIES, charges: CHARGES, year: YEAR, currentMonth: 2 });
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

  test("DIVERGENCE : les investissements sont exclus côté moteur, pas en appel direct", () => {
    expect(direct.chargesReelles).toBe(5_800); // 800 € + 5 000 € d'investissement
    expect(snap.projection.chargesReelles).toBe(800); // investissement retiré
    expect(snap.projection.chargesReelles).not.toBe(direct.chargesReelles);
  });

  test("le mode projection du KPI CA n'utilise pas le même filtre que projectYear", () => {
    // KPI : périmètre du mode (projection ⇒ 12 mois, ligne de décembre incluse).
    expect(snap.kpis.ca_annuel.value).toBe(52_000);
    // Projection : re-filtrage interne en réel ⇒ décembre exclu de la base.
    expect(snap.projection.caReel).toBe(2_000);
    expect(snap.projection.method).toBe("moyenne");
  });
});
