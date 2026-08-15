// Photographie du RÉALISÉ à la date de référence (15 août 2024).
// Règle testée : tout indicateur présenté comme réalisé s'arrête à la date de
// référence incluse — aucune saisie future du mois en cours, aucun mois futur.
import { describe, expect, test } from "bun:test";
import { buildAnalytics } from "@/lib/pilot-engine";
import { annualSummary } from "@/lib/pilot-annual";
import { projectYear } from "@/lib/pilot-projection";
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
    const p = projectYear({ entries: DATED, charges: [], year: YEAR, now: NOW });
    expect(p.caReel).toBe(3_000);
    expect(p.monthly[8].projected).toBe(true);
  });

  test("la projection n'est jamais mélangée au réalisé du moteur", () => {
    const s = snap();
    expect(s.projection.caProjete).toBeGreaterThanOrEqual(s.ca.yearHt);
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
