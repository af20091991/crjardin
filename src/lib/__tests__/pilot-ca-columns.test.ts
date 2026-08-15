// Régression : les requêtes sur pilot_ca_entries ne doivent demander QUE des
// colonnes réellement présentes (pas d'entry_date), et une erreur de
// chargement des charges ne doit jamais devenir une liste vide.
import { describe, expect, test, mock, beforeAll } from "bun:test";
import { annualSummary } from "@/lib/pilot-annual";
import { analyzeCharges } from "@/lib/pilot-charges";
import { charge, sale, NOW, YEAR } from "./pilot-fixtures";

/** Colonnes réellement livrées par la table pilot_ca_entries. */
const PILOT_CA_COLUMNS = new Set([
  "id",
  "user_id",
  "year",
  "month",
  "kind",
  "designation",
  "amount_ht",
  "hours",
  "is_fixed",
  "position",
  "created_at",
  "updated_at",
  "category",
  "note",
  "client_id",
  "intervention_id",
  "raw_designation",
  "raw_category",
  "raw_client_text",
  "source_file",
  "source_sheet",
  "source_row",
  "fiscal_tag",
  "match_status",
  "match_score",
  "match_method",
  "matched_at",
  "charge_class",
  "charge_category",
  "is_investment",
  "sale_status",
  "validation_status",
  "validation_note",
  "validated_at",
  "site_id",
  "intervention_type",
  "*",
]);

type Row = Record<string, unknown>;
const selects: { table: string; cols: string }[] = [];
let errorTables = new Set<string>();
let dataByTable: Record<string, Row[]> = {};

function builder(table: string) {
  const b: Record<string, unknown> = {
    select(cols?: string) {
      selects.push({ table, cols: cols ?? "*" });
      return b;
    },
    then(resolve: (r: { data: Row[] | null; error: Error | null }) => void) {
      resolve(
        errorTables.has(table)
          ? { data: null, error: new Error(`échec de lecture ${table}`) }
          : { data: dataByTable[table] ?? [], error: null },
      );
    },
  };
  for (const m of ["eq", "gt", "gte", "lte", "in", "order", "range", "not", "is"]) {
    b[m] = () => b;
  }
  return b;
}

mock.module("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table) },
}));

type ChargesLib = typeof import("@/lib/pilot-charges");
type LedgerLib = typeof import("@/lib/pilot-hours-ledger");
let chargesLib: ChargesLib;
let ledgerLib: LedgerLib;

beforeAll(async () => {
  chargesLib = await import("@/lib/pilot-charges");
  ledgerLib = await import("@/lib/pilot-hours-ledger");
});

function colsFor(table: string): string[] {
  return selects
    .filter((s) => s.table === table)
    .flatMap((s) => s.cols.split(",").map((c) => c.trim()))
    .filter(Boolean);
}

describe("requêtes pilot_ca_entries", () => {
  test("listChargeRows n'envoie aucune colonne inexistante", async () => {
    selects.length = 0;
    errorTables = new Set();
    dataByTable = {
      pilot_ca_entries: [
        {
          id: "c1",
          year: YEAR,
          month: 3,
          kind: "charge",
          designation: "Assurance",
          amount_ht: 1000,
          charge_class: "fixe",
          charge_category: "Assurances",
          is_investment: false,
        },
      ],
    };
    const rows = await chargesLib.listChargeRows();
    const cols = colsFor("pilot_ca_entries");
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) expect(PILOT_CA_COLUMNS.has(c)).toBe(true);
    expect(cols).not.toContain("entry_date");
    // Une ligne kind = charge est bien transformée en ChargeRow.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "c1",
      kind: "charge",
      amount_ht: 1000,
      charge_class: "fixe",
    });
  });

  test("fetchHoursLedger n'envoie aucune colonne inexistante et alimente Vente → Temps", async () => {
    selects.length = 0;
    errorTables = new Set();
    dataByTable = {
      pilot_ca_entries: [
        {
          id: "s1",
          year: YEAR,
          month: 3,
          hours: 12,
          designation: "Tonte",
          category: null,
          client_id: "cl1",
          raw_client_text: null,
          match_status: "auto",
          sale_status: "regle",
        },
      ],
      interventions: [],
      pilot_historic_hours: [],
      clients: [{ id: "cl1", name: "Adagios" }],
    };
    const ledger = await ledgerLib.fetchHoursLedger(YEAR, { now: NOW });
    for (const c of colsFor("pilot_ca_entries")) expect(PILOT_CA_COLUMNS.has(c)).toBe(true);
    expect(colsFor("pilot_ca_entries")).not.toContain("entry_date");
    const vendues = ledger.filter((e) => e.type === "vendue");
    expect(vendues).toHaveLength(1);
    expect(vendues[0].hours).toBe(12);
    expect(vendues[0].clientName).toBe("Adagios");
  });

  test("une erreur de lecture des charges remonte et ne devient pas une liste vide", async () => {
    selects.length = 0;
    errorTables = new Set(["pilot_ca_entries"]);
    dataByTable = {};
    await expect(chargesLib.listChargeRows()).rejects.toThrow();
  });
});

describe("charges réelles dans le calcul économique", () => {
  const entries = [
    sale({
      id: "v1",
      entry_date: `${YEAR}-03-10`,
      amount_ht: 10_000,
      hours: 100,
      client_id: "cl1",
    }),
  ];

  test("une charge de 1 000 € apparaît dans annualSummary().charges", () => {
    const rows = annualSummary(
      entries,
      [charge({ id: "c1", year: YEAR, month: 3, amount_ht: 1000 })],
      { mode: "reel", now: NOW },
    );
    const y = rows.find((r) => r.year === YEAR)!;
    expect(y.charges).toBe(1000);
    expect(y.chargesComplete).toBe(true);
  });

  test("la marge n'est pas calculée comme si les charges étaient nulles", () => {
    const y = annualSummary(
      entries,
      [charge({ id: "c1", year: YEAR, month: 3, amount_ht: 1000 })],
      { mode: "reel", now: NOW },
    ).find((r) => r.year === YEAR)!;
    expect(y.beneficeBrut).toBe(9000);
    expect(y.margePct).toBeCloseTo(90, 5);
  });

  test("le poids réel des charges dans le CA est exploité par l'analyse", () => {
    const analysis = analyzeCharges(
      [charge({ id: "c1", year: YEAR, month: 3, amount_ht: 1000 })],
      new Map([[YEAR, 10_000]]),
      [],
      { mode: "reel", now: NOW },
    );
    const y = analysis.years.find((r) => r.year === YEAR)!;
    expect(y.total).toBe(1000);
    expect(y.weightPct).toBeCloseTo(10, 5);
  });

  test("une charge future est exclue de la photographie à date", () => {
    const y = annualSummary(
      entries,
      [
        charge({ id: "c1", year: YEAR, month: 3, amount_ht: 1000 }),
        charge({ id: "c2", year: YEAR, month: 12, amount_ht: 5000 }),
      ],
      { mode: "reel", now: NOW },
    ).find((r) => r.year === YEAR)!;
    expect(y.charges).toBe(1000);
  });

  test("les investissements restent hors charges d'exploitation", () => {
    const y = annualSummary(
      entries,
      [
        charge({ id: "c1", year: YEAR, month: 3, amount_ht: 1000 }),
        charge({ id: "i1", year: YEAR, month: 3, amount_ht: 3000, is_investment: true }),
      ],
      { mode: "reel", now: NOW },
    ).find((r) => r.year === YEAR)!;
    expect(y.charges).toBe(1000);
    expect(y.investissements).toBe(3000);
    expect(y.resultatApresInvestissements).toBe(6000);
  });

  test("la rémunération dirigeant reste hors charges d'exploitation", () => {
    const y = annualSummary(
      entries,
      [
        charge({ id: "c1", year: YEAR, month: 3, amount_ht: 1000 }),
        charge({ id: "r1", year: YEAR, month: 3, amount_ht: 2000, kind: "remuneration" }),
      ],
      { mode: "reel", now: NOW },
    ).find((r) => r.year === YEAR)!;
    expect(y.charges).toBe(1000);
  });
});
