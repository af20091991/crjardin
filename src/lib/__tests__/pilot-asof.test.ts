// Photographie du RÉALISÉ à la date de référence (15 août 2024).
// Règle testée : tout indicateur présenté comme réalisé s'arrête à la date de
// référence incluse — aucune saisie future du mois en cours, aucun mois futur.
import { describe, expect, test } from "bun:test";
import { buildAnalytics } from "@/lib/pilot-engine";
import { annualSummary } from "@/lib/pilot-annual";
import { projectYear } from "@/lib/pilot-projection";
import { monthlyChargeTotals } from "@/lib/pilot-charges";
import { computeKpis, DEFAULT_SETTINGS } from "@/lib/pilot";
import { charge, engineInputs, ledgerSale, NOW, sale, scope, statuses, YEAR } from "./pilot-fixtures";

const line = (id: string, date: string, amount: number) =>
  sale({
    id,
    entry_date: date,
    amount_ht: amount,
    hours: 10,
    client_id: "c1",
    client_name: "Adagios",
  });

const DATED = [
  line("d14", `${YEAR}-08-14`, 1_000), // veille : inclus
  line("d15", `${YEAR}-08-15`, 2_000), // jour de référence : inclus
  line("d16", `${YEAR}-08-16`, 4_000), // lendemain : exclu
  line("d31", `${YEAR}-08-31`, 8_000), // fin du mois en cours : exclu
  line("sep", `${YEAR}-09-01`, 16_000), // mois futur : exclu
  line("dec", `${YEAR}-12-31`, 32_000), // fin d'exercice : exclu
];

const snap = (over = {}) =>
  buildAnalytics(
    engineInputs({
      entries: DATED,
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 10, month: 8, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
      ...over,
    }),
    NOW,
  );

describe("réalisé à date — CA du mois et de l'exercice", () => {
  const s = snap();

  test("le réalisé s'arrête au 15 août inclus (1 000 + 2 000)", () => {
    expect(s.ca.yearHt).toBe(3_000);
    expect(s.ca.ytdHt).toBe(3_000);
    expect(s.ca.monthHt).toBe(3_000);
  });

  test("aucune saisie du 16 au 31 août n'entre dans le réalisé du mois", () => {
    expect(s.ca.byMonth[7].current).toBe(3_000);
  });

  test("les mois futurs de l'exercice restent à zéro dans le réalisé", () => {
    expect(s.ca.byMonth[8].current).toBe(0);
    expect(s.ca.byMonth[11].current).toBe(0);
  });

  test("une saisie future n'augmente jamais le résultat réalisé", () => {
    const sansFutur = buildAnalytics(
      engineInputs({
        entries: DATED.slice(0, 2),
        ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 10, month: 8, clientId: "c1" })],
        statuses: statuses({ c1: "certified_client" }),
      }),
      NOW,
    );
    expect(s.ca.yearHt).toBe(sansFutur.ca.yearHt);
    expect(s.resultat.beneficeBrut).toBe(sansFutur.resultat.beneficeBrut);
  });

  test("un vrai montant à 0 reste 0 (et non « indisponible »)", () => {
    const zero = buildAnalytics(
      engineInputs({
        entries: [line("z", `${YEAR}-08-15`, 0)],
        statuses: statuses({ c1: "certified_client" }),
      }),
      NOW,
    );
    expect(zero.ca.yearHt).toBe(0);
    expect(zero.kpis.ca_annuel.value).toBe(0);
    expect(zero.kpis.ca_annuel.status).toBe("ok");
  });
});

describe("réalisé à date — charges, marge et heures", () => {
  const s = snap({
    chargeRows: [
      charge({ id: "ch8", year: YEAR, month: 8, amount_ht: 1_000 }), // mois en cours : inclus
      charge({ id: "ch9", year: YEAR, month: 9, amount_ht: 5_000 }), // mois futur : exclu
      charge({ id: "ch12", year: YEAR, month: 12, amount_ht: 9_000 }), // mois futur : exclu
    ],
  });

  test("les charges des mois futurs n'entrent pas dans le réalisé", () => {
    expect(s.charges.total).toBe(1_000);
    expect(s.charges.byMonth[8]).toBe(0);
    expect(s.charges.byMonth[11]).toBe(0);
  });

  test("résultat et marge découlent du seul périmètre à date", () => {
    expect(s.resultat.beneficeBrut).toBe(2_000);
    expect(s.resultat.margePct).toBeCloseTo((2_000 / 3_000) * 100, 6);
  });

  test("les heures réelles proviennent du même périmètre à date", () => {
    expect(s.hours.reelles).toBe(10);
    expect(s.rates.tauxHoraireReel).toBe(3_000 / 20);
  });
});

describe("réalisé à date — moteurs appelés avec la même date de référence", () => {
  test("annualSummary borne l'exercice en cours à la date de référence", () => {
    const rows = annualSummary(DATED, [charge({ id: "ch9", year: YEAR, month: 9, amount_ht: 500 })], {
      now: NOW,
    });
    const row = rows.find((r) => r.year === YEAR);
    expect(row?.caHt).toBe(3_000);
    expect(row?.charges).toBe(0);
  });

  test("projectYear calcule son réalisé avec la date de référence injectée", () => {
    const p = projectYear({
      entries: DATED,
      charges: [],
      year: YEAR,
      mode: "projection",
      now: NOW,
    });
    expect(p.caReel).toBe(3_000);
    expect(p.monthly[8].projected).toBe(true);
  });

  test("la projection n'est jamais mélangée au réalisé du moteur", () => {
    const s = snap();
    expect(s.projection.caProjete >= s.ca.yearHt).toBe(true);
    expect(s.ca.yearHt).toBe(3_000);
    const proj = buildAnalytics(
      engineInputs({
        scope: scope({ mode: "projection" }),
        entries: DATED,
        statuses: statuses({ c1: "certified_client" }),
      }),
      NOW,
    );
    // Mode projection explicite : les lignes futures sont visibles, mais
    // uniquement dans cette lecture identifiée comme telle.
    expect(proj.ca.yearHt).toBe(63_000);
  });
});

describe("borne annuelle explicite — 15 août 2024", () => {
  const boundaryEntries = [
    line("aug15", "2024-08-15", 100),
    line("aug16", "2024-08-16", 200),
    line("aug31", "2024-08-31", 400),
    line("sep01", "2024-09-01", 800),
    line("dec31", "2024-12-31", 1_600),
    line("past31", "2023-12-31", 3_200),
    line("future-year", "2025-01-01", 6_400),
  ];
  const datedCharges = [
    charge({ id: "ch15", year: 2024, month: 8, entry_date: "2024-08-15", amount_ht: 10 }),
    charge({ id: "ch16", year: 2024, month: 8, entry_date: "2024-08-16", amount_ht: 20 }),
    charge({ id: "ch31", year: 2024, month: 12, entry_date: "2024-12-31", amount_ht: 40 }),
    charge({ id: "ch-past", year: 2023, month: 12, entry_date: "2023-12-31", amount_ht: 80 }),
    charge({ id: "ch-future", year: 2025, month: 1, entry_date: "2025-01-01", amount_ht: 160 }),
  ];

  test("15 août inclus ; 16, 31 août, 1er septembre et 31 décembre exclus", () => {
    const row = annualSummary(boundaryEntries, [], { mode: "reel", now: NOW }).find(
      (candidate) => candidate.year === 2024,
    );
    expect(row?.caHt).toBe(100);
    expect(row?.heuresVendues).toBe(10);
  });

  test("un jeu composé uniquement de lignes futures produit un réalisé nul", () => {
    const futureOnly = boundaryEntries.filter((entry) => entry.entry_date > "2024-08-15");
    const kpis = computeKpis({
      entries: futureOnly,
      charges: [],
      settings: { user_id: "u1", ...DEFAULT_SETTINGS },
      year: 2024,
      month: 7,
      mode: "reel",
      now: NOW,
    });
    expect(kpis.caYear).toBe(0);
  });

  test("année passée complète conservée et année future sans réalisé", () => {
    const rows = annualSummary(boundaryEntries, [], { mode: "reel", now: NOW });
    expect(rows.find((row) => row.year === 2023)?.caHt).toBe(3_200);
    expect(rows.find((row) => row.year === 2025) == null).toBe(true);
  });

  test("computeKpis, buildAnalytics, annualSummary et projectYear partagent la même borne", () => {
    const kpis = computeKpis({
      entries: boundaryEntries,
      charges: [],
      settings: { user_id: "u1", ...DEFAULT_SETTINGS },
      year: 2024,
      month: 7,
      mode: "reel",
      now: NOW,
    });
    const snapshot = buildAnalytics(
      engineInputs({
        entries: boundaryEntries,
        ledger: boundaryEntries.map((entry) =>
          ledgerSale({
            id: `ledger-${entry.id}`,
            year: Number(entry.entry_date.slice(0, 4)),
            month: Number(entry.entry_date.slice(5, 7)),
            date: entry.entry_date,
            hours: 10,
          }),
        ),
      }),
      NOW,
    );
    const annual = annualSummary(boundaryEntries, [], { mode: "reel", now: NOW }).find(
      (row) => row.year === 2024,
    );
    const projected = projectYear({
      entries: boundaryEntries,
      charges: [],
      year: 2024,
      mode: "reel",
      now: NOW,
    });

    expect(kpis.caYear).toBe(100);
    expect(snapshot.ca.yearHt).toBe(100);
    expect(snapshot.hours.reelles).toBe(10);
    expect(annual?.caHt).toBe(100);
    expect(projected.caReel).toBe(100);
  });

  test("charges annuelles : borne au jour, historique complet, futur vide", () => {
    expect(monthlyChargeTotals(datedCharges, 2024, { mode: "reel", now: NOW })).toEqual([
      0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0,
    ]);
    expect(monthlyChargeTotals(datedCharges, 2023, { mode: "reel", now: NOW })[11]).toBe(80);
    expect(monthlyChargeTotals(datedCharges, 2025, { mode: "reel", now: NOW }).reduce((a, b) => a + b, 0)).toBe(0);
  });

  test("un montant nul reste nul et la projection ne modifie pas le réalisé", () => {
    const zero = line("zero", "2024-08-15", 0);
    expect(annualSummary([zero], [], { mode: "reel", now: NOW })[0]?.caHt).toBe(0);

    const reel = projectYear({ entries: boundaryEntries, charges: [], year: 2024, mode: "reel", now: NOW });
    const projection = projectYear({
      entries: boundaryEntries,
      charges: [],
      year: 2024,
      mode: "projection",
      now: NOW,
    });
    expect(projection.caReel).toBe(reel.caReel);
    expect(reel.monthly[11].ca).toBe(0);
  });
});
