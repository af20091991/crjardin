// Protection du moteur analytique central (buildAnalytics) — aucune formule
// n'est recopiée ici : les tests vérifient les valeurs produites par le moteur.
import { describe, expect, test } from "bun:test";
import { buildAnalytics } from "@/lib/pilot-engine";
import { auditCoherence } from "@/lib/pilot-engine-audit";
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

describe("buildAnalytics — absence de données", () => {
  const snap = buildAnalytics(engineInputs(), NOW);

  test("aucune ligne : CA à 0 et indicateur de CA disponible (vrai 0)", () => {
    expect(snap.ca.yearHt).toBe(0);
    expect(snap.ca.prevYearHt).toBe(0);
    expect(snap.kpis.ca_annuel.value).toBe(0);
    expect(snap.kpis.ca_annuel.status).toBe("ok");
  });

  test("liste vide n'invente ni marge ni taux horaire", () => {
    expect(snap.resultat.margePct).toBeNull();
    expect(snap.rates.tauxHoraireVendu).toBeNull();
    expect(snap.rates.tauxHoraireReel).toBeNull();
    expect(snap.kpis.marge.value).toBeNull();
    expect(snap.kpis.marge.status).not.toBe("ok");
    expect(snap.kpis.taux_horaire_reel.value).toBeNull();
  });

  test("aucun exercice annuel fabriqué", () => {
    expect(snap.annual).toEqual([]);
    expect(snap.clients.all).toEqual([]);
  });
});

describe("buildAnalytics — exercice en cours incomplet", () => {
  const entries = [
    sale({
      id: "s1",
      entry_date: `${YEAR}-03-15`,
      amount_ht: 10_000,
      hours: 100,
      client_id: "c1",
      client_name: "Adagios",
    }),
    sale({
      id: "s2",
      entry_date: `${YEAR}-07-15`,
      amount_ht: 5_000,
      hours: 0,
      client_id: "c1",
      client_name: "Adagios",
      intervention_type: "sst",
    }),
    // Ligne future : exclue du mode réel (date > NOW).
    sale({
      id: "s3",
      entry_date: `${YEAR}-11-15`,
      amount_ht: 90_000,
      hours: 10,
      client_id: "c1",
      client_name: "Adagios",
    }),
    // Exercice précédent (comparatif).
    sale({
      id: "s0",
      entry_date: `${YEAR - 1}-03-15`,
      amount_ht: 4_000,
      hours: 50,
      client_id: "c1",
      client_name: "Adagios",
    }),
  ];
  const chargeRows = [
    charge({ id: "ch1", year: YEAR, month: 3, amount_ht: 3_000 }),
    charge({ id: "ch2", year: YEAR, month: 12, amount_ht: 50_000 }), // mois futur : ignoré
    charge({ id: "inv", year: YEAR, month: 4, amount_ht: 2_000, is_investment: true }),
  ];
  const ledger = [
    ledgerSale({
      id: "l1",
      year: YEAR,
      hours: 100,
      month: 3,
      clientId: "c1",
      clientName: "Adagios",
    }),
    ledgerSale({ id: "l2", year: YEAR, hours: 0, month: 7, clientId: "c1", clientName: "Adagios" }),
  ];
  const snap = buildAnalytics(
    engineInputs({
      entries,
      chargeRows,
      ledger,
      statuses: statuses({ c1: "certified_client" }),
    }),
    NOW,
  );

  test("les lignes futures n'entrent pas dans le CA réel", () => {
    expect(snap.ca.yearHt).toBe(15_000);
    expect(snap.ca.prevYearHt).toBe(4_000);
  });

  test("charges : les mois non écoulés sont exclus, investissements isolés", () => {
    expect(snap.charges.total).toBe(3_000);
    expect(snap.charges.investissements).toBe(2_000);
    expect(snap.resultat.beneficeBrut).toBe(12_000);
    expect(snap.resultat.resultatApresInvestissements).toBe(10_000);
  });

  test("heures réelles = Vente → Temps (0 h SST reste une donnée valide)", () => {
    expect(snap.hours.reelles).toBe(100);
    expect(snap.hours.source).toBe("vente_temps");
    expect(snap.hours.byClient.get("c1")).toBe(100);
  });

  test("taux horaire = CA du périmètre retenu ÷ temps du même périmètre", () => {
    // 15 000 € (CA total du périmètre certifié) ÷ 100 h internes.
    expect(snap.rates.tauxHoraireReel).toBe(150);
  });

  test("un client non certifié ne produit aucun CA analytique", () => {
    const other = buildAnalytics(
      engineInputs({ entries, chargeRows, ledger, statuses: statuses({ c1: "probable_contact" }) }),
      NOW,
    );
    expect(other.ca.yearHt).toBe(15_000);
    expect(other.ca.yearAnalyticalHt).toBe(0);
  });
});

describe("buildAnalytics — lignes orphelines et charges nulles", () => {
  const snap = buildAnalytics(
    engineInputs({
      entries: [
        sale({ id: "orphan", entry_date: `${YEAR}-05-15`, amount_ht: 2_000, hours: 20 }),
        sale({
          id: "linked",
          entry_date: `${YEAR}-05-15`,
          amount_ht: 1_000,
          hours: 10,
          client_id: "c1",
          client_name: "Adagios",
        }),
      ],
      ledger: [ledgerSale({ id: "l1", year: YEAR, hours: 10, month: 5, clientId: "c1" })],
      statuses: statuses({ c1: "certified_client" }),
    }),
    NOW,
  );

  test("la ligne sans client est comptée dans le CA mais signalée non rattachée", () => {
    expect(snap.ca.yearHt).toBe(3_000);
    expect(snap.certification.unlinkedLines).toBe(1);
    expect(snap.certification.caCoveragePct).toBeCloseTo((1_000 / 3_000) * 100, 6);
  });

  test("aucune charge enregistrée : la marge n'est pas présentée comme 100 %", () => {
    expect(snap.charges.total).toBe(0);
    expect(snap.charges.complete).toBe(false);
    expect(snap.kpis.marge.value).toBeNull();
  });

  test("le classement exclut les entités non exploitables", () => {
    const withDuplicate = buildAnalytics(
      engineInputs({
        entries: [
          sale({
            id: "a",
            entry_date: `${YEAR}-05-15`,
            amount_ht: 1_000,
            hours: 10,
            client_id: "c1",
            client_name: "Adagios",
          }),
          sale({
            id: "b",
            entry_date: `${YEAR}-05-15`,
            amount_ht: 900,
            hours: 9,
            client_id: "c2",
            client_name: "Adagios (bis)",
          }),
        ],
        ledger: [
          ledgerSale({ id: "l1", year: YEAR, hours: 10, month: 5, clientId: "c1" }),
          ledgerSale({ id: "l2", year: YEAR, hours: 9, month: 5, clientId: "c2" }),
        ],
        statuses: statuses({ c1: "certified_client", c2: "duplicate_candidate" }),
      }),
      NOW,
    );
    expect(withDuplicate.clients.ranking.map((r) => r.clientId)).toEqual(["c1"]);
    expect(withDuplicate.clients.excluded.map((r) => r.clientId)).toEqual(["c2"]);
  });
});
